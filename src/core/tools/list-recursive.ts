import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

/**
 * Compact recursive listing for corpus curation.
 *
 * Unlike `listfolder`, this tool returns only the fields a curator needs —
 * fileid, path, name, size, hash, modified, contenttype — and it walks the
 * whole tree in one call. The full metadata blob is dropped: a 14 000-file
 * tree would otherwise return gigabytes of JSON that no context window can
 * hold.
 *
 * The walk is client-side because pCloud's listfolder rejects the server-side
 * recursive flag (result 1101).
 */
export const ListRecursiveInputSchema = z
  .object({
    folderid: z.number().int().gte(0).optional().default(0).describe('Numeric folder ID to list (0 for root folder)'),
    maxdepth: z.number().int().nonnegative().max(10).optional().default(5).describe('Depth cap for the walk (default 5)'),
    limit: z.number().int().positive().max(5000).optional().default(2000).describe('Client-side cap on files returned (default 2000)'),
    offset: z.number().int().nonnegative().optional().default(0).describe('Client-side offset into the listing'),
    includeFolders: z.boolean().optional().default(false).describe('If true, also return folder entries'),
  });

export const ListRecursiveOutputSchema = PcloudSuccess.extend({
  files: z
    .array(
      z
        .object({
          fileid: z.number().int().positive(),
          path: z.string(),
          name: z.string(),
          size: z.number().int().nonnegative().optional(),
          /**
           * The 64-bit pCloud content hash. It is past the safe integer
           * range, so JSON carries it as a rounded double. The rounding is
           * deterministic, which is what grouping needs: files holding the
           * same bytes still land on the same value.
           */
          hash: z.number().optional(),
          modified: z.string().optional(),
          contenttype: z.string().optional(),
        })
        .passthrough()
    )
    .optional(),
  folders: z
    .array(
      z
        .object({
          folderid: z.number().int().nonnegative(),
          path: z.string(),
          name: z.string(),
        })
        .passthrough()
    )
    .optional(),
  page: z
    .object({
      total: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
      offset: z.number().int().nonnegative(),
    })
    .optional(),
});

export const ListRecursiveToolMeta: ToolMeta<typeof ListRecursiveInputSchema> = {
  title: 'List pCloud Tree Recursively (Compact)',
  description:
    'Walk a pCloud folder tree and return a compact index of every file: fileid, path, name, size, ' +
    'the 64-bit pCloud content hash, modified timestamp and content type. Folders are returned only ' +
    'when includeFolders is set. The walk is client-side (pCloud rejects server-side recursive). ' +
    'Use this before checksum_group or range_read to avoid re-listing the same tree.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ListRecursiveInputSchema,
};

type FileEntry = {
  fileid: number;
  path: string;
  name: string;
  size?: number;
  hash?: number;
  modified?: string;
  contenttype?: string;
};

type FolderEntry = {
  folderid: number;
  path: string;
  name: string;
};

export async function listRecursiveHandler(
  args: {
    folderid?: number;
    maxdepth?: number;
    limit?: number;
    offset?: number;
    includeFolders?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof ListRecursiveOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const folderid = args.folderid ?? 0;
  const maxdepth = args.maxdepth ?? 5;

  const files: FileEntry[] = [];
  const folders: FolderEntry[] = [];

  type QueueItem = { folderid: number; path: string };
  let level: QueueItem[] = [{ folderid, path: '' }];

  for (let depth = 0; depth <= maxdepth && level.length > 0; depth += 1) {
    const listings = await Promise.all(
      level.map(async ({ folderid: fid, path }) => {
        const listed = (
          await client.json<{
            result: 0;
            metadata: z.infer<typeof PcloudMetadata>;
          }>('listfolder', { folderid: fid })
        ).metadata.contents ?? [];
        return listed.map((item) => ({ item, path }));
      })
    );

    const next: QueueItem[] = [];
    for (const entries of listings) {
      for (const { item, path } of entries) {
        const itemPath = `${path}/${item.name}`;
        if (item.isfolder) {
          if (args.includeFolders && item.folderid !== undefined) {
            folders.push({ folderid: item.folderid, path: itemPath, name: item.name });
          }
          if (depth < maxdepth && item.folderid !== undefined) {
            next.push({ folderid: item.folderid, path: itemPath });
          }
        } else if (item.fileid !== undefined) {
          files.push({
            fileid: item.fileid,
            path: itemPath,
            name: item.name,
            size: item.size,
            hash: item.hash,
            modified: item.modified,
            contenttype: item.contenttype,
          });
        }
      }
    }
    level = next;
  }

  const limit = args.limit ?? 2000;
  const offset = args.offset ?? 0;
  const slicedFiles = files.slice(offset, offset + limit);
  const slicedFolders = args.includeFolders ? folders.slice(offset, offset + limit) : undefined;

  const payload = {
    result: 0 as const,
    files: slicedFiles,
    folders: slicedFolders,
    page: { total: files.length, limit, offset },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload as z.infer<typeof ListRecursiveOutputSchema>,
  };
}