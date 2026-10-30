/**
 * Finds the files that hold the same bytes.
 *
 * Two files of the same size are candidates; the digest is the proof. The
 * digest comes from the API, which computes it server-side: no byte of the
 * corpus travels over the network to decide whether two files are the same.
 * The proof script (pharmacie-verify-checksum.ts) checks that the digest the
 * API reports is the digest of the content.
 *
 * Files are grouped by size first, because two files of different sizes can
 * never hold the same bytes. That filter is what makes the sweep affordable.
 *
 * Usage: bun run scripts/pharmacie-file-duplicates.ts [inventory] [out] [concurrency]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface Member {
  fileid: number;
  path: string;
  name: string;
  size: number;
  sha1: string;
}

interface Group {
  size: number;
  members: Member[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-19.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-file-duplicates.json';
const concurrency = Number(process.argv[4] ?? 8);

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

// Only files that share their size with another file can be duplicates.
const bySize = new Map<number, InvNode[]>();
for (const file of files) {
  if (!file.size || file.size === 0) continue;
  const group = bySize.get(file.size) ?? [];
  group.push(file);
  bySize.set(file.size, group);
}
const candidates = [...bySize.values()].filter((group) => group.length > 1).flat();
const candidateBytes = candidates.reduce((sum, file) => sum + file.size!, 0);
const candidateCount = candidates.length;

process.stderr.write(
  `${files.length} files, ${bySize.size} distinct sizes, ${candidates.length} files share a size ` +
    `(${(candidateBytes / 1024 / 1024 / 1024).toFixed(2)} GB of candidates)\n`
);

const client = new PcloudHttpClient();

const digests = new Map<number, string>();
let done = 0;
let failed = 0;

async function worker(): Promise<void> {
  for (;;) {
    const file = candidates.pop();
    if (!file) return;
    try {
      const response = await client.json<{ sha1?: string }>('checksumfile', { fileid: file.fileid });
      if (response.sha1) digests.set(file.fileid!, response.sha1);
      else failed += 1;
    } catch {
      failed += 1;
    }
    done += 1;
    if (done % 200 === 0) {
      process.stderr.write(`  ${done}/${candidateCount} digests taken, ${failed} failed\n`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const byDigest = new Map<string, InvNode[]>();
const sizeShared = [...bySize.values()].filter((group) => group.length > 1).flat();
for (const file of sizeShared) {
  const sha1 = digests.get(file.fileid!);
  if (!sha1) continue;
  const bucket = byDigest.get(sha1) ?? [];
  bucket.push(file);
  byDigest.set(sha1, bucket);
}

const groups: Group[] = [];
for (const bucket of byDigest.values()) {
  if (bucket.length < 2) continue;
  groups.push({
    size: bucket[0].size!,
    members: bucket.map((file) => ({
      fileid: file.fileid!,
      path: file.path,
      name: file.name,
      size: file.size!,
      sha1: digests.get(file.fileid!)!,
    })),
  });
}
groups.sort((a, b) => (b.members.length - 1) * b.size - (a.members.length - 1) * a.size);

const waste = groups.reduce((sum, group) => sum + (group.members.length - 1) * group.size, 0);
const removedFiles = groups.reduce((sum, group) => sum + group.members.length - 1, 0);

await writeFile(outJson, JSON.stringify({ groups }, null, 1));
process.stderr.write(
  `\n${groups.length} groups of identical files, ${removedFiles} redundant copies, ` +
    `${(waste / 1024 / 1024 / 1024).toFixed(2)} GB reclaimable\n` +
    `Written ${outJson}\n`
);
