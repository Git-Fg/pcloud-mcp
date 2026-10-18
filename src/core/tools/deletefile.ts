import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';

export const DeletefileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to delete'),
    path: z.string().optional().describe('Path to file (mutually exclusive with fileid)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const DeletefileOutputSchema = z.object({}).passthrough();

export async function deletefileHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof DeletefileOutputSchema>;
}> {
  args = DeletefileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof DeletefileOutputSchema>>('deletefile', params);
  return {
    content: [
      { type: 'text', text: `Deleted via deletefile: ${JSON.stringify(response, null, 2)}` },
    ],
    structuredContent: response,
  };
}
