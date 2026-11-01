/**
 * Plans the removal of pCloud's copy-artefact " (N)" name suffixes.
 *
 * Uploading a file whose name is already taken makes pCloud append " (2)",
 * " (3)" and so on. When the original is later renamed away, the suffix is
 * left behind on a file that has no twin, and it says nothing about the file
 * any more. Where a twin does survive, the suffix is what keeps the two apart,
 * so it stays.
 *
 * The plan names, for every file and folder whose suffix can go, the name it
 * should carry instead. It is written in the shape `pharmacie-apply-purge.ts`
 * reads, so the two run in sequence:
 *
 *   bun run scripts/pharmacie-strip-copy-suffixes.ts [inventory] [plan]
 *   bun run scripts/pharmacie-apply-purge.ts [plan]
 */
import { readFile, writeFile } from 'node:fs/promises';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory.json';
const planPath = process.argv[3] ?? '/tmp/pharmacie-strip-copy-suffixes.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirPathById = new Map<number, string>();
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      if (node.folderid !== undefined) dirPathById.set(node.folderid, node.path);
      walk(node.children ?? []);
    } else {
      files.push(node);
    }
  }
})(roots);

/**
 * pCloud's copy counter is a small number. A four-digit number in the same
 * place is a year the name carries on purpose, and taking it off would throw
 * that meaning away.
 */
function isCopyCounter(text: string): boolean {
  if (text.length === 4 && Number(text) >= 1900 && Number(text) <= 2099) return false;
  return true;
}

// A suffix is only dropped when the name it would leave behind is free.
const siblingFolderNames = new Map<string, Set<string>>();
for (const path of dirPathById.values()) {
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (!siblingFolderNames.has(parent)) siblingFolderNames.set(parent, new Set());
  siblingFolderNames.get(parent)!.add(path.slice(path.lastIndexOf('/') + 1));
}

const renameDirs: Array<{ folderid: number; path: string; toname: string }> = [];
for (const [folderid, path] of dirPathById) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const match = name.match(/^(.*) \((\d+)\)$/);
  if (!match || !isCopyCounter(match[2])) continue;
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (siblingFolderNames.get(parent)?.has(match[1])) continue;
  renameDirs.push({ folderid, path, toname: match[1] });
}

const siblingFileNames = new Map<string, Set<string>>();
for (const file of files) {
  const dir = file.path.slice(0, file.path.lastIndexOf('/'));
  if (!siblingFileNames.has(dir)) siblingFileNames.set(dir, new Set());
  siblingFileNames.get(dir)!.add(file.name);
}

const renameFiles: Array<{ fileid: number; path: string; toname: string }> = [];
const keptBecauseOfCollision: string[] = [];
for (const file of files) {
  const match = file.name.match(/^(.*) \(\d+\)(\.[A-Za-z0-9]+)$/);
  if (!match || file.fileid === undefined) continue;
  const stripped = match[1] + match[2];
  const dir = file.path.slice(0, file.path.lastIndexOf('/'));
  if (siblingFileNames.get(dir)?.has(stripped)) {
    keptBecauseOfCollision.push(file.path);
    continue;
  }
  renameFiles.push({ fileid: file.fileid, path: file.path, toname: stripped });
}

await writeFile(
  planPath,
  JSON.stringify({ deleteDirs: [], deleteFiles: [], renameDirs, renameFiles }, null, 1),
);

process.stderr.write(`${renameDirs.length} folder(s) and ${renameFiles.length} file(s) can lose the suffix\n`);
process.stderr.write(`${keptBecauseOfCollision.length} keep theirs because a twin already holds the name\n`);
process.stderr.write(`plan: ${planPath}\n`);
