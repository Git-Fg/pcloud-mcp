/**
 * Applies a plan of file moves.
 *
 * The plan names, for each file, where it goes and under which name. The
 * destination folders are created when they are missing, and a name already
 * taken in the destination is numbered rather than reused: pCloud replaces
 * the file that sits under the target name, so reusing a name destroys what
 * was there.
 *
 * The name is chosen again here, against the tree as it stands when the
 * moves run, because a plan is written against a tree and the tree moves
 * on between the plan and the move.
 *
 * Usage: bun run scripts/pharmacie-apply-moves.ts [plan] [manifest] [--inventory path] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { indexInventory, NameBook } from './lib/inventory.js';
import { freeName } from './lib/naming.js';

interface PlannedMove {
  kind?: string;
  id: number;
  from: string;
  toPath: string;
  toname?: string;
  reason?: string;
}

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  children?: InvNode[];
}

const planPath = process.argv[2] ?? '/tmp/pharmacie-inspect-plan.json';
const manifestPath = process.argv[3] ?? '/tmp/pharmacie-moves-manifest.json';
const apply = process.argv.includes('--apply');
const inventoryFlag = process.argv.indexOf('--inventory');
const inventoryArg = inventoryFlag >= 0 ? process.argv[inventoryFlag + 1] : undefined;

const plan = JSON.parse(await readFile(planPath, 'utf8')) as { moves: PlannedMove[] };
const moves = plan.moves;

const inventoryPath = inventoryArg ?? '/tmp/pharmacie-inventory-19.json';
const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const index = indexInventory(roots);
const nameBook = new NameBook(index);

const byUnit = moves.reduce<Record<string, number>>((acc, move) => {
  const unit = move.toPath.match(/\/(UE-[0-9]{2}-[A-Z-]+)\//)?.[1] ?? move.toPath;
  acc[unit] = (acc[unit] ?? 0) + 1;
  return acc;
}, {});

process.stderr.write(`${moves.length} moves planned\n`);
for (const [unit, count] of Object.entries(byUnit).sort((a, b) => b[1] - a[1])) {
  process.stderr.write(`  ${String(count).padStart(4)}  ${unit}\n`);
}

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to move the files.\n');
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
const failures: Array<{ from: string; error: string }> = [];
const manifest: Array<PlannedMove & { appliedName: string; toFolderid: number }> = [];

for (const move of moves) {
  try {
    const destination = await ensureFolder(move.toPath);
    if (destination === null) throw new Error(`destination unreachable: ${move.toPath}`);
    const appliedName = nameBook.claim(move.toPath, move.toname ?? move.from.split('/').pop()!, freeName);
    await client.json('renamefile', { fileid: move.id, tofolderid: destination, toname: appliedName });
    applied += 1;
    manifest.push({ ...move, appliedName, toFolderid: destination });
  } catch (err) {
    failed += 1;
    failures.push({ from: move.from, error: err instanceof Error ? err.message : String(err) });
  }
}

await writeFile(manifestPath, JSON.stringify({ applied, failed, moves: manifest }, null, 1));
process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
process.stderr.write(`Manifest: ${manifestPath}\n`);
for (const failure of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${failure.from}: ${failure.error.split('\n')[0]}\n`);
}
