import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const StatInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File or folder ID (discouraged: path is preferred)'),
    path: z.string().optional().describe('Path to file or folder (preferred)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const StatOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const StatToolMeta: ToolMeta<typeof StatInputSchema> = {
  title: 'Get File or Folder Metadata',
  description: 'Return the metadata for one file or folder by fileid or path. Cheap existence check.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: StatInputSchema,
};

export async function statHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof StatOutputSchema>;
}> {
  args = StatInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof StatOutputSchema>>('stat', params);
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    structuredContent: response,
  };
}
