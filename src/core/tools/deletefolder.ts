import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { ToolMeta } from './tool-meta.js';

export const DeletefolderInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional().describe('Folder ID to delete (must be empty)'),
    path: z.string().optional().describe('Path to empty folder (mutually exclusive with folderid)'),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path',
  });

export const DeletefolderOutputSchema = z.object({}).passthrough();

export const DeletefolderToolMeta: ToolMeta<typeof DeletefolderInputSchema> = {
  title: 'Delete an Empty Folder',
  description:
    'Delete a folder that is already empty, by folderid or path. For non-empty folders use ' +
    'deletefolderrecursive. pCloud requires the folder to be empty for this endpoint to succeed.',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  inputSchema: DeletefolderInputSchema,
};

export async function deletefolderHandler(
  args: { folderid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof DeletefolderOutputSchema>;
}> {
  args = DeletefolderInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.folderid !== undefined ? { folderid: args.folderid } : { path: args.path! };
  const response = await client.json<z.infer<typeof DeletefolderOutputSchema>>('deletefolder', params);
  return {
    content: [
      { type: 'text', text: `Deleted empty folder via deletefolder: ${JSON.stringify(response, null, 2)}` },
    ],
    structuredContent: response,
  };
}
