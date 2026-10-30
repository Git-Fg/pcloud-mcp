/**
 * Creates a tar of the mirror files under their canonical paths.
 *
 * The mapping gives, for each file in the mirror, its canonical path.
 * We copy each file to a staging tree and tar that tree.
 *
 * Usage: bun run scripts/pharmacie-create-tar-staged.ts [mapping] [mirrorRoot] [outTar] [staging] [concurrency]
 */
import { readFile, _writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

interface MappedEntry {
  mirrorPath: string;
  canonicalPath: string;
  name: string;
  size: number;
  sha1: string;
}

const mappingPath = process.argv[2] ?? '/tmp/pharmacie-tar-mapping-final.json';
const mirrorRoot = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror';
const outTar = process.argv[4] ?? '/Users/felix/Downloads/pharmacie_canonical.tar';
const staging = process.argv[5] ?? '/tmp/pharmacie_tar_staging';
const _concurrency = Number(process.argv[6] ?? 8);

const mappingData = JSON.parse(await readFile(mappingPath, 'utf8')) as { mapping: MappedEntry[]; notFound: number };
const entries = mappingData.mapping;

console.error(`staging ${entries.length} files to ${staging}`);

// Clean and create staging
if (existsSync(staging)) await rm(staging, { recursive: true });
await mkdir(staging, { recursive: true });

async function copyEntry(entry: MappedEntry): Promise<void> {
  const src = `${mirrorRoot}/${entry.mirrorPath}`;
  const dst = `${staging}${entry.canonicalPath}`;
  await mkdir(dst.replace(/\/[^/]+$/, ''), { recursive: true });
  await cp(src, dst);
}

let copied = 0;
const BATCH = 100;
for (let i = 0; i < entries.length; i += BATCH) {
  const batch = entries.slice(i, i + BATCH);
  await Promise.all(batch.map(copyEntry));
  copied += batch.length;
  if (copied % 500 === 0) console.error(`  ${copied}/${entries.length} staged`);
}

console.error(`staging done, creating tar...`);

const { spawn } = await import('node:child_process');
await new Promise<void>((resolve, reject) => {
  const proc = spawn('tar', ['-cf', outTar, '-C', staging, '.'], { stdio: 'pipe' });
  proc.stderr.on('data', (d) => console.error(`tar: ${d}`));
  proc.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`tar exited ${code}`));
  });
});

console.error(`tar written: ${outTar}`);

// Clean up staging
await rm(staging, { recursive: true });