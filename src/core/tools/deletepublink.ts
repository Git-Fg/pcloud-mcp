import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const DeletepublinkInputSchema = z.object({
  linkid: z.number().int().positive(),
});

export const DeletepublinkOutputSchema = PcloudSuccess;

export const DeletepublinkToolMeta: ToolMeta<typeof DeletepublinkInputSchema> = {
  title: 'Delete a Public Link',
  description: 'Delete a single public link by its linkid. Idempotent: a missing linkid returns error 2027.',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  inputSchema: DeletepublinkInputSchema,
};

export async function deletepublinkHandler(
  args: { linkid: number },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof DeletepublinkOutputSchema>;
}> {
  args = DeletepublinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof DeletepublinkOutputSchema>>('deletepublink', {
    linkid: args.linkid,
  });
  return {
    content: [{ type: 'text', text: `Deleted public link ${args.linkid}` }],
    structuredContent: response,
  };
}
