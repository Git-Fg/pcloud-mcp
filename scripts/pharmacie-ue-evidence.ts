/**
 * Shows what the legacy teaching-unit folders actually contain.
 *
 * The teaching-unit numbering changed between the third and the fourth year
 * (UE8 is pharmacognosie in one and pharmacie appliquée in the other), so
 * the migration rules need the evidence rather than an assumption.
 *
 * Usage: bun run scripts/pharmacie-ue-evidence.ts [inventory]
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

const CANONICAL = /^\/Pharmacie\/(3A|4A|5A)\/(S1|S2)\/UE-[A-Z0-9-]+\//;
const legacy = (path: string): boolean => !CANONICAL.test(path);

/** Teaching-unit folders, keyed by their bare name. */
const unitFolders = dirs.filter((d) => legacy(d.path) && /^UE ?[0-9]/.test(d.name) && !/^UE-[A-Z0-9-]+$/.test(d.name));

for (const folder of unitFolders) {
  const descendants = files.filter((f) => f.path.startsWith(`${folder.path}/`));
  if (descendants.length < 20) continue;
  // The year the material belongs to.
  const year = folder.path.includes('/3A/') ? '3A' : folder.path.includes('/4A/') ? '4A' : folder.path.includes('/5A/') ? '5A' : '?';
  const words = new Map<string, number>();
  for (const file of descendants) {
    for (const word of file.name.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? []) {
      words.set(word, (words.get(word) ?? 0) + 1);
    }
  }
  const top = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(
    `${year} | ${folder.name.padEnd(46)} | n=${String(descendants.length).padStart(4)} | ${top.map(([w, c]) => `${w}:${c}`).join(' ')}`
  );
}
