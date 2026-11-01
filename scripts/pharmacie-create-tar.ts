/**
 * Builds the canonical tar of the Pharmacie corpus straight from pCloud.
 *
 * The archive is written from the live tree: every file of the inventory is
 * fetched by its fileid and written at the path it carries in the tree. There
 * is no staging copy of the corpus on disk, so the build needs no more room
 * than the archive itself.
 *
 * A tar entry is a header that states the payload length followed by the
 * payload, so a payload of a different length than the header announced
 * corrupts every entry after it. The length is therefore checked before the
 * header is written, and a file that does not match is left out rather than
 * written wrong.
 *
 * Paths longer than a ustar header can hold are written with a PAX extended
 * header, which is what GNU tar and bsdtar both read.
 *
 * The build is resumable. Every entry that reaches the archive is recorded in
 * a sidecar log with the offset it ends at; a re-run replays that log, keeps
 * the entries already written, truncates the archive to the last one, and
 * fetches only what is missing.
 *
 * Usage: bun run scripts/pharmacie-create-tar.ts [inventory] [outTar] [--include pdf,docx] [--concurrency N]
 */
import { createWriteStream, type WriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { appendFile, readFile, truncate, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  fileid?: number;
  size?: number;
  contenttype?: string;
  children?: InvNode[];
}

interface Target {
  index: number;
  path: string;
  relative: string;
  fileid: number;
  size: number;
}

interface Progress {
  i: number;
  ok: boolean;
  path: string;
  size: number;
  sha1: string;
  offset: number;
  error?: string;
}

const BLOCK = 512;
const ROOT = '/Pharmacie/';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const inventoryPath = positional[0] ?? '/tmp/pharmacie-inventory.json';
const outTar = positional[1] ?? '/Users/felix/Downloads/pharmacie_canonical.tar';
const extensions = (flag('include') ?? 'pdf')
  .split(',')
  .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
  .filter(Boolean);
const concurrency = Number(flag('concurrency') ?? 4);
const progressPath = `${outTar}.progress.jsonl`;
const manifestPath = `${outTar}.manifest.json`;

// --- tar encoding ------------------------------------------------------------

function octal(value: number, width: number): Buffer {
  return Buffer.from(`${value.toString(8).padStart(width - 1, '0')}\0`, 'utf8');
}

/**
 * Truncates a name to fit a header field without splitting a character:
 * a header that ends mid-character makes the reader reject the archive.
 */
function fitName(name: string, limit: number): string {
  const bytes = Buffer.from(name, 'utf8');
  if (bytes.length <= limit) return name;
  let end = limit;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return bytes.subarray(0, end).toString('utf8');
}

function ustarHeader(options: { name: string; size: number; typeflag: string; mtime: number }): Buffer {
  const header = Buffer.alloc(BLOCK);
  Buffer.from(fitName(options.name, 100), 'utf8').copy(header, 0);
  octal(0o644, 8).copy(header, 100);
  octal(0, 8).copy(header, 108);
  octal(0, 8).copy(header, 116);
  octal(options.size, 12).copy(header, 124);
  octal(options.mtime, 12).copy(header, 136);
  Buffer.from('        ', 'utf8').copy(header, 148, 0, 8);
  header[156] = options.typeflag.charCodeAt(0);
  Buffer.from('ustar\0', 'utf8').copy(header, 257, 0, 6);
  Buffer.from('00', 'utf8').copy(header, 263, 0, 2);
  let checksum = 0;
  for (let i = 0; i < BLOCK; i += 1) checksum += header[i];
  Buffer.from(`${checksum.toString(8).padStart(6, '0')}\0 `, 'utf8').copy(header, 148, 0, 8);
  return header;
}

/**
 * One PAX record. Its stated length counts the whole record, the digits of
 * the length included, so the length is settled by iteration.
 */
function paxRecord(key: string, value: string): Buffer {
  const body = Buffer.from(`${key}=${value}\n`, 'utf8');
  let length = body.length + 2;
  while (String(length).length + 1 + body.length !== length) length = String(length).length + 1 + body.length;
  return Buffer.concat([Buffer.from(`${length} `, 'utf8'), body]);
}

/** The blocks that carry a path too long for a ustar header. */
function paxBlocks(path: string, mtime: number): Buffer[] {
  const data = paxRecord('path', path);
  const padded = Buffer.alloc(Math.ceil(data.length / BLOCK) * BLOCK);
  data.copy(padded, 0);
  const label = `PaxHeaders/${fitName(path.split('/').pop() ?? 'entry', 80)}`;
  return [ustarHeader({ name: label, size: data.length, typeflag: 'x', mtime }), padded];
}

// --- targets -----------------------------------------------------------------

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const targets: Target[] = files
  .filter((file) => file.fileid !== undefined && file.path.startsWith(ROOT))
  .filter((file) => extensions.includes((file.name.split('.').pop() ?? '').toLowerCase()))
  .map((file, index) => ({
    index,
    path: file.path,
    relative: file.path.slice(ROOT.length),
    fileid: file.fileid!,
    size: file.size ?? 0,
  }));

const totalBytes = targets.reduce((sum, target) => sum + target.size, 0);
process.stderr.write(
  `${targets.length} ${extensions.join('/')} files, ${(totalBytes / 1073741824).toFixed(2)} GB -> ${outTar}\n`,
);

// --- resume ------------------------------------------------------------------

/** The state of every entry, as the sidecar log last described it. */
const state = new Map<number, Progress>();
try {
  const raw = await readFile(progressPath, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as Progress;
      state.set(record.i, record);
    } catch {
      // A torn last line means the process died mid-write; the entry it
      // described is not trusted and gets fetched again.
    }
  }
} catch {
  // No sidecar yet: this is a first run.
}

