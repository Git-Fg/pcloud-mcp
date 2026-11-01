/**
 * Fetches the files the mirror lacks, under the path they have in the tree.
 *
 * The mirror was downloaded before the reorganisation, so the files that
 * joined the tree since are missing from it. Each is fetched into the
 * mirror under the path it has now, so the tar builder finds every file at
 * the path it will carry in the archive.
 *
 * Usage: bun run scripts/pharmacie-fetch-missing.ts [mapping] [mirrorRoot] [--verify]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface Missing {
  path: string;
  fileid: number;
  size: number;
}

const mappingPath = process.argv[2] ?? '/tmp/pharmacie-tar-mapping-new.json';
const mirrorRoot = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror';
const verify = process.argv.includes('--verify');

const { missing } = JSON.parse(await readFile(mappingPath, 'utf8')) as { missing: Missing[] };
process.stderr.write(`${missing.length} files to fetch, ${(missing.reduce((sum, m) => sum + m.size, 0) / 1073741824).toFixed(2)} GB\n`);

const client = new PcloudHttpClient();
const log: Array<{ fileid: number; relpath: string; name: string; size: number; sha1: string; sha256: string }> = [];

let fetched = 0;
let failed = 0;
let bytes = 0;

async function fetchOne(entry: Missing): Promise<void> {
  const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid: entry.fileid });
  const host = link.hosts?.[0];
  if (!host) throw new Error('no host in the download link');
  const response = await fetch(`https://${host}${link.path}`);
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const relative = entry.path.replace(/^\/Pharmacie\//, '');
  const destination = `${mirrorRoot}/${relative}`;
  await mkdir(destination.replace(/\/[^/]+$/, ''), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(destination, buffer);
  bytes += buffer.length;
  log.push({
    fileid: entry.fileid,
    relpath: relative,
    name: entry.path.split('/').pop()!,
    size: buffer.length,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sha256: verify ? createHash('sha256').update(buffer).digest('hex') : '',
  });
  fetched += 1;
}

const CONCURRENCY = 4;
const queue = [...missing];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) break;
    try {
      await fetchOne(entry);
    } catch (err) {
      failed += 1;
      process.stderr.write(`  FAIL ${entry.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
    }
    if ((fetched + failed) % 25 === 0) {
      process.stderr.write(`  ${fetched + failed}/${missing.length}  ${(bytes / 1073741824).toFixed(2)} GB\n`);
    }
  }
});

await Promise.all(workers);
process.stderr.write(`Fetched ${fetched}, failed ${failed}, ${(bytes / 1073741824).toFixed(2)} GB\n`);

// The mirror's manifest grows with what was fetched, so a later run of the
// mapper sees them and does not fetch them again.
const manifestPath = `${mirrorRoot}/MANIFEST.json`;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.files.push(...log);
manifest.fileCount = manifest.files.length;
manifest.totalBytes += bytes;
await writeFile(manifestPath, JSON.stringify(manifest, null, 1));
await writeFile(`${mirrorRoot}/_fetch_log.jsonl`, log.map((entry) => JSON.stringify(entry)).join('\n') + '\n', { flag: 'a' });
process.stderr.write('Mirror manifest updated\n');
