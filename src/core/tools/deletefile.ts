import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { ToolMeta } from './tool-meta.js';

export const DeletefileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to delete'),
    path: z.string().optional().describe('Path to file (mutually exclusive with fileid)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const DeletefileOutputSchema = z.object({}).passthrough();

export const DeletefileToolMeta: ToolMeta<typeof DeletefileInputSchema> = {
  title: 'Delete a File',
  description:
    'Delete a single file by fileid or path. For empty folders use deletefolder; for non-empty ' +
    'folders use deletefolderrecursive. The deleted file moves to the pCloud Trash and can ' +
    'be recovered via trash_restore (note: trash_restore currently returns 1000 for OAuth ' +
    'access tokens; see docs/pcloud-notes.md).',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  inputSchema: DeletefileInputSchema,
};

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