// The archive must end where the last entry that reached it ends. Anything
// past that was written by a run that died before recording the entry.
let resumeOffset = 0;
for (const record of state.values()) {
  if (record.ok && record.offset > resumeOffset) resumeOffset = record.offset;
}
if (resumeOffset > 0) {
  await truncate(outTar, resumeOffset);
  process.stderr.write(`resuming at offset ${resumeOffset} (${(resumeOffset / 1073741824).toFixed(2)} GB)\n`);
} else {
  state.clear();
}

// --- writer ------------------------------------------------------------------

const tar = createWriteStream(outTar, {
  flags: resumeOffset > 0 ? 'r+' : 'w',
  start: resumeOffset,
});
let pending: Promise<void> = Promise.resolve();
let offset = resumeOffset;

function write(chunk: Buffer): Promise<void> {
  pending = pending.then(
    () =>
      new Promise<void>((resolve) => {
        if (tar.write(chunk)) {
          resolve();
          return;
        }
        tar.once('drain', () => resolve());
      }),
  );
  return pending;
}

async function writeEntry(target: Target, content: Buffer, mtime: number): Promise<void> {
  const long = Buffer.byteLength(target.relative, 'utf8') > 100;
  if (long) {
    for (const block of paxBlocks(target.relative, mtime)) await write(block);
  }
  await write(ustarHeader({ name: target.relative, size: content.length, typeflag: '0', mtime }));
  await write(content);
  const padding = content.length % BLOCK;
  if (padding !== 0) await write(Buffer.alloc(BLOCK - padding));
  offset +=
    (long ? paxBlocks(target.relative, mtime).reduce((sum, block) => sum + block.length, 0) : 0) +
    BLOCK +
    content.length +
    (padding === 0 ? 0 : BLOCK - padding);
}

// --- fetching ----------------------------------------------------------------

const client = new PcloudHttpClient();

interface Fetched {
  ok: boolean;
  content?: Buffer;
  sha1?: string;
  error?: string;
}

async function fetchOne(target: Target): Promise<Fetched> {
  try {
    const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid: target.fileid });
    const host = link.hosts?.[0];
    if (!host) return { ok: false, error: 'no host in the download link' };
    const response = await fetch(`https://${host}${link.path}`);
    if (!response.ok) return { ok: false, error: `download failed: ${response.status}` };
    const content = Buffer.from(await response.arrayBuffer());
    if (target.size > 0 && content.length !== target.size) {
      return { ok: false, error: `${content.length} bytes downloaded, ${target.size} expected` };
    }
    return { ok: true, content, sha1: createHash('sha1').update(content).digest('hex') };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.split('\n')[0] : String(err) };
  }
}

const results = new Map<number, Fetched>();
let issued = 0;

async function worker(): Promise<void> {
  while (issued < targets.length) {
    const index = issued;
    issued += 1;
    if (state.get(index)?.ok) continue;
    const target = targets[index];
    results.set(index, await fetchOne(target));
  }
}

const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());

let written = 0;
let failed = 0;
let bytes = 0;

for (const target of targets) {
  const prior = state.get(target.index);
  if (prior?.ok) {
    // Already in the archive: trust the recorded offset and move on.
    offset = prior.offset;
    written += 1;
    bytes += prior.size;
    continue;
  }

  while (!results.has(target.index)) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  const fetched = results.get(target.index)!;
  results.delete(target.index);

  if (!fetched.ok || !fetched.content) {
    failed += 1;
    const record: Progress = {
      i: target.index,
      ok: false,
      path: target.relative,
      size: target.size,
      sha1: '',
      offset,
      error: fetched.error,
    };
    state.set(target.index, record);
    await appendFile(progressPath, `${JSON.stringify(record)}\n`);
    process.stderr.write(`  FAIL ${target.relative}: ${fetched.error}\n`);
    continue;
  }

  const mtime = Math.floor(Date.now() / 1000);
  await writeEntry(target, fetched.content, mtime);
  written += 1;
  bytes += fetched.content.length;
  const record: Progress = {
    i: target.index,
    ok: true,
    path: target.relative,
    size: fetched.content.length,
    sha1: fetched.sha1 ?? '',
    offset,
  };
  state.set(target.index, record);
  await appendFile(progressPath, `${JSON.stringify(record)}\n`);
  if (written % 100 === 0) {
    process.stderr.write(`  ${written}/${targets.length}  ${(bytes / 1073741824).toFixed(2)} GB\n`);
  }
}

await Promise.all(workers);

// The two zero blocks that end the archive.
await write(Buffer.alloc(1024));
await new Promise<void>((resolve) => {
  (tar as WriteStream).end(() => resolve());
});

process.stderr.write(
  `tar written: ${written} files, ${failed} failed, ${(bytes / 1073741824).toFixed(2)} GB -> ${outTar}\n`,
);

const manifest = targets
  .map((target) => state.get(target.index))
  .filter((record): record is Progress => record?.ok === true)
  .map((record) => ({ path: record.path, size: record.size, sha1: record.sha1 }));
await writeFile(manifestPath, JSON.stringify({ files: manifest }, null, 1));
process.stderr.write(`manifest: ${manifest.length} entries -> ${manifestPath}\n`);
