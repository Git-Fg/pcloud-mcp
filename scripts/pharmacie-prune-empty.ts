/**
 * Removes the folders the reorganising left empty.
 *
 * A folder that holds nothing is noise in a tree the reader navigates by
 * eye: it looks like a unit that has no material yet. The folders that are
 * part of the canonical skeleton are kept even when they are empty, because
 * they are where the material of a unit is expected to land.
 *
 * The folders are deleted deepest first, because a folder can only be
 * removed once it holds nothing.
 *
 * Usage: bun run scripts/pharmacie-prune-empty.ts [inventory] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  children?: InvNode[];
}

/**
 * The folders that belong to the canonical skeleton. They are kept when
 * they are empty: the year roots, the CSP revision container and the unit
 * slots at the level of a year.
 */
const KEPT = [
  /^\/Pharmacie\/(3A|4A|5A)$/,
  /^\/Pharmacie\/(3A|4A|5A)\/CSP$/,
  /^\/Pharmacie\/(3A|4A|5A)\/UE-[0-9]{2}-[A-Z-]+$/,
];

const isKept = (path: string): boolean => KEPT.some((pattern) => pattern.test(path));

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-9.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-prune-empty.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirs: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      dirs.push(node);
      walk(node.children ?? []);
    }
  }
})(roots);

const empty = dirs.filter((dir) => (dir.children ?? []).length === 0);
const doomed = empty
  .filter((dir) => !isKept(dir.path))
  .sort((a, b) => b.path.split('/').length - a.path.split('/').length);

const kept = empty.filter((dir) => isKept(dir.path));

await writeFile(
  outJson,
  JSON.stringify(
    {
      removed: doomed.map((dir) => ({ folderid: dir.folderid, path: dir.path })),
      kept: kept.map((dir) => ({ folderid: dir.folderid, path: dir.path })),
    },
    null,
    1,
  ),
);

process.stderr.write(`Empty folders: ${empty.length} (${doomed.length} to remove, ${kept.length} kept)\n`);
for (const dir of kept) process.stderr.write(`  keep ${dir.path}\n`);
if (!apply) {
  process.stderr.write(`Wrote ${outJson}\n`);
  process.exit(0);
}

const client = new PcloudHttpClient();
let removed = 0;
let failed = 0;
for (const dir of doomed) {
  try {
    await client.json('deletefolder', { folderid: dir.folderid });
    removed += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${dir.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}
process.stderr.write(`Removed ${removed}, failed ${failed}\n`);
