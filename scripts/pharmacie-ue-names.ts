/**
 * Lists the distinct legacy teaching-unit folder names, with the year they
 * belong to and how many files each holds. The mapping from those names to
 * the canonical units is written against this list.
 *
 * Usage: bun run scripts/pharmacie-ue-names.ts [inventory]
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
const yearOf = (path: string): string =>
  path.includes('/3A/') ? '3A' : path.includes('/4A/') ? '4A' : path.includes('/5A/') ? '5A' : '?';

const names = new Map<string, { years: Set<string>; files: number }>();
for (const dir of dirs) {
  if (CANONICAL.test(dir.path)) continue;
  if (!/^UE ?[0-9]|^UEI[0-9]|^CSP[- ]/i.test(dir.name)) continue;
  const count = under.get(dir.path) ?? 0;
  if (count === 0) continue;
  const key = dir.name;
  const entry = names.get(key) ?? { years: new Set<string>(), files: 0 };
  entry.years.add(yearOf(dir.path));
  entry.files += count;
  names.set(key, entry);
}

for (const [name, entry] of [...names.entries()].sort((a, b) => b[1].files - a[1].files)) {
  console.log(String(entry.files).padStart(6), [...entry.years].join('/').padEnd(7), name);
}
console.log(`total ${names.size} distinct names`);
