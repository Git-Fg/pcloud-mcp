import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const DeletepublinkInputSchema = z.object({
  linkid: z.number().int().positive(),
});

export const DeletepublinkOutputSchema = PcloudSuccess;

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
