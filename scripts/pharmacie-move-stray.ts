/**
 * Moves the material that does not belong to the pharmacie course out of the
 * pharmacie tree.
 *
 * Three things live inside /Pharmacie that are not teaching material: a
 * data-science project (an NPS survey), the pictures a Moodle test took,
 * and a prompt that sits at the root while its four siblings sit in the
 * pipeline folder. The project and the pictures move to the account root,
 * next to the other non-pharmacie folders that live there; the prompt
 * joins its siblings, because it is one of them.
 *
 * Usage: bun run scripts/pharmacie-move-stray.ts [inventory] [outPlan] [--apply]
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

interface RootEntry {
  name: string;
  folderid: number;
  isfolder: boolean;
}

interface MoveOp {
  id: number;
  from: string;
  toPath: string;
  toname: string;
  size: number;
  kind: 'folder' | 'file';
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-5.json';
const outPlan = process.argv[3] ?? '/tmp/pharmacie-stray-moves.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const byPath = new Map<string, InvNode>();
(function walk(list: InvNode[]): void {
  for (const node of list) {
    byPath.set(node.path, node);
    walk(node.children ?? []);
  }
})(roots);

/** The project and the pictures leave the tree; the prompt joins its siblings. */
const LEAVES = [
  { path: '/Pharmacie/_PROJETS/Projet-SP-IA', to: '/Projet-SP-IA', kind: 'folder' as const },
  { path: '/Pharmacie/_OUTILS/Moodle-test', to: '/Moodle-test', kind: 'folder' as const },
];

const moves: MoveOp[] = [];

for (const leaf of LEAVES) {
  const node = byPath.get(leaf.path);
  if (!node) {
    process.stderr.write(`missing: ${leaf.path}\n`);
    continue;
  }
  moves.push({
    id: node.folderid!,
    from: leaf.path,
    toPath: leaf.to,
    toname: leaf.to.split('/').pop()!,
    size: 0,
    kind: 'folder',
  });
}

const prompt = byPath.get('/Pharmacie/prompt.md');
if (prompt) {
  moves.push({
    id: prompt.fileid!,
    from: prompt.path,
    toPath: '/Pharmacie/_OUTILS/CSP-Pipeline',
    toname: prompt.name,
    size: prompt.size ?? 0,
    kind: 'file',
  });
}

process.stderr.write(`${moves.length} moves\n`);
for (const move of moves) {
  process.stderr.write(`  ${move.kind} ${move.from} -> ${move.toPath}/${move.toname}\n`);
}

await writeFile(outPlan, JSON.stringify({ moves }, null, 1));
process.stderr.write(`Wrote ${outPlan}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to move.\n');
  process.exit(0);
}

const client = new PcloudHttpClient();

/** The identifier of a folder at the account root, created when missing. */
async function rootFolder(name: string): Promise<number> {
  const listing = await client.json<{ metadata: { contents?: RootEntry[] } }>('listfolder', { folderid: 0 });
  const existing = listing.metadata.contents?.find((entry) => entry.name === name && entry.isfolder);
  if (existing) return existing.folderid;
  const created = await client.json<{ metadata: { folderid: number } }>('createfolder', { folderid: 0, name });
  return created.metadata.folderid;
}

let applied = 0;
let failed = 0;
for (const move of moves) {
  try {
    if (move.kind === 'folder') {
      const destinationId = await rootFolder(move.toname);
      await client.json('renamefolder', { folderid: move.id, tofolderid: destinationId, toname: move.toname });
    } else {
      const target = move.toPath.replace(/\/[^/]+$/, '');
      const listing = await client.json<{ metadata: { contents?: RootEntry[] } }>('listfolder', { folderid: 0 });
      void listing;
      const pipeline = byPath.get(target);
      if (!pipeline) throw new Error(`destination folder not in inventory: ${target}`);
      await client.json('renamefile', {
        fileid: move.id,
        tofolderid: pipeline.folderid!,
        toname: move.toname,
      });
    }
    applied += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${move.from}: ${err instanceof Error ? err.message : err}\n`);
  }
}
process.stderr.write(`Moved ${applied}, failed ${failed}\n`);
