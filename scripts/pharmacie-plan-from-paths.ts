/**
 * Builds a move plan out of paths, taking every fileid from the inventory.
 *
 * A plan that carries fileids is a trap: the id in the tree is the one
 * pCloud accepts, and an id typed by hand can be off by its leading digits.
 * pCloud then answers 2009 "File not found" on a file that is plainly there.
 * This script reads the paths a plan asks for, looks each one up in the
 * inventory, and writes the plan back with the id the tree holds.
 *
 * A move names its file either by its absolute path, or by its name inside a
 * folder. The second form keeps a plan readable when a hundred files move.
 *
 * Usage: bun run scripts/pharmacie-plan-from-paths.ts [spec] [inventory] [out]
 *
 * spec: { "moves": [ { "from": "<path>" | "name" + "fromFolder",
 *                      "toPath": "<path>", "toname": "<name>" } ] }
 */
import { readFile, writeFile } from 'node:fs/promises';

interface SpecMove {
  /** Absolute path of the file to move. */
  from?: string;
  /**
   * Name of the file to move, looked up inside `fromFolder`. pCloud stores
   * names in NFD, so the lookup compares normalised names.
   */
  name?: string;
  /** Folder the `name` is looked up in. */
  fromFolder?: string;
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

const byPath = new Map<string, InvNode>();
for (const file of files) byPath.set(file.path.normalize('NFC'), file);

/** The files of one folder, keyed by the normalised folder path and name. */
const byFolderAndName = new Map<string, InvNode>();
for (const file of files) {
  const folder = file.path.slice(0, file.path.lastIndexOf('/'));
  byFolderAndName.set((folder + '/' + file.name).normalize('NFC'), file);
}

const spec = JSON.parse(await readFile(specPath, 'utf8')) as { moves: SpecMove[] };

const moves = spec.moves.map((move) => {
  let node: InvNode | undefined;
  let from: string;
  if (move.from) {
    node = byPath.get(move.from.normalize('NFC'));
    from = move.from;
  } else if (move.name && move.fromFolder) {
    const folder = move.fromFolder.replace(/\/+$/, '');
    from = folder + '/' + move.name;
    node = byFolderAndName.get(from.normalize('NFC'));
  } else {
    throw new Error(
      `move needs either "from" or both "name" and "fromFolder": ${JSON.stringify(move)}`
    );
  }
  if (!node) throw new Error(`not in inventory: ${from}`);
  if (node.fileid === undefined) throw new Error(`no fileid in inventory: ${from}`);
  return {
    id: node.fileid,
    from: node.path,
    toPath: move.toPath,
    ...(move.toname ? { toname: move.toname } : {}),
    ...(move.reason ? { reason: move.reason } : {}),
  };
});

await writeFile(outPath, JSON.stringify({ moves }, null, 1));
process.stderr.write(`${moves.length} moves written to ${outPath}\n`);
