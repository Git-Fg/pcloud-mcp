/**
 * Classifies the remaining transverse Pharmacie files using path context.
 *
 * The legacy tree encodes the teaching unit in the folder names above the
 * file. This script reads those path signals (deepest first) and maps them
 * to the canonical 12-unit codebook, then emits a move plan.
 *
 * Usage: bun run scripts/pharmacie-classify-transverse.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { detectYear, detectSemester, detectDocType } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/classify.js';
import { resolveUnitFromPath } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/pathClassify.js';
import { indexInventory, NameBook } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/inventory.js';
import { freeName } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/naming.js';

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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-12.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-transverse-plan.json';

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

const index = indexInventory(roots);
const nameBook = new NameBook(index);

const CANONICAL_UNIT = /^\/Pharmacie\/(3A|4A|5A)(\/(S1|S2))?\/UE-[0-9]{2}-[A-Z-]+/;
const CANONICAL_CSP = /^\/Pharmacie\/(3A|4A|5A)\/CSP\//;
const isCanonical = (path: string): boolean => CANONICAL_UNIT.test(path) || CANONICAL_CSP.test(path);

/** Every file not already in the canonical tree. */
const unclassified = files.filter((f) => !isCanonical(f.path));

/** Build the move plan. */
const moves: MoveOp[] = [];
const foldersToCreate = new Map<string, { path: string; name: string; parentPath: string; parentid: number }>();

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

let classified = 0;
for (const file of unclassified) {
  const unit = resolveUnitFromPath(file.path);
  if (!unit) continue;

  const docType = detectDocType(file.name) ?? 'Cours';
  const year = detectYear(file.path) ?? '4A';
  const semester = detectSemester(file.path);
  const base = `/Pharmacie/${year}${semester ? `/${semester}` : ''}/${unit}`;
  const target = `${base}/${docType}`;
  const targetId = ensureFolder(target);
  if (targetId === null) continue;

  moves.push({
    kind: 'file',
    id: file.fileid!,
    from: file.path,
    toPath: target,
    toFolderid: targetId,
    toname: nameBook.claim(target, file.name, freeName),
    reason: `${unit}/${docType} from ${file.path}`,
  });
  classified += 1;
}

console.log(`Classified ${classified}/${unclassified.length} files`);
console.log(`Folders to create: ${foldersToCreate.size}`);

const byUnit = new Map<string, number>();
for (const m of moves) { const u = m.reason.split('/')[0]; byUnit.set(u, (byUnit.get(u) ?? 0) + 1); }
for (const [k, v] of [...byUnit].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);

await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()] }, null, 1));
console.log(`Written ${outJson}`);
