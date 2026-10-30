/**
 * Shows the canonical and legacy "Certificat de synthèse" folders side by
 * side, so the migration can map one onto the other.
 *
 * Usage: bun run scripts/pharmacie-csp-map.ts [inventory]
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

console.log('=== canonical /Pharmacie/5A/CSP ===');
for (const dir of dirs.filter((d) => d.path.startsWith('/Pharmacie/5A/CSP'))) {
  console.log('  ', dir.path.replace('/Pharmacie/5A/CSP', '') || '/', 'files=' + (under.get(dir.path) ?? 0));
}

console.log('\n=== legacy CSP folders ===');
for (const dir of dirs.filter((d) => /\/(3A|4A|5A)\/CSP-/.test(d.path))) {
  console.log('  ', String(under.get(dir.path) ?? 0).padStart(5), dir.path.replace('/Pharmacie/', ''));
}
