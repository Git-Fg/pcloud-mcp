/**
 * Removes the folders that hold nothing.
 *
 * The reorganisation and the flattening emptied a good many folders: a
 * unit that moved up to the year level leaves its old folder behind, and a
 * folder that only ever held files which have since been deleted stays
 * as an empty shell.
 *
 * A folder is removed only when it is empty and when every folder above it
 * is empty too, so the tree is pruned from the bottom up and no parent is
 * left pointing at nothing.
 *
 * Usage: bun run scripts/pharmacie-prune-empty.ts [inventory] [outPlan] [--apply]
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
  children?: InvNode[];
}

interface DeleteOp {
  folderid: number;
  path: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-6.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-prune-empty.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const empties: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      if (!node.children || node.children.length === 0) empties.push(node);
      walk(node.children ?? []);
    }
  }
})(roots);

const deletes: DeleteOp[] = empties
  .filter((node) => node.folderid !== undefined)
  .map((node) => ({ folderid: node.folderid!, path: node.path }));

process.stderr.write(`${deletes.length} empty folders to remove\n`);
for (const deletion of deletes.slice(0, 6)) {
  process.stderr.write(`  ${deletion.path.replace('/Pharmacie/', '')}\n`);
}

await writeFile(outPlan, JSON.stringify({ deletes }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to remove the folders.\n');
  process.exit(0);
}

const client = new PcloudHttpClient();
let removed = 0;
let failed = 0;
for (const deletion of deletes) {
  try {
    await client.json('deletefolder', { folderid: deletion.folderid });
    removed += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${deletion.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
  if ((removed + failed) % 100 === 0) process.stderr.write(`  ${removed + failed}/${deletes.length}\n`);
}
process.stderr.write(`Removed ${removed}, failed ${failed}\n`);
