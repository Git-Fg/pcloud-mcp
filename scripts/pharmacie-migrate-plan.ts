/**
 * Builds the migration plan that moves the legacy Pharmacie material into
 * the canonical structure.
 *
 * The legacy tree holds the material several Drive exports produced, under
 * folder names that say nothing about where it belongs. This plan maps every
 * legacy branch onto a canonical unit and kind of material, and moves the
 * material itself rather than the branch that holds it, so the canonical
 * tree ends up flat and readable:
 *
 *   4A/S1/UE-02-PAM/Cours/Chimie thérapeutique/…
 *
 * A folder whose name repeats the kind of material it holds is merged into
 * that material's folder, and every name is checked against the folder it
 * lands in so no file is ever overwritten.
 *
 * Nothing is deleted, and every move is recorded so it can be undone.
 *
 * Usage: bun run scripts/pharmacie-migrate-plan.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { detectCspSource, detectDocType, detectSemester, detectUnit, detectYear, type DocType, type Unit } from './lib/classify.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface MoveOp {
  /** A folder move keeps its content; a file move carries a single file. */
  kind: 'folder' | 'file';
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  files: number;
  reason: string;
}

interface MigratePlan {
  moves: MoveOp[];
  /** Canonical folders the plan needs before the moves can run. */
  foldersToCreate: Array<{ parentid: number; name: string; path: string }>;
  /** Legacy branches that could not be placed, with the reason. */
  unmapped: Array<{ path: string; files: number; reason: string }>;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-7.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-migrate-plan.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirs: InvNode[] = [];
const files: InvNode[] = [];
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

const filesUnder = new Map<string, number>();
for (const dir of dirs) filesUnder.set(dir.path, 0);
for (const file of files) {
  const segments = file.path.split('/');
  for (let i = 2; i < segments.length; i += 1) {
    const path = segments.slice(0, i).join('/');
    const count = filesUnder.get(path);
    if (count !== undefined) filesUnder.set(path, count + 1);
  }
}

/** The canonical tree: a year, an optional semester and a teaching unit. */
const CANONICAL_UNIT = /^\/Pharmacie\/(3A|4A|5A)(\/(S1|S2))?\/UE-[A-Z0-9-]+/;
/** The CSP revision container: a year and the revision sources it holds. */
const CANONICAL_CSP = /^\/Pharmacie\/(3A|4A|5A)\/CSP$/;
const isCanonical = (path: string): boolean => CANONICAL_UNIT.test(path) || CANONICAL_CSP.test(path);

/** Every folder of the inventory, so a destination can be resolved by path. */
const allIds = new Map<string, number>();
for (const dir of dirs) allIds.set(dir.path, dir.folderid!);

/** The names already present in a folder, so no move can overwrite one. */
const namesInFolder = new Map<string, Set<string>>();
for (const dir of dirs) {
  const parentPath = dir.path.replace(/\/[^/]+$/, '');
  const names = namesInFolder.get(parentPath) ?? new Set<string>();
  names.add(dir.name);
  namesInFolder.set(parentPath, names);
}
for (const file of files) {
  const parentPath = file.path.replace(/\/[^/]+$/, '');
  const names = namesInFolder.get(parentPath) ?? new Set<string>();
  names.add(file.name);
  namesInFolder.set(parentPath, names);
}

const moves: MoveOp[] = [];
const unmapped: MigratePlan['unmapped'] = [];
const foldersToCreate = new Map<string, { path: string; name: string; parentPath: string; parentid: number }>();
const claimed = new Set<string>();

/** A name that is free in the destination folder. */
function freeName(targetPath: string, wanted: string): string {
  let names = namesInFolder.get(targetPath);
  if (!names) {
    names = new Set<string>();
    namesInFolder.set(targetPath, names);
  }
  if (!names.has(wanted)) {
    names.add(wanted);
    return wanted;
  }
  const dot = wanted.lastIndexOf('.');
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
  const extension = dot > 0 ? wanted.slice(dot) : '';
  let n = 2;
  while (names.has(`${stem} (${n})${extension}`)) n += 1;
  const name = `${stem} (${n})${extension}`;
  names.add(name);
  return name;
}

/**
 * The identifier of a destination folder, whether it already exists or has
 * to be created.
 *
 * A missing folder is created together with the folders above it that are
 * missing too, so a destination can always be reached. A parent that itself
 * has to be created is recorded with the identifier zero, and the applier
 * resolves it from the folders it creates first.
 */
function ensureFolder(targetPath: string): number | null {
  const known = allIds.get(targetPath);
  if (known !== undefined) return known;

  const parentPath = targetPath.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = ensureFolder(parentPath);
  if (parentId === null) return null;

  if (!foldersToCreate.has(targetPath)) {
    foldersToCreate.set(targetPath, {
      path: targetPath,
      name: targetPath.slice(parentPath.length + 1),
      parentPath,
      parentid: parentId,
    });
  }
  return 0;
}

/**
 * Moves the material a legacy branch holds into the canonical tree.
 *
 * The branch is the folder that names a teaching unit; its children carry
 * the material. A child whose name repeats the kind of material is merged
 * into that material's folder instead of sitting inside it.
 */
function placeBranch(branch: InvNode): void {
  const segments = branch.path.split('/').filter(Boolean);
  const year = detectYear(branch.path);
  if (!year) return;
  const semester = detectSemester(branch.path);

  let unit: Unit | null = null;
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    const candidate = detectUnit(segments[i], year);
    if (candidate) {
      unit = candidate;
      break;
    }
  }
  if (!unit) return;

