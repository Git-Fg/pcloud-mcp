/**
 * Names a file after the unit that holds it, when its name alone does not
 * say which unit it belongs to.
 *
 * "1ère session 2015 corrigée.pdf" is one exam in UE-02 and a different
 * one in UE-09; "2ème session 2014.pdf" appears in three units at once.
 * A reader who finds the file by name cannot tell which one they have, so
 * the unit goes into the name.
 *
 * Only the names that are genuinely ambiguous are touched. A file whose
 * name is unique in the corpus keeps it.
 *
 * The scanner's own byproducts — the directory summaries it writes into
 * every folder it visits — are not course material and are not renamed;
 * they are listed for the caller to decide on.
 *
 * Usage: bun run scripts/pharmacie-prefix-ambiguous.ts [inventory] [outPlan] [--apply]
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
  children?: InvNode[];
}

interface RenameOp {
  id: number;
  from: string;
  toname: string;
  size: number;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-5.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-prefix-ambiguous.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

/** The unit a file sits under, or the folder that stands in for one. */
function unitOf(path: string): string | null {
  const segments = path.split('/');
  const unit = segments.find((segment) => /^UE-\d{2}-[A-Z-]+$/.test(segment));
  if (unit) return unit.replace(/^UE-/, 'UE');
  // Material outside a unit is named after the folder that holds it.
  const holder = segments
    .slice(2, -1)
    .reverse()
    .find((segment) => segment && !/^(3A|4A|5A|CSP|DFGSP3 - 3eme annee|DFASP1 - 4eme annee)$/.test(segment));
  return holder ? holder.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24) : null;
}

/** The scanner's byproducts, written into every folder it visits. */
const TOOLING = /^_directory_summary\.(json|csv)$/;

const byName = new Map<string, InvNode[]>();
for (const file of files) {
  const list = byName.get(file.name) ?? [];
  list.push(file);
  byName.set(file.name, list);
}

const renames: RenameOp[] = [];
const tooling: string[] = [];
const skipped: string[] = [];

for (const [name, group] of byName) {
  if (group.length < 2) continue;
  if (TOOLING.test(name)) {
    tooling.push(...group.map((file) => file.path));
    continue;
  }
  const units = new Set(group.map((file) => unitOf(file.path)));
  if (units.size < 2) continue;

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';

  for (const file of group) {
    const unit = unitOf(file.path);
    if (!unit) {
      skipped.push(file.path);
      continue;
    }
    renames.push({
      id: file.fileid!,
      from: file.path,
      toname: `${unit} - ${stem}${extension}`,
      size: file.size ?? 0,
    });
  }
}

process.stderr.write(
  `${renames.length} files to rename, ${tooling.length} scanner byproducts left for the caller, ${skipped.length} skipped\n`,
);
for (const rename of renames.slice(0, 8)) {
  process.stderr.write(`  ${rename.from.replace('/Pharmacie/', '')}\n    -> ${rename.toname}\n`);
}

await writeFile(outPlan, JSON.stringify({ renames, tooling, skipped }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to rename.\n');
  process.exit(0);
}

const client = new PcloudHttpClient();
let renamed = 0;
let failed = 0;
for (const rename of renames) {
  try {
    await client.json('renamefile', { fileid: rename.id, toname: rename.toname });
    renamed += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${rename.from}: ${err instanceof Error ? err.message : err}\n`);
  }
  if ((renamed + failed) % 50 === 0) process.stderr.write(`  ${renamed + failed}/${renames.length}\n`);
}
process.stderr.write(`Renamed ${renamed}, failed ${failed}\n`);
