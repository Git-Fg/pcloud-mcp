import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const TrashListInputSchema = z.object({
  folderid: z.number().int().nonnegative().optional().default(0),
  nofiles: z.boolean().optional(),
  recursive: z.boolean().optional(),
});

export const TrashListOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const TrashListToolMeta: ToolMeta<typeof TrashListInputSchema> = {
  title: 'List Items in Trash',
  description:
    'List the contents of the pCloud Trash (root folderid=0 unless nested). Items in trash ' +
    'have origparentfolderid showing the folder they were deleted from. Use trash_restore to ' +
    'recover an item by its fileid/folderid.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: TrashListInputSchema,
};

export async function trashListHandler(
  args: { folderid?: number; nofiles?: boolean; recursive?: boolean },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof TrashListOutputSchema>;
}> {
  args = TrashListInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = { folderid: args.folderid ?? 0 };
  if (args.nofiles) params.nofiles = 1;
  if (args.recursive) params.recursive = 1;
  const response = await client.json<z.infer<typeof TrashListOutputSchema>>('trash_list', params);
  const count = response.metadata.contents?.length ?? 0;
  return {
    content: [{ type: 'text', text: `Trash (folderid=${params.folderid}) → ${count} item(s)` }],
    structuredContent: response,
  };
}
