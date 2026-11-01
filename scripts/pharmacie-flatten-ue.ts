/**
 * Flattens the year trees onto one axis: the unit.
 *
 * A year held two axes at once — a folder per semester, each holding a
 * folder per unit, and a folder per unit straight under the year. The
 * second axis was where the reorganisation put the material it could not
 * attribute to a semester; the first was where the rest stayed. This script
 * lifts the semester folders' unit content up to the year level, so a unit
 * has one home, and leaves the semester folders holding only what is not a
 * unit (servers, recordings index, shared drives).
 *
 * Two files that want one name are not resolved by date: the corpus holds
 * the same course at two resolutions, and the full-resolution original is
 * usually the older one, because the compressed copy is a later export. The
 * larger file keeps the name and the smaller is deleted first, so pCloud
 * never replaces a file under a name that is still taken.
 *
 * Usage: bun run scripts/pharmacie-flatten-ue.ts [inventory] [outPlan] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { indexInventory } from './lib/inventory.js';
import { freeName } from './lib/naming.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  modified?: string;
  children?: InvNode[];
}

interface MoveOp {
  id: number;
  from: string;
  toPath: string;
  toname: string;
  size: number;
  modified?: string;
}

interface DeleteOp {
  id: number;
  path: string;
  size: number;
  reason: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-4.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-flatten.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const index = indexInventory(roots);

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const UNIT = /^UE-\d{2}-[A-Z-]+$/;

/**
 * Where a file lands once the semesters are lifted away: the unit folder
 * under the year, with the path below the unit kept as it is. A file that
 * already sits under the year keeps its place.
 */
function destination(path: string): string | null {
  const segments = path.split('/');
  const year = segments[2];
  const semester = segments[3];
  if (year === undefined || semester === undefined) return null;
  const unitIndex = segments.findIndex((segment) => UNIT.test(segment));
  if (unitIndex < 0) return null;
  const underSemester = semester === 'S1' || semester === 'S2';
  if (!underSemester) return path;
  return [segments[0], segments[1], year, segments[unitIndex], ...segments.slice(unitIndex + 1)].join('/');
}

/** Files that land in the same folder under the same name. */
const byFolderAndName = new Map<string, InvNode[]>();

for (const file of files) {
  const target = destination(file.path);
  if (!target) continue;
  const folder = target.replace(/\/[^/]+$/, '');
  const key = `${folder} ${file.name}`;
  const list = byFolderAndName.get(key) ?? [];
  list.push(file);
  byFolderAndName.set(key, list);
}

const moves: MoveOp[] = [];
const deletes: DeleteOp[] = [];

/** The names each destination folder will hold once the losers are gone. */
const namesAtDestination = new Map<string, Set<string>>();

for (const [, group] of byFolderAndName) {
  const sorted = [...group].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  const winner = sorted[0];
  for (const loser of sorted.slice(1)) {
    deletes.push({
      id: loser.fileid!,
      path: loser.path,
      size: loser.size ?? 0,
      reason: 'smaller copy of a name the larger copy claims',
    });
  }
  const winnerTarget = destination(winner.path)!;
  const winnerFolder = winnerTarget.replace(/\/[^/]+$/, '');
  const names = namesAtDestination.get(winnerFolder) ?? new Set<string>();
  names.add(winner.name);
  namesAtDestination.set(winnerFolder, names);
  if (winner.path === winnerTarget) continue;
  moves.push({
    id: winner.fileid!,
    from: winner.path,
    toPath: winnerTarget,
    toname: winner.name,
    size: winner.size ?? 0,
    modified: winner.modified,
  });
}

// A name is only free at the destination when the file that held it there
// is one of the deletions. Anything else keeps its name and the arriving
// file is numbered instead.
const deletedPaths = new Set(deletes.map((deletion) => deletion.path));
for (const move of moves) {
  const folder = move.toPath.replace(/\/[^/]+$/, '');
  const occupant = files.find(
    (file) =>
      file.path.replace(/\/[^/]+$/, '') === folder &&
      file.name === move.toname &&
      file.path !== move.from &&
      !deletedPaths.has(file.path),
  );
  if (!occupant) continue;
  const taken = index.namesByFolder.get(folder) ?? new Set<string>();
  move.toname = freeName(taken, move.toname);
}

process.stderr.write(`${moves.length} files to lift, ${deletes.length} copies to delete\n`);
for (const move of moves.slice(0, 6)) {
  process.stderr.write(`  ${move.from.replace('/Pharmacie/', '')}\n    -> ${move.toPath.replace('/Pharmacie/', '')}\n`);
}

await writeFile(outPlan, JSON.stringify({ moves, deletes }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to move the files.\n');
  process.exit(0);
}

const client = new PcloudHttpClient();
const folderIds = new Map<string, number>();

/** The identifier of a folder, created when missing. */
async function ensureFolder(path: string): Promise<number> {
  const known = folderIds.get(path) ?? index.idByPath.get(path);
  if (known !== undefined) {
    folderIds.set(path, known);
    return known;
  }
  const parentPath = path.replace(/\/[^/]+$/, '');
  const parentId = await ensureFolder(parentPath);
  const name = path.slice(parentPath.length + 1);
  const response = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
    folderid: parentId,
    name,
  });
  folderIds.set(path, response.metadata.folderid);
  return response.metadata.folderid;
}

// The losers go first: the name they hold has to be free before the
// survivor can take it.
for (const deletion of deletes) {
  try {
    await client.json('deletefile', { fileid: deletion.id });
  } catch (err) {
    process.stderr.write(`  FAIL delete ${deletion.path}: ${err instanceof Error ? err.message : err}\n`);
  }
}
process.stderr.write(`Deleted ${deletes.length} losers\n`);

let moved = 0;
let failed = 0;
for (const move of moves) {
  try {
    const destinationPath = move.toPath.replace(/\/[^/]+$/, '');
    const destinationId = await ensureFolder(destinationPath);
    await client.json('renamefile', { fileid: move.id, tofolderid: destinationId, toname: move.toname });
    moved += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${move.from}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
  if ((moved + failed) % 500 === 0) process.stderr.write(`  ${moved + failed}/${moves.length}\n`);
}
process.stderr.write(`Moved ${moved}, failed ${failed}\n`);
