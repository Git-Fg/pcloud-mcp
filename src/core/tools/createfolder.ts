import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const CreatefolderInputSchema = z.object({
  folderid: z
    .number()
    .int()
    .gte(0)
    .optional()
    .default(0)
    .describe('Parent folder ID (0 for root)'),
  name: z.string().min(1).describe('Name of the new folder'),
});

export const CreatefolderOutputSchema = PcloudSuccess.extend({
  metadata: PcloudMetadata,
});

export async function createfolderHandler(
  args: { folderid: number; name: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof CreatefolderOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof CreatefolderOutputSchema>>(
    'createfolder',
    { folderid: args.folderid, name: args.name }
  );
  return {
    content: [
      {
        type: "text",
        text: `Created folder "${args.name}" with ID ${response.metadata?.folderid ?? response.metadata?.id ?? "?"}`,
      },
    ],
    structuredContent: response,
  };
}
