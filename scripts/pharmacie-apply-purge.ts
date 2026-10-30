/**
 * Applies the cleanup plan to pCloud.
 *
 * Deletions go to the pCloud trash, so every removed folder and file stays
 * recoverable. Renames are plain pCloud renames.
 *
 * Usage: bun run scripts/pharmacie-apply-purge.ts [plan] [concurrency]
 */
import { readFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface PurgePlan {
  deleteDirs: Array<{ folderid: number; path: string }>;
  deleteFiles: Array<{ fileid: number; path: string }>;
  renameDirs: Array<{ folderid: number; path: string; toname: string }>;
  renameFiles: Array<{ fileid: number; path: string; toname: string }>;
}

const planPath = process.argv[2] ?? '/tmp/pharmacie-purge-plan.json';
const concurrency = Number(process.argv[3] ?? 4);

const plan = JSON.parse(await readFile(planPath, 'utf8')) as PurgePlan;
const client = new PcloudHttpClient();

let applied = 0;
let failed = 0;
const failures: Array<{ id: number; path: string; error: string }> = [];

async function run<T extends { id: number; path: string }>(
  entries: T[],
  endpoint: string,
  params: (entry: T) => Record<string, string | number>,
  label: string
): Promise<void> {
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          await client.json(endpoint, params(entry));
          applied += 1;
        } catch (err) {
          failed += 1;
          failures.push({
            id: entry.id,
            path: entry.path,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
    process.stderr.write(`  ${label} ${Math.min(i + concurrency, entries.length)}/${entries.length}\n`);
  }
}

await run(
  plan.renameDirs,
  'renamefolder',
  (d) => ({ folderid: d.folderid, toname: d.toname }),
  'renamed dirs'
);
await run(
  plan.renameFiles,
  'renamefile',
  (f) => ({ fileid: f.fileid, toname: f.toname }),
  'renamed files'
);
await run(
  plan.deleteDirs,
  'deletefolderrecursive',
  (d) => ({ folderid: d.folderid }),
  'deleted dirs'
);
await run(
  plan.deleteFiles,
  'deletefile',
  (f) => ({ fileid: f.fileid }),
  'deleted files'
);

process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
for (const f of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${f.id} ${f.path}: ${f.error.split('\n')[0]}\n`);
}
if (failures.length > 20) {
  process.stderr.write(`  ... and ${failures.length - 20} more failures\n`);
}
