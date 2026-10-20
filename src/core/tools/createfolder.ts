import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

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

export const CreatefolderToolMeta: ToolMeta<typeof CreatefolderInputSchema> = {
  title: 'Create pCloud Folder',
  description: 'Create a new folder under a parent folder (id 0 = root). Errors if the name already exists.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: CreatefolderInputSchema,
};

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
