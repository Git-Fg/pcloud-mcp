/**
 * Builds the tar of all PDFs cited in the index, using their canonical paths.
 *
 * The local mirror has the files by their old paths and their fileids. The
 * canonical tree has the same files by their new paths. The index links them
 * by fileid. This script walks the index, finds the canonical path for each
 * fileid, and writes a mapping that a tar builder can use.
 *
 * Usage: bun run scripts/pharmacie-build-tar-mapping.ts [inventory] [manifest] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';

interface ManifestEntry {
  fileid: number;
  relpath: string;
  name: string;
  size: number;
  sha1: string;
  sha256: string;
}

interface InvNode {
  fileid?: number;
  path: string;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-22.json';
const manifestPath = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror/MANIFEST.json';
const outJson = process.argv[4] ?? '/tmp/pharmacie-tar-mapping.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { files: ManifestEntry[] };

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else if (node.fileid !== undefined) files.push(node);
  }
})(roots);

const byFileid = new Map<number, string>();
for (const file of files) byFileid.set(file.fileid!, file.path);

const mapping: Array<{ fileid: number; canonicalPath: string; name: string; size: number; sha1: string }> = [];
let notFound = 0;
for (const entry of manifest.files) {
  const canonicalPath = byFileid.get(entry.fileid);
  if (canonicalPath) {
    mapping.push({ fileid: entry.fileid, canonicalPath, name: entry.name, size: entry.size, sha1: entry.sha1 });
  } else {
    notFound += 1;
    console.error(`not found: ${entry.fileid} ${entry.relpath}`);
  }
}

await writeFile(outJson, JSON.stringify({ mapping, notFound }, null, 1));
console.error(`mapped ${mapping.length} of ${manifest.files.length}, ${notFound} not found`);