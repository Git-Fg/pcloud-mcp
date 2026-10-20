import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const ListpublinksInputSchema = z.object({});

export const ListpublinksOutputSchema = PcloudSuccess.extend({
  publinks: z.array(z.object({}).passthrough()).optional(),
  count: z.union([z.string(), z.number()]).optional(),
});

export const ListpublinksToolMeta: ToolMeta<typeof ListpublinksInputSchema> = {
  title: 'List All Public Links',
  description: 'Return every public link the account has created, with their metadata, expiry, and traffic/download counters.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ListpublinksInputSchema,
};

export async function listpublinksHandler(
  _args: Record<string, never>,
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof ListpublinksOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof ListpublinksOutputSchema>>('listpublinks', {});
  return {
    content: [
      { type: 'text', text: `Found ${response.publinks?.length ?? response.count ?? 0} public link(s)` },
    ],
    structuredContent: response,
  };
}
