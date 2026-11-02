/**
 * Builds a move plan out of paths, taking every fileid from the inventory.
 *
 * A plan that carries fileids is a trap: the id in the tree is the one
 * pCloud accepts, and an id typed by hand can be off by its leading digits.
 * pCloud then answers 2009 "File not found" on a file that is plainly there.
 * This script reads the paths a plan asks for, looks each one up in the
 * inventory, and writes the plan back with the id the tree holds.
 *
 * Usage: bun run scripts/pharmacie-plan-from-paths.ts [spec] [inventory] [out]
 *
 * spec: { "moves": [ { "from": "<path>", "toPath": "<path>", "toname": "<name>", "reason": "<text>" } ] }
 */
import { readFile, writeFile } from 'node:fs/promises';

interface SpecMove {
  from: string;
  toPath: string;
  toname?: string;
  reason?: string;
}

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  fileid?: number;
  children?: InvNode[];
}

const specPath = process.argv[2];
const inventoryPath = process.argv[3];
const outPath = process.argv[4];
if (!specPath || !inventoryPath || !outPath) {
  throw new Error('usage: pharmacie-plan-from-paths.ts <spec> <inventory> <out>');
}

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function flat(list: InvNode[]): void {
  for (const node of list) {
    if (!node.isfolder) files.push(node);
    if (node.children) flat(node.children);
  }
})(roots);

// pCloud stores names in NFD; a plan written in NFC has to meet them there.
const byPath = new Map<string, InvNode>();
for (const file of files) byPath.set(file.path.normalize('NFC'), file);

const spec = JSON.parse(await readFile(specPath, 'utf8')) as { moves: SpecMove[] };

const moves = spec.moves.map((move) => {
  const node = byPath.get(move.from.normalize('NFC'));
  if (!node) throw new Error(`not in inventory: ${move.from}`);
  if (node.fileid === undefined) throw new Error(`no fileid in inventory: ${move.from}`);
  return {
    id: node.fileid,
    from: move.from,
    toPath: move.toPath,
    ...(move.toname ? { toname: move.toname } : {}),
    ...(move.reason ? { reason: move.reason } : {}),
  };
});

await writeFile(outPath, JSON.stringify({ moves }, null, 1));
process.stderr.write(`${moves.length} moves written to ${outPath}\n`);
