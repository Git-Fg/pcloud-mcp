/**
 * Builds the map from the local mirror to the canonical paths of the tree.
 *
 * The mirror holds the files that were downloaded once, with the path they
 * had then. The tree has since been reorganised, so the mirror's paths no
 * longer say where a file belongs; the digest does. The mirror recorded a
 * SHA-1 for every file it fetched, and the tree's files can be given the
 * same digest, so the two are matched by content rather than by name.
 *
 * A file of the tree that the mirror does not hold is listed as missing, so
 * the caller knows what is still to be fetched.
 *
 * Usage: bun run scripts/pharmacie-build-tar-mapping.ts [inventory] [mirrorManifest] [out]
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

interface MirrorFile {
  fileid: number;
  relpath: string;
  name: string;
  size: number;
  sha1: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-final.json';
const manifestPath = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror/MANIFEST.json';
const outPath = process.argv[4] ?? '/tmp/pharmacie-tar-mapping-new.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { files: MirrorFile[] };

/** The mirror's files, by digest. */
const mirrorBySha1 = new Map<string, MirrorFile>();
for (const file of manifest.files) {
  if (!file.sha1) continue;
  mirrorBySha1.set(file.sha1, file);
}
process.stderr.write(`mirror holds ${manifest.files.length} files, ${mirrorBySha1.size} with a digest\n`);

const client = new PcloudHttpClient();

const mapping: Array<{ mirrorPath: string; canonicalPath: string; name: string; size: number; sha1: string }> = [];
const missing: Array<{ path: string; fileid: number; size: number }> = [];

for (const file of files) {
  if (!file.name.toLowerCase().endsWith('.pdf')) continue;
  if (!file.fileid) continue;

  let sha1: string;
  try {
    const response = await client.json<{ sha1: string }>('checksumfile', { fileid: file.fileid });
    sha1 = response.sha1;
  } catch (err) {
    process.stderr.write(`  FAIL checksum ${file.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
    missing.push({ path: file.path, fileid: file.fileid, size: file.size ?? 0 });
    continue;
  }

  const mirrorFile = mirrorBySha1.get(sha1);
  if (!mirrorFile) {
    missing.push({ path: file.path, fileid: file.fileid, size: file.size ?? 0 });
    continue;
  }
  mapping.push({
    mirrorPath: mirrorFile.relpath,
    canonicalPath: file.path,
    name: file.name,
    size: file.size ?? 0,
    sha1,
  });
  if (mapping.length % 250 === 0) process.stderr.write(`  ${mapping.length} matched\n`);
}

const bytes = mapping.reduce((sum, entry) => sum + entry.size, 0);
const missingBytes = missing.reduce((sum, entry) => sum + entry.size, 0);
process.stderr.write(
  `\n${mapping.length} PDFs matched by digest (${(bytes / 1073741824).toFixed(2)} GB)\n` +
    `${missing.length} still to fetch (${(missingBytes / 1073741824).toFixed(2)} GB)\n`,
);

await writeFile(outPath, JSON.stringify({ mapping, missing }, null, 1));
process.stderr.write(`Wrote ${outPath}\n`);
