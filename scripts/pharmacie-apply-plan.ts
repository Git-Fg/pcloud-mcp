/**
 * Applies a rename-and-move plan to pCloud.
 *
 * Reads the plan produced by scripts/pharmacie-rename-plan.ts or
 * scripts/pharmacie-content-rename-plan.ts and applies it with the same HTTP
 * client the MCP tools use. Folders and files go through different pCloud
 * endpoints (renamefolder / renamefile). Operations are applied in small
 * concurrent batches; a failure on one operation does not abort the rest, and
 * every failure is reported at the end.
 *
 * Usage: bun run scripts/pharmacie-apply-plan.ts [plan] [concurrency]
 */
import { readFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface RenameOp {
  fileid?: number;
  folderid?: number;
  toname: string;
  tofolderid?: number;
  targetPath?: string;
  reason: string;
  oldname: string;
}

interface Plan {
  ops: RenameOp[];
  foldersToCreate?: Array<{ parentid: number; name: string; path: string }>;
}

const planPath = process.argv[2] ?? '/tmp/pharmacie-rename-plan.json';
const concurrency = Number(process.argv[3] ?? 4);

const raw = JSON.parse(await readFile(planPath, 'utf8')) as Plan | RenameOp[];
const ops: RenameOp[] = Array.isArray(raw) ? raw : raw.ops;
const foldersToCreate = Array.isArray(raw) ? [] : (raw.foldersToCreate ?? []);

const client = new PcloudHttpClient();

let applied = 0;
let failed = 0;
const failures: Array<{ id: number; oldname: string; error: string }>[] = [];

/** Creates the destination folders the plan expects to exist. */
async function createFolders(): Promise<Map<string, number>> {
  const created = new Map<string, number>();
  for (const folder of foldersToCreate) {
    try {
      const response = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
        folderid: folder.parentid,
        name: folder.name,
      });
      created.set(folder.path, response.metadata.folderid);
    } catch (err) {
      failed += 1;
      failures.push({
        id: folder.parentid,
        oldname: folder.path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (foldersToCreate.length) {
    process.stderr.write(`Created ${created.size}/${foldersToCreate.length} destination folder(s)\n`);
  }
  return created;
}

const createdFolders = await createFolders();

for (let i = 0; i < ops.length; i += concurrency) {
  const batch = ops.slice(i, i + concurrency);
  await Promise.all(
    batch.map(async (op) => {
      const isFolder = op.folderid !== undefined;
      const params: Record<string, string | number> = { toname: op.toname };
      if (isFolder) params.folderid = op.folderid!;
      else params.fileid = op.fileid!;
      const destination = op.tofolderid ?? (op.targetPath ? createdFolders.get(op.targetPath) : undefined);
      if (destination !== undefined) params.tofolderid = destination;
      try {
        await client.json(isFolder ? 'renamefolder' : 'renamefile', params);
        applied += 1;
      } catch (err) {
        failed += 1;
        failures.push({
          id: isFolder ? op.folderid! : op.fileid!,
          oldname: op.oldname,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );
  process.stderr.write(`  ${Math.min(i + concurrency, ops.length)}/${ops.length}\n`);
}

process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
for (const f of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${f.id} ${f.oldname}: ${f.error.split('\n')[0]}\n`);
}
if (failures.length > 20) {
  process.stderr.write(`  ... and ${failures.length - 20} more failures\n`);
}
