import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const ListfolderInputSchema = z.object({
  folderid: z
    .number()
    .int()
    .gte(0)
    .optional()
    .default(0)
    .describe('Numeric folder ID to list (0 for root folder)'),
  nofiles: z
    .boolean()
    .optional()
    .describe('If true, list only subfolders, not files'),
  noshares: z
    .boolean()
    .optional()
    .describe('If true, exclude shared folders from the listing'),
  recursive: z
    .boolean()
    .optional()
    .describe(
      'If true, walk the whole subtree and return every entry, each tagged with its full path. ' +
        'pCloud\'s listfolder rejects the server-side recursive flag (result 1101), so the walk ' +
        'happens client-side.'
    ),
  maxdepth: z
    .number()
    .int()
    .nonnegative()
    .max(10)
    .optional()
    .describe('Depth cap for the recursive walk (0 = the listed folder only, default 3)'),
  showdeleted: z
    .boolean()
    .optional()
    .describe('If true, include deleted (trashed) items in the listing'),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Client-side cap on items returned (pCloud does not paginate; default 200)'),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Client-side offset into the listing (use with limit for paging)'),
});

/**
 * pCloud places the listing INSIDE `metadata.contents` (per the live
 * API response and docs/pcloud-notes.md).
 * `limit`/`offset` are applied client-side because pCloud's API does not
 * paginate, on a large folder the response is one giant array.
 */
export const ListfolderOutputSchema = PcloudSuccess.extend({
  metadata: PcloudMetadata,
  contents: PcloudMetadata.shape.contents,
  page: z
    .object({
      total: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
      offset: z.number().int().nonnegative(),
    })
    .optional(),
});

type PcloudContents = NonNullable<z.infer<typeof PcloudMetadata>['contents']>;

export const ListfolderToolMeta: ToolMeta<typeof ListfolderInputSchema> = {
  title: 'List pCloud Folder',
  description:
    'List the contents of a pCloud folder by folderid. pCloud does not paginate natively; ' +
    'use limit/offset to slice client-side and avoid blowing the context window on large folders. ' +
    'Set recursive to walk the whole subtree (client-side; pCloud rejects the server-side flag).',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ListfolderInputSchema,
};

export async function listfolderHandler(
  args: {
    folderid: number;
    nofiles?: boolean;
    noshares?: boolean;
    recursive?: boolean;
    maxdepth?: number;
    showdeleted?: boolean;
    limit?: number;
    offset?: number;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ListfolderOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = { folderid: args.folderid };
  if (args.nofiles) params.nofiles = 1;
  if (args.noshares) params.noshares = 1;
  if (args.showdeleted) params.showdeleted = 1;

  const response = await client.json<{
    result: 0;
    metadata: z.infer<typeof PcloudMetadata>;
  }>('listfolder', params);

  const all: PcloudContents = response.metadata.contents ?? [];

  if (args.recursive) {
    const maxdepth = args.maxdepth ?? 3;
    const collected: PcloudContents = [];
    type QueueItem = { folderid: number; path: string; depth: number };
    const queue: QueueItem[] = [{ folderid: args.folderid, path: '', depth: 0 }];
    while (queue.length > 0) {
      const { folderid, path, depth } = queue.shift()!;
      const listed =
        depth === 0
          ? all
          : ((await client.json<{
              result: 0;
              metadata: z.infer<typeof PcloudMetadata>;
            }>('listfolder', { folderid })).metadata.contents ?? []);
      for (const item of listed) {
        const itemPath = `${path}/${item.name}`;
        collected.push({ ...item, path: itemPath } as PcloudContents[number]);
        if (item.isfolder && item.folderid !== undefined && depth < maxdepth) {
          queue.push({ folderid: item.folderid, path: itemPath, depth: depth + 1 });
        }
      }
    }
    const limit = args.limit ?? 200;
    const offset = args.offset ?? 0;
    const sliced = collected.slice(offset, offset + limit);
    const payload = {
      ...response,
      contents: sliced,
      page: { total: collected.length, limit, offset },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload as z.infer<typeof ListfolderOutputSchema>,
    };
  }

  const limit = args.limit ?? 200;
  const offset = args.offset ?? 0;
  const sliced = all.slice(offset, offset + limit);

  const payload = {
    ...response,
    contents: sliced,
    page: { total: all.length, limit, offset },
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as z.infer<typeof ListfolderOutputSchema>,
  };
}
