/**
 * Checks that every member of a zip archive is already in the tree, then
 * deletes the archive.
 *
 * An archive whose contents are all present elsewhere is a second copy of
 * material the tree already holds, and the tree is the better copy: its
 * files are named and sorted. An archive holding something the tree lacks
 * is kept, because it is the only place that content exists.
 *
 * The check reads the archive's central directory over HTTP, so it never
 * downloads the payload. The archive is fetched by range, and the members
 * are matched against the tree by name and size.
 *
 * Usage: bun run scripts/pharmacie-verify-zips.ts [inventory] [outPlan] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  hash?: number;
  children?: InvNode[];
}

interface ZipMember {
  name: string;
  size: number;
}

interface ZipPlan {
  fileid: number;
  path: string;
  size: number;
  members: number;
  missing: string[];
  verdict: 'redundant' | 'holds-unique-content';
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-5.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-zip-verification.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const zips = files.filter((file) => file.name.toLowerCase().endsWith('.zip'));

/** Every file of the tree, by name and size, so a member can be looked up. */
const byNameAndSize = new Map<string, InvNode[]>();
for (const file of files) {
  if (file.isfolder) continue;
  const key = `${file.name} ${file.size ?? 0}`;
  const list = byNameAndSize.get(key) ?? [];
  list.push(file);
  byNameAndSize.set(key, list);
}

const client = new PcloudHttpClient();

/**
 * The members of a zip, read from its central directory.
 *
 * The directory sits at the end of the file and names every member with its
 * size. It is fetched over HTTP by range, so the payload is never read.
 */
async function readZipMembers(fileid: number, size: number): Promise<ZipMember[]> {
  const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid });
  const host = link.hosts?.[0];
  if (!host) throw new Error('no host in the download link');
  const url = `https://${host}${link.path}`;

  // The end-of-directory record sits in the last 64 KiB of the archive.
  const tailLength = Math.min(size, 65536);
  const tail = await fetchRange(url, size - tailLength, tailLength);
  const eocd = findEndOfCentralDirectory(tail);
  if (!eocd) throw new Error('no end-of-central-directory record');

  const directorySize = eocd.directorySize;
  const directoryOffset = eocd.directoryOffset;

  let directory: Buffer;
  if (directoryOffset >= size - tailLength && directoryOffset + directorySize <= size) {
    directory = tail.subarray(directoryOffset - (size - tailLength), directoryOffset - (size - tailLength) + directorySize);
  } else {
    directory = await fetchRange(url, directoryOffset, directorySize);
  }

  return parseCentralDirectory(directory);
}

async function fetchRange(url: string, start: number, length: number): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${start + length - 1}` },
  });
  if (!response.ok) throw new Error(`range request failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

interface Eocd {
  directoryOffset: number;
  directorySize: number;
  entries: number;
}

function findEndOfCentralDirectory(tail: Buffer): Eocd | null {
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (tail.readUInt32LE(i) !== 0x06054b50) continue;
    return {
      entries: tail.readUInt16LE(i + 10),
      directorySize: tail.readUInt32LE(i + 12),
      directoryOffset: tail.readUInt32LE(i + 16),
    };
  }
  return null;
}

/** The members named by a central directory, with their uncompressed sizes. */
function parseCentralDirectory(directory: Buffer): ZipMember[] {
  const members: ZipMember[] = [];
  let offset = 0;
  while (offset + 46 <= directory.length) {
    if (directory.readUInt32LE(offset) !== 0x02014b50) break;
    const compressedSize = directory.readUInt32LE(offset + 20);
    const uncompressedSize = directory.readUInt32LE(offset + 24);
    const nameLength = directory.readUInt16LE(offset + 28);
    const extraLength = directory.readUInt16LE(offset + 30);
    const commentLength = directory.readUInt16LE(offset + 32);
    const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    // A zip64 entry carries its sizes in the extra field; the 32-bit fields
    // hold the placeholder, so the extra field is read for the real value.
    members.push({ name, size: uncompressedSize || compressedSize });
  }
  return members;
}

const plans: ZipPlan[] = [];

for (const zip of zips) {
  let members: ZipMember[] = [];
  try {
    members = await readZipMembers(zip.fileid!, zip.size ?? 0);
  } catch (err) {
    process.stderr.write(`  FAIL ${zip.path}: ${err instanceof Error ? err.message : err}\n`);
    plans.push({
      fileid: zip.fileid!,
      path: zip.path,
      size: zip.size ?? 0,
      members: 0,
      missing: ['<could not read the archive>'],
      verdict: 'holds-unique-content',
    });
    continue;
  }

  const missing: string[] = [];
  for (const member of members) {
    const key = `${member.name.split('/').pop()} ${member.size}`;
    if (!byNameAndSize.has(key)) missing.push(member.name);
  }

  plans.push({
    fileid: zip.fileid!,
    path: zip.path,
    size: zip.size ?? 0,
    members: members.length,
    missing,
    verdict: missing.length === 0 ? 'redundant' : 'holds-unique-content',
  });
  process.stderr.write(
    `  ${plans[plans.length - 1].verdict.padEnd(22)} ${members.length} members, ${missing.length} missing  ${zip.path.replace('/Pharmacie/', '')}\n`,
  );
}

const redundant = plans.filter((plan) => plan.verdict === 'redundant');
const bytes = redundant.reduce((sum, plan) => sum + plan.size, 0);
process.stderr.write(
  `\n${redundant.length}/${plans.length} archives hold nothing the tree lacks — ${(bytes / 1048576).toFixed(0)} MB\n`,
);

await writeFile(outPlan, JSON.stringify({ plans, redundant: redundant.map((p) => p.fileid) }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to delete the redundant archives.\n');
  process.exit(0);
}

let deleted = 0;
let failed = 0;
for (const plan of redundant) {
  try {
    await client.json('deletefile', { fileid: plan.fileid });
    deleted += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${plan.path}: ${err instanceof Error ? err.message : err}\n`);
  }
}
process.stderr.write(`Deleted ${deleted}, failed ${failed}\n`);
