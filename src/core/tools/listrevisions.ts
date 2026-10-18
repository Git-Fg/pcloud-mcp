import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const ListrevisionsInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID'),
    path: z.string().optional().describe('File path (discouraged)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const ListrevisionsOutputSchema = PcloudSuccess.extend({
  metadata: PcloudMetadata,
  revisions: z.array(
    z.object({
      revisionid: z.number().int().nonnegative(),
      size: z.number().int().nonnegative(),
      hash: z.string().optional(),
      created: z.string().optional(),
    }).passthrough()
  ),
});

export async function listrevisionsHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ListrevisionsOutputSchema>;
}> {
  args = ListrevisionsInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof ListrevisionsOutputSchema>>('listrevisions', params);
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    structuredContent: response,
  };
}
