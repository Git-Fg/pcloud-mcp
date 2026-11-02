/**
 * Writes the full inventory of a pCloud tree as a flat JSON file.
 *
 * The tree inventory the curation scripts work from keeps the hierarchy.
 * This one flattens it: one entry per file, with its path, size, content
 * hash and type. It is the list a later cleanup pass starts from, so it
 * holds every file of the tree, not only the ones a plan touches.
 *
 * Usage: bun run scripts/pharmacie-write-full-inventory.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  size?: number;
  hash?: number;
  contenttype?: string;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory.json';
const outPath = process.argv[3] ?? '/tmp/pharmacie-full-inventory.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function flat(list: InvNode[]): void {
  for (const node of list) {
    if (!node.isfolder) files.push(node);
    if (node.children) flat(node.children);
  }
})(roots);

const entries = files.map((file) => ({
  path: file.path,
  name: file.name,
  size: file.size ?? 0,
  hash: file.hash === undefined ? null : String(file.hash),
  contenttype: file.contenttype ?? null,
}));

entries.sort((a, b) => a.path.localeCompare(b.path, 'fr'));

await writeFile(
  outPath,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      root: '/Pharmacie',
      count: entries.length,
      files: entries,
    },
    null,
    1
  )
);
process.stderr.write(`${entries.length} files -> ${outPath}\n`);
