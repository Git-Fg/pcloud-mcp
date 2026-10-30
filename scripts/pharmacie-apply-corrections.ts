/**
 * Applies the corrective moves the content-classifier audit produced.
 *
 * The destination folders are created when they are missing, and every file
 * keeps its name: only its place changes. A file whose name already exists
 * in the destination is given a numbered variant, so nothing is overwritten.
 *
 * Usage: bun run scripts/pharmacie-apply-corrections.ts [plan] [manifest] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface Correction {
  id: number;
  name: string;
  fromUnit: string;
  toPath: string;
  rule: string;
}

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  children?: InvNode[];
}

const planPath = process.argv[2] ?? '/tmp/pharmacie-corrections.json';
const manifestPath = process.argv[3] ?? '/tmp/pharmacie-corrections-manifest.json';
const apply = process.argv.includes('--apply');
const inventoryArg = process.argv.slice(4).find((arg) => !arg.startsWith('--'));

const plan = JSON.parse(await readFile(planPath, 'utf8')) as { corrections: Correction[] };
const corrections = plan.corrections.filter((c) => c.toPath);

const inventoryPath = inventoryArg ?? '/tmp/pharmacie-inventory-18.json';
const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const dirs: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      dirs.push(node);
      walk(node.children ?? []);
    }
  }
})(roots);

const allIds = new Map<string, number>();
for (const dir of dirs) allIds.set(dir.path, dir.folderid!);

/** The names already in a folder, so a move never overwrites one. */
const namesInFolder = new Map<string, Set<string>>();
for (const dir of dirs) {
  const parent = dir.path.replace(/\/[^/]+$/, '');
  const names = namesInFolder.get(parent) ?? new Set<string>();
  names.add(dir.name);
  namesInFolder.set(parent, names);
}

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

if (!apply) {
  const byRule = corrections.reduce<Record<string, number>>((acc, c) => {
    acc[c.rule] = (acc[c.rule] ?? 0) + 1;
    return acc;
  }, {});
  process.stderr.write(`${corrections.length} corrections\n`);
  for (const [rule, count] of Object.entries(byRule)) {
    process.stderr.write(`  ${String(count).padStart(4)}  ${rule}\n`);
  }
  process.exit(0);
}

const client = new PcloudHttpClient();
const created = new Map<string, number>();

async function ensureFolder(path: string): Promise<number | null> {
  const known = allIds.get(path) ?? created.get(path);
  if (known !== undefined) return known;
  const parentPath = path.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = await ensureFolder(parentPath);
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
const failures: Array<{ id: number; name: string; error: string }> = [];
const manifest: Array<Correction & { toname: string; toFolderid: number }> = [];

for (const correction of corrections) {
  try {
    const destination = await ensureFolder(correction.toPath);
    if (destination === null) throw new Error(`destination unreachable: ${correction.toPath}`);
    const toname = freeName(correction.toPath, correction.name);
    await client.json('renamefile', { fileid: correction.id, tofolderid: destination, toname });
    applied += 1;
    manifest.push({ ...correction, toname, toFolderid: destination });
  } catch (err) {
    failed += 1;
    failures.push({ id: correction.id, name: correction.name, error: err instanceof Error ? err.message : String(err) });
  }
}

await writeFile(manifestPath, JSON.stringify({ applied, failed, moves: manifest }, null, 1));
process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
process.stderr.write(`Manifest: ${manifestPath}\n`);
for (const failure of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${failure.name}: ${failure.error.split('\n')[0]}\n`);
}
