import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

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
    .describe('If true, list subfolders of the folder (pCloud performs the recursion)'),
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
 * pCloud places the listing INSIDE `metadata.contents` (per
 * references/pcloud-docs/method_listfolder.md and the live response).
 * `limit`/`offset` are applied client-side because pCloud's API does not
 * paginate — on a large folder the response is one giant array.
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

export async function listfolderHandler(
  args: {
    folderid: number;
    nofiles?: boolean;
    noshares?: boolean;
    recursive?: boolean;
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
  if (args.recursive) params.recursive = 1;
  if (args.showdeleted) params.showdeleted = 1;

  const response = await client.json<{
    result: 0;
    metadata: z.infer<typeof PcloudMetadata>;
  }>('listfolder', params);

  const all: PcloudContents = response.metadata.contents ?? [];
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
