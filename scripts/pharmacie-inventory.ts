/**
 * Walks the pCloud Pharmacie tree and writes a flat JSON inventory.
 *
 * The inventory is the input to the rename/migration planner: it carries the
 * folderid of every node, the parent chain, and the fileid of every file, so
 * the planner can emit renamefile operations without re-walking the tree.
 *
 * Usage: bun run scripts/pharmacie-inventory.ts [rootFolderId] [outFile]
 */
import { writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface PcloudItem {
  name: string;
  path?: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  parentfolderid?: number;
  size?: number;
  hash?: number;
}

interface PcloudListing {
  result: 0;
  metadata: { contents?: PcloudItem[] };
}

export interface InventoryNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  parentfolderid?: number;
  size?: number;
  hash?: number;
  children?: InventoryNode[];
}

const client = new PcloudHttpClient();

async function list(folderid: number): Promise<PcloudItem[]> {
  const res = await client.json<PcloudListing>('listfolder', { folderid });
  return res.metadata.contents ?? [];
}

/** Breadth-first walk so the folderid map is complete before any planning. */
async function walk(rootId: number, rootName: string): Promise<InventoryNode[]> {
  const roots: InventoryNode[] = [];
  let level: { folderid: number; path: string; node?: InventoryNode }[] = [
    { folderid: rootId, path: `/${rootName}` },
  ];

  while (level.length > 0) {
    const listings = await Promise.all(
      level.map(async (item) => ({ item, entries: await list(item.folderid) }))
    );

    const next: typeof level = [];
    for (const { item, entries } of listings) {
      for (const entry of entries) {
        const node: InventoryNode = {
          name: entry.name,
          path: `${item.path}/${entry.name}`,
          isfolder: entry.isfolder,
          folderid: entry.folderid,
          fileid: entry.fileid,
          parentfolderid: entry.parentfolderid,
          size: entry.size,
          hash: entry.hash,
        };
        if (item.node) {
          item.node.children ??= [];
          item.node.children.push(node);
        } else {
          roots.push(node);
        }
        if (entry.isfolder && entry.folderid !== undefined) {
          next.push({ folderid: entry.folderid, path: node.path, node });
        }
      }
    }
    level = next;
    process.stderr.write(`  level ${level.length} folder(s) pending\n`);
  }
  return roots;
}

const rootId = Number(process.argv[2] ?? 0);
const outFile = process.argv[3] ?? '/tmp/pharmacie-inventory.json';

const roots = await walk(rootId, process.argv[4] ?? 'Pharmacie');
await writeFile(outFile, JSON.stringify(roots, null, 1));
process.stderr.write(`Wrote ${outFile}\n`);