  const base = `/Pharmacie/${year}${semester ? `/${semester}` : ''}/${unit}`;
  const children = branch.children ?? [];
  if (children.length === 0) return;

  // The kind of material a branch holds is often named by the folder above
  // the unit, as in "Annales/UE7": the unit names the subject, the folder
  // above it names the kind.
  const branchParent = segments.length > 1 ? segments[segments.length - 2] : '';
  const inheritedDocType = detectDocType(branchParent);

  let placed = 0;
  for (const child of children) {
    // A file that sits directly under the branch is one file of material;
    // a folder holds everything below it.
    const childFiles = child.isfolder ? filesUnder.get(child.path) ?? 0 : 1;
    if (childFiles === 0) continue;

    const childDocType = detectDocType(child.name);
    const docType: DocType = childDocType ?? inheritedDocType ?? 'Cours';
    const target = `${base}/${docType}`;
    const targetId = ensureFolder(target);
    if (targetId === null) {
      unmapped.push({ path: child.path, files: childFiles, reason: `canonical unit missing: ${base}` });
      continue;
    }

    // A folder named after the material it holds is merged into it.
    if (child.isfolder && childDocType && child.name.toLowerCase() === docType.toLowerCase()) {
      for (const grandchild of child.children ?? []) {
        const grandchildFiles = filesUnder.get(grandchild.path) ?? 0;
        if (grandchildFiles === 0) continue;
        const name = freeName(target, grandchild.name);
        moves.push({
          kind: grandchild.isfolder ? 'folder' : 'file',
          id: grandchild.isfolder ? grandchild.folderid! : grandchild.fileid!,
          from: grandchild.path,
          toPath: target,
          toFolderid: targetId,
          toname: name,
          files: grandchildFiles,
          reason: `${unit}/${docType}`,
        });
        placed += grandchildFiles;
      }
      continue;
    }

    const name = freeName(target, child.name);
    moves.push({
      kind: child.isfolder ? 'folder' : 'file',
      id: child.isfolder ? child.folderid! : child.fileid!,
      from: child.path,
      toPath: target,
      toFolderid: targetId,
      toname: name,
      files: childFiles,
      reason: `${unit}/${docType}`,
    });
    placed += childFiles;
  }
  if (placed === 0) {
    unmapped.push({ path: branch.path, files: filesUnder.get(branch.path) ?? 0, reason: 'nothing placeable' });
  }
}

/**
 * Walks the legacy tree and places every branch that names a teaching unit.
 * The deepest branch that names one is the one that holds the material.
 */
function descend(dir: InvNode): void {
  if (isCanonical(dir.path)) return;
  const count = filesUnder.get(dir.path) ?? 0;
  if (count === 0) return;

  const year = detectYear(dir.path);
  const csp = detectCspSource(dir.path);

  if (csp && year) {
    // The CSP revision material is organised by its source.
    const target = `/Pharmacie/${year}/CSP`;
    const targetId = ensureFolder(target);
    if (targetId !== null) {
      const name = freeName(target, csp);
      moves.push({
        kind: 'folder',
        id: dir.folderid!,
        from: dir.path,
        toPath: target,
        toFolderid: targetId,
        toname: name,
        files: count,
        reason: `CSP/${csp}`,
      });
      claimed.add(dir.path);
      return;
    }
  }

  // The branch that names the unit is the one whose material is placed.
  const namesUnit = year !== null && detectUnit(dir.name, year) !== null;
  if (namesUnit) {
    placeBranch(dir);
    claimed.add(dir.path);
    return;
  }

  let descended = false;
  for (const child of dir.children ?? []) {
    if (!child.isfolder) continue;
    if ((filesUnder.get(child.path) ?? 0) === 0) continue;
    descended = true;
    descend(child);
  }
  if (!descended) {
    unmapped.push({ path: dir.path, files: count, reason: 'no teaching unit found' });
  }
}

for (const dir of dirs) {
  if (isCanonical(dir.path)) continue;
  let nested = false;
  for (const path of claimed) {
    if (dir.path.startsWith(`${path}/`)) {
      nested = true;
      break;
    }
  }
  if (nested) continue;
  const parentPath = dir.path.replace(/\/[^/]+$/, '');
  const parentIsLegacy = dirs.some((d) => d.path === parentPath && !isCanonical(d.path));
  if (parentIsLegacy) continue;
  descend(dir);
}

const plan: MigratePlan = {
  moves,
  foldersToCreate: [...foldersToCreate.values()],
  unmapped,
};
await writeFile(outJson, JSON.stringify(plan, null, 1));

const moved = moves.reduce((sum, m) => sum + m.files, 0);
const unmappedFiles = unmapped.reduce((sum, u) => sum + u.files, 0);
process.stderr.write(`Wrote ${outJson}\n`);
process.stderr.write(`  moves:           ${moves.length} entries, ${moved} files\n`);
process.stderr.write(`  folders to make: ${plan.foldersToCreate.length}\n`);
process.stderr.write(`  unmapped:        ${unmapped.length} branches, ${unmappedFiles} files\n`);
for (const move of moves.slice(0, 30)) {
  process.stderr.write(`    MOVE ${move.files.toString().padStart(5)} ${move.from.replace('/Pharmacie/', '')} -> ${move.toPath.replace('/Pharmacie/', '')}/${move.toname}\n`);
}
if (moves.length > 30) process.stderr.write(`    ... and ${moves.length - 30} more\n`);
