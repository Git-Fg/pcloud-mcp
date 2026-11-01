/**
 * Moves the audio and video of the corpus out of the document tree.
 *
 * The pharmacie corpus is documents; the recordings of the same courses are
 * three quarters of its bytes. The recordings move to a sibling folder at the
 * account root, keeping the path they had inside the year, so a course is
 * still found by its unit and its semester.
 *
 * A file is moved, never copied and never deleted: pCloud carries the
 * rename across folders in one call and the bytes do not travel. A name
 * already taken at the destination is numbered rather than reused, because
 * pCloud replaces the file that sits under the target name.
 *
 * Usage: bun run scripts/pharmacie-move-media.ts [inventory] [outPlan] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { indexInventory, NameBook } from './lib/inventory.js';
import { freeName } from './lib/naming.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  modified?: string;
  contenttype?: string;
  children?: InvNode[];
}

interface MoveOp {
  id: number;
  from: string;
  toPath: string;
  toname: string;
  size: number;
}

const MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
]);

/** Where the recordings go, relative to the account root. */
const MEDIA_ROOT_NAME = 'Pharmacie-MEDIA';

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-3.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-media-moves.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const index = indexInventory(roots);
const nameBook = new NameBook(index);

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const media = files.filter((file) => {
  const dot = file.name.lastIndexOf('.');
  return dot > 0 && MEDIA_EXTENSIONS.has(file.name.slice(dot).toLowerCase());
});

const moves: MoveOp[] = media.map((file) => {
  const year = file.path.split('/')[2];
  const rest = file.path.split('/').slice(3).join('/');
  const toPath = `/${MEDIA_ROOT_NAME}/${year}/${rest}`;
  return {
    id: file.fileid!,
    from: file.path,
    toPath,
    toname: nameBook.claim(toPath, file.name, freeName),
    size: file.size ?? 0,
  };
});

const bytes = moves.reduce((sum, move) => sum + move.size, 0);
process.stderr.write(
  `${moves.length} media files, ${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB, to move into /${MEDIA_ROOT_NAME}\n`,
);

await writeFile(outPlan, JSON.stringify({ moves }, null, 1));

if (!apply) {
  process.stderr.write(`Wrote ${outPlan}\n`);
  process.exit(0);
}

const client = new PcloudHttpClient();

interface RootListing {
  metadata: { contents?: Array<{ name: string; folderid: number; isfolder: boolean }> };
}

/** The identifier of the recordings folder at the account root, created once. */
async function mediaRoot(): Promise<number> {
  const listing = await client.json<RootListing>('listfolder', { folderid: 0 });
  const existing = listing.metadata.contents?.find((entry) => entry.name === MEDIA_ROOT_NAME && entry.isfolder);
  if (existing) return existing.folderid;
  const created = await client.json<{ metadata: { folderid: number } }>('createfolder', {
    folderid: 0,
    name: MEDIA_ROOT_NAME,
  });
  return created.metadata.folderid;
}

const rootId = await mediaRoot();
const folderIds = new Map<string, number>([[`/${MEDIA_ROOT_NAME}`, rootId]]);

/** The identifier of a folder under the recordings root, created when missing. */
async function ensureFolder(path: string): Promise<number> {
  const known = folderIds.get(path);
  if (known !== undefined) return known;
  const parentPath = path.replace(/\/[^/]+$/, '');
  const parentId = await ensureFolder(parentPath);
  const name = path.slice(parentPath.length + 1);
  const response = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
    folderid: parentId,
    name,
  });
  folderIds.set(path, response.metadata.folderid);
  return response.metadata.folderid;
}

let moved = 0;
let failed = 0;
const failures: Array<{ from: string; error: string }> = [];

for (const move of moves) {
  try {
    const destinationPath = move.toPath.replace(/\/[^/]+$/, '');
    const destination = await ensureFolder(destinationPath);
    await client.json('renamefile', { fileid: move.id, tofolderid: destination, toname: move.toname });
    moved += 1;
  } catch (err) {
    failed += 1;
    failures.push({ from: move.from, error: err instanceof Error ? err.message : String(err) });
  }
  if ((moved + failed) % 50 === 0) process.stderr.write(`  ${moved + failed}/${moves.length}\n`);
}

process.stderr.write(`Moved ${moved}, failed ${failed}\n`);
for (const failure of failures.slice(0, 20)) {
  process.stderr.write(`  FAIL ${failure.from}: ${failure.error.split('\n')[0]}\n`);
}
