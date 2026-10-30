/**
 * Lists the pCloud entries that are storage artefacts rather than course
 * material: version-control internals, Python caches, runtime logs, editor
 * droppings and empty placeholders.
 *
 * Usage: bun run scripts/pharmacie-junk-scan.ts [inventory]
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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-3.json';
const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const nodes: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    nodes.push(node);
    if (node.isfolder) walk(node.children ?? []);
  }
})(roots);

const JUNK_DIR = /(^|\/)(\.git|__pycache__|\.conda|node_modules|\.venv|\.mypy_cache|\.pytest_cache|ipynb_checkpoints|logs?)(\/|$)/i;
const JUNK_FILE = /\.(pyc|pyo|conda|swp|bak|tmp)$/i;
const ODD_DIR = /^(ilovepdf|drive-download|Fiche #1-|\.DS_Store)/i;

const junkDirs = nodes.filter((n) => n.isfolder && JUNK_DIR.test(n.path));
const junkFiles = nodes.filter((n) => !n.isfolder && JUNK_FILE.test(n.name));
const oddDirs = nodes.filter((n) => n.isfolder && ODD_DIR.test(n.name));
const zeroFiles = nodes.filter((n) => !n.isfolder && n.size === 0);
const mojibakeFiles = nodes.filter(
  (n) => !n.isfolder && !/[A-Za-z0-9]/.test(n.name)
);

const section = (title: string, list: InvNode[]) => {
  console.log(`=== ${title}: ${list.length} ===`);
  for (const n of list) {
    console.log(`  ${n.isfolder ? 'DIR ' : 'FILE'} ${n.folderid ?? n.fileid} ${n.path.replace('/Pharmacie/', '')}`);
  }
};

section('junk dirs', junkDirs);
section('junk files', junkFiles);
section('odd-named dirs', oddDirs);
section('zero-byte files', zeroFiles);
section('mojibake-named files', mojibakeFiles);
