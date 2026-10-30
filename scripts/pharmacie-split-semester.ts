/**
 * Puts the third-year material in the semester the programme gives it.
 *
 * The third year runs over two semesters: the first holds the units one to
 * six, the second the units seven to twelve. A document that names its unit,
 * in its own name or in the folder above it, therefore belongs to one
 * semester and no other. A document that names no unit follows the unit it
 * sits in.
 *
 * The tree keeps its shape: only the semester segment changes, so
 * "3A/UE-02-PAM/Cours/…" becomes "3A/S2/UE-02-PAM/Cours/…", and a document
 * that sits in the wrong semester moves to the other one.
 *
 * Usage: bun run scripts/pharmacie-split-semester.ts [inventory] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { indexInventory, NameBook } from './lib/inventory.js';
import { freeName } from './lib/naming.js';
import { semesterForUnit } from './lib/classify.js';
import { unitByNumber, resolveUnitNumberFromPath } from './lib/pathClassify.js';
import { thirdYearUnitFromText } from './lib/thirdYear.js';

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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-20.json';
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

/**
 * The third-year files that already sit in the canonical tree.
 *
 * The material still in the legacy folders has not found its unit yet; the
 * classification moves it, and the classification knows which semester it
 * belongs to.
 */
const thirdYear = files.filter((f) => /^\/Pharmacie\/3A\/(?:S1\/|S2\/)?UE-[0-9]{2}-[A-Z-]+\//.test(f.path));

/** The unit each file sits in, when it sits in one. */
const unitOf = (path: string): string | null => path.match(/\/UE-[0-9]{2}-[A-Z-]+/)?.[0] ?? null;

/**
 * The unit number a path segment names.
 *
 * The deepest segment that names a unit describes the material: a file in
 * "2. Chimie thérapeutique" belongs to unit two, whatever its own name says.
 */
const unitNumberIn = (segment: string): number | null => {
  const match = segment.match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/i);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= 12 ? number : null;
};

/**
 * The unit number that describes a file, from its own name up to its folder.
 *
 * The canonical unit folder is left out on purpose: its number comes from
 * the codebook, not from the programme the document was taught in.
 */
function declaredUnitNumber(path: string): { number: number; segment: string } | null {
  const number = resolveUnitNumberFromPath(path, '3A');
  if (number === null) return null;
  const segments = path.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (unitNumberIn(segments[i]) === number) return { number, segment: segments[i] };
  }
  return { number, segment: '' };
}

// The unit most of the files of each unit name; the files that name none
// follow it.
const votes = new Map<string, Map<number, number>>();
for (const file of thirdYear) {
  const declared = declaredUnitNumber(file.path);
  const unit = unitOf(file.path);
  if (!declared || !unit) continue;
  const counts = votes.get(unit) ?? new Map<number, number>();
  counts.set(declared.number, (counts.get(declared.number) ?? 0) + 1);
  votes.set(unit, counts);
}
const majority = new Map<string, number>();
for (const [unit, counts] of votes) {
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  majority.set(unit, best);
}

/**
 * The folders whose unit is not settled.
 *
 * A folder whose documents nearly all name the same unit settles itself.
 * A folder that carries several units does not: the subject of the
 * document is what decides there.
 */
const contested = new Set<string>();
for (const [unit, counts] of votes) {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const top = Math.max(...counts.values());
  if (total > 0 && top / total < 0.9) contested.add(unit);
}

/** The text a document carries, read from its first pages. */
async function extractText(file: InvNode): Promise<string> {
  const client = new PcloudHttpClient();
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.txt')) return '';
  try {
    const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', {
      fileid: file.fileid!,
      forcedownload: true,
      maxspeed: 5000000,
    });
    const res = await fetch(`https://${linkRes.hosts[0]}${linkRes.path}`);
    if (!res.ok) return '';
    if (name.endsWith('.pdf')) {
      const tmp = `/tmp/pharmacie-split-${file.fileid}.pdf`;
      await writeFile(tmp, new Uint8Array(await res.arrayBuffer()));
      const proc = Bun.spawn(['pdftotext', '-l', '3', '-q', tmp, '-'], { stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(proc.stdout).text();
      try { await Bun.file(tmp).delete(); } catch { /* the temporary copy is disposable */ }
      return text.slice(0, 8000);
    }
    return (await res.text()).slice(0, 8000);
  } catch {
    return '';
  }
}

