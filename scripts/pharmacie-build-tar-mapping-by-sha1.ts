/**
 * Builds the tar mapping by matching SHA-1 hashes between the mirror and the
 * current canonical tree.
 *
 * The mirror has 3447 PDFs with their SHA-1 (from the download log). The
 * canonical tree has the same files (content-wise) but possibly different
 * fileids and paths. The SHA-1 is the stable identity.
 *
 * Usage: bun run scripts/pharmacie-build-tar-mapping-by-sha1.ts [inventory] [log] [out] [concurrency]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface MirrorEntry {
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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-final.json';
const logPath = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror/_download_log.jsonl';
const outJson = process.argv[4] ?? '/tmp/pharmacie-tar-mapping-final.json';
const concurrency = Number(process.argv[5] ?? 8);

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

// Parse the download log: one JSON object per line.
const logText = await readFile(logPath, 'utf8');
const mirrorEntries: MirrorEntry[] = logText.trim().split('\n').map((line) => JSON.parse(line));
console.error(`mirror has ${mirrorEntries.length} entries`);

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else if (node.fileid !== undefined) files.push(node);
  }
})(roots);
console.error(`inventory has ${files.length} files`);

const client = new PcloudHttpClient();

// Build SHA-1 -> canonical path map from the current tree.
const sha1ToPath = new Map<string, string>();
let done = 0;
let failed = 0;

async function worker(): Promise<void> {
  for (;;) {
    const file = files.pop();
    if (!file) return;
    try {
      const response = await client.json<{ sha1?: string }>('checksumfile', { fileid: file.fileid! });
      if (response.sha1) sha1ToPath.set(response.sha1, file.path);
      else failed += 1;
    } catch {
      failed += 1;
    }
    done += 1;
    if (done % 500 === 0) {
      console.error(`  ${done}/${files.length + done} digests, ${sha1ToPath.size} mapped, ${failed} failed`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.error(`sha1 map built: ${sha1ToPath.size} entries`);

// Now match each mirror entry by SHA-1.
const mapping: Array<{ mirrorPath: string; canonicalPath: string; name: string; size: number; sha1: string }> = [];
let notFound = 0;
for (const entry of mirrorEntries) {
  const canonicalPath = sha1ToPath.get(entry.sha1);
  if (canonicalPath) {
    mapping.push({
      mirrorPath: entry.relpath,
      canonicalPath,
      name: entry.name,
      size: entry.size,
      sha1: entry.sha1,
    });
  } else {
    notFound += 1;
  }
}

await writeFile(outJson, JSON.stringify({ mapping, notFound }, null, 1));
console.error(`mapped ${mapping.length} of ${mirrorEntries.length}, ${notFound} not found by SHA-1`);