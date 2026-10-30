/**
 * Applies the Pharmacie migration plan to pCloud.
 *
 * The canonical folders the plan needs are created first, then every entry
 * is moved into its place. Nothing is deleted and nothing is renamed inside
 * a folder, so the material itself is preserved exactly.
 *
 * A manifest records every move with the identifiers involved, so the
 * migration can be undone: a moved entry keeps its identity, only its parent
 * changes.
 *
 * Usage: bun run scripts/pharmacie-apply-migrate.ts [plan] [manifest] [concurrency]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface MoveOp {
  kind: 'folder' | 'file';
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  files: number;
  reason: string;
}

interface MigratePlan {
  moves: MoveOp[];
  foldersToCreate: Array<{ path: string; name: string; parentPath: string; parentid: number }>;
  unmapped: Array<{ path: string; files: number; reason: string }>;
}

interface ManifestEntry {
  kind: 'folder' | 'file';
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  files: number;
  reason: string;
}

const planPath = process.argv[2] ?? '/tmp/pharmacie-migrate-plan.json';
const manifestPath = process.argv[3] ?? '/tmp/pharmacie-migrate-manifest.json';
const concurrency = Number(process.argv[4] ?? 4);

const plan = JSON.parse(await readFile(planPath, 'utf8')) as MigratePlan;
const client = new PcloudHttpClient();

/** The identifier of every canonical folder, after the plan's own additions. */
const folderIdByPath = new Map<string, number>();

let applied = 0;
let failed = 0;
const failures: Array<{ id: number; path: string; error: string }> = [];
const manifest: ManifestEntry[] = [];

// The plan lists the folders it needs in the order they must appear: a
// folder whose parent is itself missing comes after that parent.
for (const folder of plan.foldersToCreate ?? []) {
  const parentId = folder.parentid || folderIdByPath.get(folder.parentPath);
  if (!parentId) {
    failed += 1;
    failures.push({ id: 0, path: folder.path, error: `parent folder missing: ${folder.parentPath}` });
    continue;
  }
  try {
    const response = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
      folderid: parentId,
      name: folder.name,
    });
    folderIdByPath.set(folder.path, response.metadata.folderid);
  } catch (err) {
    failed += 1;
    failures.push({
      id: parentId,
      path: folder.path,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
if ((plan.foldersToCreate ?? []).length) {
  process.stderr.write(`Prepared ${folderIdByPath.size}/${(plan.foldersToCreate ?? []).length} destination folder(s)\n`);
}

for (let i = 0; i < plan.moves.length; i += concurrency) {
  const batch = plan.moves.slice(i, i + concurrency);
  await Promise.all(
    batch.map(async (move) => {
      const destination = move.toFolderid || folderIdByPath.get(move.toPath);
      if (!destination) {
        failed += 1;
        failures.push({ id: move.id, path: move.from, error: 'destination folder unknown' });
        return;
      }
      const endpoint = move.kind === 'folder' ? 'renamefolder' : 'renamefile';
      const params: Record<string, string | number> = {
        toname: move.toname,
        tofolderid: destination,
      };
      if (move.kind === 'folder') params.folderid = move.id;
      else params.fileid = move.id;
      try {
        await client.json(endpoint, params);
        applied += 1;
        manifest.push({
          kind: move.kind,
          id: move.id,
          from: move.from,
          toPath: move.toPath,
          toFolderid: destination,
          toname: move.toname,
          files: move.files,
          reason: move.reason,
        });
      } catch (err) {
        failed += 1;
        failures.push({
          id: move.id,
          path: move.from,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );
  process.stderr.write(`  ${Math.min(i + concurrency, plan.moves.length)}/${plan.moves.length}\n`);
}

await writeFile(manifestPath, JSON.stringify({ applied, failed, moves: manifest }, null, 1));

process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
process.stderr.write(`Manifest: ${manifestPath}\n`);
for (const failure of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${failure.id} ${failure.path}: ${failure.error.split('\n')[0]}\n`);
}
if (failures.length > 20) {
  process.stderr.write(`  ... and ${failures.length - 20} more failures\n`);
}
