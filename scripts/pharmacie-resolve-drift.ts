/**
 * Resolves the copies of one document that sit in two places.
 *
 * The corpus holds some courses twice: once as the full-resolution
 * original, once as a later re-compression. Both carry the same name and
 * sit under the same unit, so a reader cannot tell them apart; the older
 * one is usually the better one, because the compressed copy is a later
 * export of a PDF that was already in the tree.
 *
 * The rule is size, not date: the larger file is the one that keeps its
 * name, and the smaller one is deleted.
 *
 * A name that appears under two different units is a different matter —
 * two exams, two courses — and those files are left alone. The grouping
 * is therefore by unit, not by name alone.
 *
 * Usage: bun run scripts/pharmacie-resolve-drift.ts [inventory] [outPlan] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  modified?: string;
  children?: InvNode[];
}

interface DeleteOp {
  id: number;
  path: string;
  size: number;
  keeper: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-5.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-drift-resolution.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const KIND = ['Cours', 'Fiches', 'Annales', 'ED', 'TD', 'Transcriptions', 'Autres', 'Images', 'Videos', 'Projets'];

/**
 * The unit a file belongs to, and the kind of material it holds. Two files
 * that share both are two renderings of the same document; two files that
 * share only a name are two different documents.
 */
function scope(path: string): string | null {
  const segments = path.split('/');
  const unit = segments.find((segment) => /^UE-\d{2}-[A-Z-]+$/.test(segment));
  if (!unit) return null;
  const kind = segments.find((segment) => KIND.includes(segment)) ?? '(none)';
  return `${segments[2]}|${unit}|${kind}`;
}

const groups = new Map<string, InvNode[]>();
for (const file of files) {
  const scopeKey = scope(file.path);
  if (!scopeKey) continue;
  const key = `${scopeKey} ${file.name}`;
  const list = groups.get(key) ?? [];
  list.push(file);
  groups.set(key, list);
}

const deletes: DeleteOp[] = [];
let keptGroups = 0;

for (const [, group] of groups) {
  if (group.length < 2) continue;
  const distinct = new Set(group.map((file) => `${file.hash ?? 0}_${file.size ?? 0}`));
  if (distinct.size < 2) continue;
  keptGroups += 1;
  const sorted = [...group].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  const keeper = sorted[0];
  for (const loser of sorted.slice(1)) {
    deletes.push({
      id: loser.fileid!,
      path: loser.path,
      size: loser.size ?? 0,
      keeper: keeper.path,
    });
  }
}

const bytes = deletes.reduce((sum, deletion) => sum + deletion.size, 0);
process.stderr.write(
  `${keptGroups} version groups, ${deletes.length} smaller copies to delete, ${(bytes / 1048576).toFixed(1)} MB\n`,
);
for (const deletion of deletes.slice(0, 10)) {
  process.stderr.write(`  DEL ${(deletion.size / 1048576).toFixed(2)} MB ${deletion.path.replace('/Pharmacie/', '')}\n`);
}

await writeFile(outPlan, JSON.stringify({ deletes }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to delete.\n');
  process.exit(0);
}

const client = new PcloudHttpClient();
let deleted = 0;
let failed = 0;
for (const deletion of deletes) {
  try {
    await client.json('deletefile', { fileid: deletion.id });
    deleted += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${deletion.path}: ${err instanceof Error ? err.message : err}\n`);
  }
}
process.stderr.write(`Deleted ${deleted}, failed ${failed}\n`);
