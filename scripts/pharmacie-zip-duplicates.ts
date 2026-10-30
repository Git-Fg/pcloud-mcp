/**
 * Finds the archives that hold the same bytes.
 *
 * Two archives of the same size are candidates, not proof: the only proof
 * is the hash. This script downloads the candidates, hashes them, and reports
 * the groups whose contents are identical.
 *
 * Usage: bun run scripts/pharmacie-zip-duplicates.ts [inventory] [out] [maxSizeMb]
 */
import { readFile, writeFile } from 'node:fs/promises';
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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-18.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-zip-duplicates.json';
const maxSizeMb = Number(process.argv[4] ?? 80);

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const ARCHIVE = /\.(zip|apkg|colpkg)$/i;
const limit = maxSizeMb * 1024 * 1024;

const archives = files.filter((f) => ARCHIVE.test(f.name) && (f.size ?? 0) > 0 && (f.size ?? 0) <= limit);

// Candidates: archives that share their exact size with another one.
const bySize = new Map<number, InvNode[]>();
for (const archive of archives) {
  const group = bySize.get(archive.size!) ?? [];
  group.push(archive);
  bySize.set(archive.size!, group);
}
const candidates = [...bySize.values()].filter((group) => group.length > 1).flat();

if (candidates.length === 0) {
  process.stderr.write('No archive shares its size with another one\n');
  await writeFile(outJson, JSON.stringify({ groups: [] }, null, 1));
  process.exit(0);
}

const client = new PcloudHttpClient();

async function hashOf(file: InvNode): Promise<string | null> {
  try {
    const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', {
      fileid: file.fileid!,
      forcedownload: true,
      maxspeed: 5000000,
    });
    const link = `https://${linkRes.hosts[0]}${linkRes.path}`;
    const res = await fetch(link);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const hash = createHash('sha1').update(new Uint8Array(buf)).digest('hex');
    return hash;
  } catch {
    return null;
  }
}

const byHash = new Map<string, InvNode[]>();
for (const candidate of candidates) {
  const hash = await hashOf(candidate);
  if (!hash) continue;
  const group = byHash.get(hash) ?? [];
  group.push(candidate);
  byHash.set(hash, group);
  process.stderr.write(`  ${hash.slice(0, 10)}  ${candidate.path.replace('/Pharmacie/', '')}\n`);
}

const groups = [...byHash.values()]
  .filter((group) => group.length > 1)
  .map((group) => ({
    hash: createHash('sha1')
      .update(group[0].name)
      .digest('hex'),
    size: group[0].size,
    members: group.map((f) => ({ fileid: f.fileid, path: f.path, name: f.name })),
  }));

await writeFile(outJson, JSON.stringify({ groups }, null, 1));
process.stderr.write(`\n${groups.length} group(s) of identical archives\n`);
for (const group of groups) {
  process.stderr.write(`  ${(group.size! / 1024 / 1024).toFixed(1)} MB\n`);
  for (const member of group.members) {
    process.stderr.write(`    ${member.path.replace('/Pharmacie/', '')}\n`);
  }
}
