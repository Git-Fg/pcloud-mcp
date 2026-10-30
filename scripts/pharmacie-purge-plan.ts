/**
 * Builds the cleanup plan for the pCloud Pharmacie tree.
 *
 * Two kinds of entry need attention:
 *
 *  - Junk: version-control internals, Python caches, runtime logs, leftover
 *    download stubs and mojibake file names. These are deleted.
 *  - Misnamed: conversion output folders that hold real course material but
 *    carry a tool name ("ilovepdf-word-to-pdf"). These are renamed.
 *
 * Usage: bun run scripts/pharmacie-purge-plan.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface PurgePlan {
  deleteDirs: Array<{ folderid: number; path: string }>;
  deleteFiles: Array<{ fileid: number; path: string }>;
  renameDirs: Array<{ folderid: number; path: string; toname: string }>;
  renameFiles: Array<{ fileid: number; path: string; toname: string }>;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-3.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-purge-plan.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const nodes: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    nodes.push(node);
    if (node.isfolder) walk(node.children ?? []);
  }
})(roots);

const JUNK_DIR = /(^|\/)(\.git|__pycache__|\.conda|node_modules|\.venv|\.mypy_cache|\.pytest_cache|ipynb_checkpoints|logs?)(\/|$)/i;
const JUNK_FILE = /\.(pyc|pyo|conda|swp|bak|tmp|log)$/i;

/** Folders named after a conversion tool that hold real course material. */
const TOOL_FOLDERS: Array<[RegExp, string]> = [
  [/^ilovepdf-word-to-pdf( \(\d+\))?$/i, 'Conversion PDF (iLovePDF)'],
  [/^ilovepdf-pdf-to-word( \(\d+\))?$/i, 'Conversion Word (iLovePDF)'],
  [/^ILOVEPDF_SPLIT$/i, 'Découpage PDF (iLovePDF)'],
  [/^drive-download-\d+T\d+Z-\d+$/i, 'Téléchargement Drive'],
  [/^Fiche #1-\d+T\d+Z-\d+$/i, 'Fiche #1'],
];

const deleteDirs: PurgePlan['deleteDirs'] = [];
const deleteFiles: PurgePlan['deleteFiles'] = [];
const renameDirs: PurgePlan['renameDirs'] = [];
const renameFiles: PurgePlan['renameFiles'] = [];

/** Folders whose content decides whether they are junk or merely misnamed. */
const toolFolderCandidates = nodes.filter(
  (n) => n.isfolder && TOOL_FOLDERS.some(([pattern]) => pattern.test(n.name))
);

/** True when a folder and everything below it holds no file at all. */
function hasFiles(folder: InvNode): boolean {
  for (const child of folder.children ?? []) {
    if (!child.isfolder) return true;
    if (hasFiles(child)) return true;
  }
  return false;
}

for (const folder of toolFolderCandidates) {
  const match = TOOL_FOLDERS.find(([pattern]) => pattern.test(folder.name))!;
  const toname = match[1];
  if (!hasFiles(folder)) {
    // An empty conversion stub carries nothing worth keeping.
    deleteDirs.push({ folderid: folder.folderid!, path: folder.path });
  } else {
    renameDirs.push({ folderid: folder.folderid!, path: folder.path, toname });
  }
}

for (const node of nodes) {
  if (node.isfolder) {
    // A junk folder is removed whole, children included.
    if (JUNK_DIR.test(node.path)) {
      deleteDirs.push({ folderid: node.folderid!, path: node.path });
    }
    continue;
  }
  if (node.path.includes('/.git/')) continue;
  const junk = JUNK_FILE.test(node.name);
  const mojibake = !/[A-Za-z0-9]/.test(node.name);
  const emptyScript = node.size === 0 && /\.(py|sh|js|ts)$/i.test(node.name);
  if (junk || mojibake || emptyScript || node.name === 'db-shm') {
    deleteFiles.push({ fileid: node.fileid!, path: node.path });
  }
}

/** Removes the junk folders a parent deletion already covers. */
const covered = new Set<string>();
const topLevelDeletions = deleteDirs.filter((d) => {
  for (const other of deleteDirs) {
    if (other === d) continue;
    if (d.path.startsWith(`${other.path}/`)) return false;
  }
  return true;
});

const plan: PurgePlan = {
  deleteDirs: topLevelDeletions,
  deleteFiles: deleteFiles.filter((f) => {
    for (const dir of topLevelDeletions) {
      if (f.path.startsWith(`${dir.path}/`)) {
        covered.add(f.path);
        return false;
      }
    }
    return true;
  }),
  renameDirs,
  renameFiles,
};

await writeFile(outJson, JSON.stringify(plan, null, 1));
process.stderr.write(`Wrote ${outJson}\n`);
process.stderr.write(`  delete dirs:   ${plan.deleteDirs.length}\n`);
process.stderr.write(`  delete files:  ${plan.deleteFiles.length}\n`);
process.stderr.write(`  rename dirs:   ${plan.renameDirs.length}\n`);
for (const d of plan.deleteDirs) process.stderr.write(`    DEL DIR  ${d.path.replace('/Pharmacie/', '')}\n`);
for (const f of plan.deleteFiles) process.stderr.write(`    DEL FILE ${f.path.replace('/Pharmacie/', '')}\n`);
for (const d of plan.renameDirs) {
  process.stderr.write(`    REN DIR  ${d.path.replace('/Pharmacie/', '')} -> ${d.toname}\n`);
}