const moves: MoveOp[] = [];
const foldersToCreate = new Map<string, { path: string; name: string; parentPath: string; parentid: number }>();
const undecided: string[] = [];
const conflicts: Array<{ path: string; declared: number; dominant: number }> = [];
let resolvedBySubject = 0;

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

for (const file of thirdYear) {
  const unit = unitOf(file.path);
  const declared = declaredUnitNumber(file.path);
  const dominant = unit ? majority.get(unit) : undefined;
  if (declared && dominant && declared.number !== dominant) {
    conflicts.push({ path: file.path, declared: declared.number, dominant });
  }

  let number = declared?.number ?? dominant;

  // A folder that carries several units does not settle its documents: the
  // subject of the document decides which one it belongs to.
  if (!declared && unit && contested.has(unit)) {
    const text = await extractText(file);
    const bySubject = thirdYearUnitFromText(text) ?? thirdYearUnitFromText(file.name.toLowerCase());
    if (bySubject !== null) {
      number = bySubject;
      resolvedBySubject += 1;
    }
  }

  if (!number) {
    undecided.push(file.path);
    continue;
  }

  const semester = semesterForUnit('3A', number);
  if (!semester) continue;

  // The unit the document names wins over the folder it sits in: a document
  // that says unit seven belongs with the cardiovascular teaching unit, even
  // when the export put it elsewhere. Two units that share a name in the
  // third year, like the first, second and eighth, are told apart by the
  // semester instead.
  const declaredUnit = unitByNumber(number, '3A');
  const currentUnit = unit ?? null;
  const targetUnit = declaredUnit ?? currentUnit;
  if (!targetUnit) {
    undecided.push(file.path);
    continue;
  }

  // The path below the year, with the semester segment removed: the
  // document keeps its place inside its unit folder.
  const below = file.path.replace(/^\/Pharmacie\/3A\/(?:S1\/|S2\/)?/, '');
  const rest = below.startsWith(`${targetUnit}/`)
    ? below.slice(targetUnit.length + 1)
    : below.replace(/^UE-[0-9]{2}-[A-Z-]+\//, '');
  const target = `/Pharmacie/3A/${semester}/${targetUnit}/${rest}`;
  const currentSemester = file.path.match(/^\/Pharmacie\/3A\/(S1|S2)\//)?.[1] ?? null;
  if (currentSemester === semester && currentUnit === targetUnit) continue;

  const targetId = ensureFolder(target);
  if (targetId === null) continue;

  moves.push({
    kind: 'file',
    id: file.fileid!,
    from: file.path,
    toPath: target,
    toFolderid: targetId,
    toname: nameBook.claim(target, file.name, freeName),
    reason: `${semester} (UE${number}) from ${file.path}`,
  });
}

const bySemester = moves.reduce<Record<string, number>>((acc, move) => {
  const semester = move.reason.split(' ')[0];
  acc[semester] = (acc[semester] ?? 0) + 1;
  return acc;
}, {});

process.stderr.write('\nwhat each unit folder holds, by the unit the documents name:\n');
for (const [unit, counts] of [...votes.entries()].sort()) {
  const breakdown = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `UE${n}:${c}`).join(' ');
  process.stderr.write(`  ${unit}  ${breakdown}\n`);
}

process.stderr.write('\neach unit folder, and how much of it states its unit:\n');
for (const unit of [...new Set(thirdYear.map((file) => unitOf(file.path)).filter(Boolean) as string[])].sort()) {
  const members = thirdYear.filter((file) => unitOf(file.path) === unit);
  const stated = members.filter((file) => declaredUnitNumber(file.path)).length;
  const dominant = majority.get(unit);
  const share = stated === 0 ? 0 : (votes.get(unit)?.get(dominant) ?? 0) / stated;
  process.stderr.write(
    `  ${unit.padEnd(18)} ${String(members.length).padStart(4)} files, ${String(stated).padStart(4)} state their unit` +
      `, dominant UE${dominant ?? '?'} at ${Math.round(share * 100)}%\n`
  );
}

await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()], undecided, conflicts }, null, 1));
process.stderr.write(`${moves.length} files to place (${JSON.stringify(bySemester)}), ${foldersToCreate.size} folders to create, ${undecided.length} undecided, ${conflicts.length} conflicting, ${resolvedBySubject} settled by their subject\n`);
for (const path of undecided) process.stderr.write(`  undecided ${path}\n`);
for (const conflict of conflicts) {
  process.stderr.write(`  conflict ${conflict.path.replace('/Pharmacie/', '')}: says UE${conflict.declared}, folder says UE${conflict.dominant}\n`);
}

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
