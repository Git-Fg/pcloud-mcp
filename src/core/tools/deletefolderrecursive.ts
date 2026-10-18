import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const DeletefolderrecursiveInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional().describe('Folder ID to delete (with all contents)'),
    path: z.string().optional().describe('Path to folder (discouraged)'),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path',
  });

export const DeletefolderrecursiveOutputSchema = PcloudSuccess.extend({
  deletedfiles: z.number().int().nonnegative(),
  deletedfolders: z.number().int().nonnegative(),
});

export async function deletefolderrecursiveHandler(
  args: { folderid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof DeletefolderrecursiveOutputSchema>;
}> {
  args = DeletefolderrecursiveInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.folderid !== undefined ? { folderid: args.folderid } : { path: args.path! };
  const response = await client.json<z.infer<typeof DeletefolderrecursiveOutputSchema>>(
    'deletefolderrecursive',
    params
  );
  return {
    content: [
      {
        type: "text",
        text: `Deleted ${response.deletedfiles} files and ${response.deletedfolders} folders.`,
      },
    ],
    structuredContent: response,
  };
}
