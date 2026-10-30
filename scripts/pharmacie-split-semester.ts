/**
 * Splits the third-year material between its two semesters.
 *
 * The third year keeps its material at the level of the year, because the
 * legacy tree said nothing about the semester. The programme does: the
 * first semester holds the units one to six, the second the units seven to
 * twelve. A file that names its unit in its own name says which semester
 * it belongs to; a file that does not follows the unit it sits in.
 *
 * The tree keeps its shape: only the semester segment is added, so
 * "3A/UE-02-PAM/Cours/…" becomes "3A/S2/UE-02-PAM/Cours/…".
 *
 * Usage: bun run scripts/pharmacie-split-semester.ts [inventory] [out] [--apply]
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
  kind: 'file';
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  reason: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-19.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-semester-plan.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const index = indexInventory(roots);
const nameBook = new NameBook(index);

/** The semester a unit number belongs to in the third year. */
const semesterOfUnit = (number: number): 'S1' | 'S2' => (number <= 6 ? 'S1' : 'S2');

/** The third-year files that sit at the level of the year. */
const yearLevel = files.filter((f) => /^\/Pharmacie\/3A\/UE-[0-9]{2}-[A-Z-]+\//.test(f.path));

/** The unit each file sits in, and the unit number it declares, if any. */
const unitOf = (path: string): string => path.match(/\/UE-[0-9]{2}-[A-Z-]+/)![0];
const declaredUnit = (name: string): number | null => {
  const match = name.match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/i);
  return match ? Number(match[1]) : null;
};

// The unit most of the files of each unit declare; the files that declare
// nothing follow it.
const votes = new Map<string, Map<number, number>>();
for (const file of yearLevel) {
  const declared = declaredUnit(file.name);
  if (declared === null) continue;
  const unit = unitOf(file.path);
  const counts = votes.get(unit) ?? new Map<number, number>();
  counts.set(declared, (counts.get(declared) ?? 0) + 1);
  votes.set(unit, counts);
}
const majority = new Map<string, 'S1' | 'S2'>();
for (const [unit, counts] of votes) {
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  majority.set(unit, semesterOfUnit(best));
}

const moves: MoveOp[] = [];
const foldersToCreate = new Map<string, { path: string; name: string; parentPath: string; parentid: number }>();
const undecided: string[] = [];

function ensureFolder(targetPath: string): number | null {
  const known = index.idByPath.get(targetPath);
  if (known !== undefined) return known;
  const parentPath = targetPath.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = ensureFolder(parentPath);
  if (parentId === null) return null;
  if (!foldersToCreate.has(targetPath)) {
    foldersToCreate.set(targetPath, { path: targetPath, name: targetPath.slice(parentPath.length + 1), parentPath, parentid: parentId });
  }
  return 0;
}

for (const file of yearLevel) {
  const unit = unitOf(file.path);
  const declared = declaredUnit(file.name);
  const semester = declared !== null ? semesterOfUnit(declared) : majority.get(unit);
  if (!semester) {
    undecided.push(file.path);
    continue;
  }

  const rest = file.path.replace(/^\/Pharmacie\/3A\//, '');
  const target = `/Pharmacie/3A/${semester}/${rest}`;
  const targetId = ensureFolder(target);
  if (targetId === null) continue;

  moves.push({
    kind: 'file',
    id: file.fileid!,
    from: file.path,
    toPath: target,
    toFolderid: targetId,
    toname: nameBook.claim(target, file.name, freeName),
    reason: `${semester} from ${file.path}`,
  });
}

const bySemester = moves.reduce<Record<string, number>>((acc, move) => {
  const semester = move.reason.split(' ')[0];
  acc[semester] = (acc[semester] ?? 0) + 1;
  return acc;
}, {});

await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()], undecided }, null, 1));
process.stderr.write(`${moves.length} files to place (${JSON.stringify(bySemester)}), ${foldersToCreate.size} folders to create, ${undecided.length} undecided\n`);
for (const path of undecided) process.stderr.write(`  undecided ${path}\n`);

if (!apply) {
  process.stderr.write(`Wrote ${outJson}\n`);
  process.exit(0);
}

const client = new PcloudHttpClient();
const created = new Map<string, number>();

async function ensureCreated(path: string): Promise<number | null> {
  const known = index.idByPath.get(path) ?? created.get(path);
  if (known !== undefined) return known;
  const parentPath = path.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = await ensureCreated(parentPath);
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
    const destination = await ensureCreated(move.toPath);
    if (destination === null) throw new Error(`destination unreachable: ${move.toPath}`);
    await client.json('renamefile', { fileid: move.id, tofolderid: destination, toname: move.toname });
    applied += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${move.from}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}
process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
