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
import { indexInventory, NameBook } from './lib/inventory.js';
import { freeName as pickFreeName } from './lib/naming.js';

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

const index = indexInventory(roots);
const nameBook = new NameBook(index);

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
  const known = index.idByPath.get(path) ?? created.get(path);
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
    const toname = nameBook.claim(correction.toPath, correction.name, pickFreeName);
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
