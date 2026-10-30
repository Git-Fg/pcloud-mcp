/**
 * Surveys the legacy part of the pCloud Pharmacie tree.
 *
 * The canonical structure holds the material whose classification was
 * already known; everything else still lives in the folders the Drive
 * exports produced. This survey shows how the legacy material is laid out
 * so the migration rules can be written against real paths.
 *
 * Usage: bun run scripts/pharmacie-survey-legacy.ts [inventory]
 */
import { readFile } from 'node:fs/promises';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-7.json';
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

const under = new Map<string, number>();
for (const dir of dirs) under.set(dir.path, 0);
for (const file of files) {
  const segments = file.path.split('/');
  for (let i = 2; i < segments.length; i += 1) {
    const path = segments.slice(0, i).join('/');
    const count = under.get(path);
    if (count !== undefined) under.set(path, count + 1);
  }
}

const CANONICAL = /^\/Pharmacie\/(3A|4A|5A)\/(S1|S2)\/UE-[A-Z0-9-]+\//;
const isLegacy = (path: string): boolean => !CANONICAL.test(path);

/** Folder names that identify a teaching unit. */
const UE_LIKE = /^(UE ?[0-9]|UE-[0-9]|UEI[0-9]|CSP)/i;

const legacyFiles = files.filter((f) => isLegacy(f.path));
console.log(`legacy files: ${legacyFiles.length}`);

console.log('\n=== legacy folders that name a teaching unit ===');
const ueRows = dirs
  .filter((d) => UE_LIKE.test(d.name) && !/^UE-[A-Z0-9-]+$/.test(d.name))
  .map((d) => [d.path, under.get(d.path) ?? 0] as const)
  .filter(([, count]) => count > 0)
  .sort((a, b) => b[1] - a[1]);
for (const [path, count] of ueRows.slice(0, 40)) {
  console.log(String(count).padStart(6), path.replace('/Pharmacie/', ''));
}
console.log(`(total ${ueRows.length})`);

console.log('\n=== distinct legacy folder names holding files ===');
const byName = new Map<string, number>();
for (const dir of dirs) {
  if (!isLegacy(dir.path)) continue;
  const count = under.get(dir.path) ?? 0;
  if (count === 0) continue;
  byName.set(dir.name, (byName.get(dir.name) ?? 0) + count);
}
const nameRows = [...byName.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, count] of nameRows.slice(0, 60)) {
  console.log(String(count).padStart(6), name);
}
console.log(`(total ${nameRows.length} distinct names)`);
