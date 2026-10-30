/**
 * Takes the extra nesting out of a tree that got it by mistake.
 *
 * A move that builds its destination from the whole path ends up creating a
 * folder for the file it is about to move, and the file lands inside a
 * folder that bears its own name. When the unit folder is repeated as
 * well, the document sits one level too deep, twice.
 *
 * This script moves each document back to the place the tree describes and
 * leaves the empty folders behind for the pruning to remove. No document is
 * renamed and none is lost: every move is a move inside the same year.
 *
 * Usage: bun run scripts/pharmacie-repair-nested.ts [inventory] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { indexInventory, NameBook } from './lib/inventory.js';
import { freeName } from './lib/naming.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  children?: InvNode[];
}

interface MoveOp {
  id: number;
  from: string;
  toPath: string;
  toname: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-21.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-repair.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const files: InvNode[] = [];
const dirs: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      dirs.push(node);
      walk(node.children ?? []);
    } else {
      files.push(node);
    }
  }
})(roots);

const index = indexInventory(roots);
const nameBook = new NameBook(index);

const moves: MoveOp[] = [];

for (const file of files) {
  const segments = file.path.split('/');

  // A document inside a folder that bears its own name: the folder is the
  // accident, the document goes back one level.
  const inNamedFolder = segments.length >= 2 && segments[segments.length - 1] === segments[segments.length - 2];
  if (!inNamedFolder) continue;

  const withoutNamedFolder = segments.slice(0, -1);

  // A unit folder repeated twice: one of them is the accident.
  let target = withoutNamedFolder;
  for (let i = 1; i < target.length - 1; i += 1) {
    if (/^UE-[0-9]{2}-[A-Z-]+$/.test(target[i]) && target[i] === target[i + 1]) {
      target = [...target.slice(0, i + 1), ...target.slice(i + 2)];
      break;
    }
  }

  const toPath = target.join('/');
  if (toPath === file.path) continue;

  moves.push({
    id: file.fileid!,
    from: file.path,
    toPath,
    toname: nameBook.claim(toPath, file.name, freeName),
  });
}

await writeFile(outJson, JSON.stringify({ moves }, null, 1));
process.stderr.write(`${moves.length} documents to bring back up\n`);
for (const move of moves.slice(0, 10)) {
  process.stderr.write(`  ${move.from.replace('/Pharmacie/', '')}\n    -> ${move.toPath.replace('/Pharmacie/', '')}\n`);
}
if (moves.length > 10) process.stderr.write(`  ... and ${moves.length - 10} more\n`);

if (!apply) {
  process.stderr.write(`Wrote ${outJson}\n`);
  process.exit(0);
}

const client = new PcloudHttpClient();
const created = new Map<string, number>();

async function ensureFolder(path: string): Promise<number | null> {
  const known = index.idByPath.get(path) ?? created.get(path);
  if (known !== undefined) return known;
  const parentPath = path.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = await ensureFolder(parentPath);
  if (parentId === null) return null;
  const name = path.slice(parentPath.length + 1);
  const response = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
    folderid: parentId,
    name,
  });
  created.set(path, response.metadata.folderid);
  return response.metadata.folderid;
}

let applied = 0;
let failed = 0;
for (const move of moves) {
  try {
    const destination = await ensureFolder(move.toPath.replace(/\/[^/]+$/, ''));
    if (destination === null) throw new Error(`destination unreachable: ${move.toPath}`);
    await client.json('renamefile', { fileid: move.id, tofolderid: destination, toname: move.toname });
    applied += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${move.from}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}
process.stderr.write(`Moved ${applied}, failed ${failed}\n`);
