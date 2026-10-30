/**
 * Checks that the checksum the API reports is the checksum of the bytes.
 *
 * The duplicate finder trusts the API to tell two files apart. That trust
 * only holds if the reported digest is the digest of the content. This script
 * proves it on real files: it asks the API for the checksum, downloads the
 * same file, and compares the digest the API reported with the digest
 * computed here from the downloaded bytes.
 *
 * Usage: bun run scripts/pharmacie-verify-checksum.ts [inventory] [sample]
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-19.json';
const sampleSize = Number(process.argv[3] ?? 6);

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const client = new PcloudHttpClient();

// Small and large files alike: the digest must hold for both.
const pool = files.filter((f) => f.size && f.size > 0);
const small = pool.filter((f) => f.size! < 200000);
const large = pool.filter((f) => f.size! > 5_000_000);
const sample = [...small.slice(0, Math.ceil(sampleSize / 2)), ...large.slice(0, Math.floor(sampleSize / 2))];

let matched = 0;
let mismatched = 0;
let skipped = 0;

for (const file of sample) {
  let reported: string | null = null;
  try {
    const response = await client.json<{ sha1?: string; sha256?: string }>('checksumfile', { fileid: file.fileid });
    reported = response.sha1 ?? null;
  } catch {
    skipped += 1;
    process.stderr.write(`  no checksum for ${file.path.replace('/Pharmacie/', '')}\n`);
    continue;
  }
  if (!reported) {
    skipped += 1;
    continue;
  }

  try {
    const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', { fileid: file.fileid, forcedownload: true });
    const res = await fetch(`https://${linkRes.hosts[0]}${linkRes.path}`);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const local = createHash('sha1').update(bytes).digest('hex');
    if (local === reported) {
      matched += 1;
      process.stderr.write(`  match  ${file.size} bytes  ${file.path.replace('/Pharmacie/', '')}\n`);
    } else {
      mismatched += 1;
      process.stderr.write(`  DIFFER ${file.path.replace('/Pharmacie/', '')}  api=${reported} local=${local}\n`);
    }
  } catch (err) {
    skipped += 1;
    process.stderr.write(`  skipped ${file.path.replace('/Pharmacie/', '')}: ${err instanceof Error ? err.message : err}\n`);
  }
}

process.stderr.write(`\nmatched ${matched}, differed ${mismatched}, skipped ${skipped}\n`);
if (mismatched > 0) process.exitCode = 1;
