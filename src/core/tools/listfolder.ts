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

export async function listfolderHandler(
  args: { folderid: number; limit?: number; offset?: number },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ListfolderOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const response = await client.json<{
    result: 0;
    metadata: z.infer<typeof PcloudMetadata>;
  }>('listfolder', { folderid: args.folderid });

  const all = (response.metadata.contents ?? []) as unknown[];
  const limit = args.limit ?? 200;
  const offset = args.offset ?? 0;
  const sliced = all.slice(offset, offset + limit);
  response.metadata.contents = sliced as never;

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
