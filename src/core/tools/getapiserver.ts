import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const GetapiserverInputSchema = z.object({});

export const GetapiserverOutputSchema = PcloudSuccess.extend({
  api: z.array(z.string()).describe('API servers supporting the HTTP/HTTPS protocol'),
  binapi: z.array(z.string()).optional().describe('API servers supporting the binary protocol'),
});

export async function getapiserverHandler(
  _args: Record<string, never>,
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetapiserverOutputSchema>;
}> {
  GetapiserverInputSchema.parse(_args);
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof GetapiserverOutputSchema>>('getapiserver', {});
  if (!Array.isArray(response.api) || response.api.length === 0) {
    throw new Error('getapiserver: pCloud returned result:0 but an empty server list');
  }
  const closest = response.api[0];
  return {
    content: [
      {
        type: 'text',
        text: `Closest API server: ${closest} (all: ${response.api.join(', ')}). Fall back to api.pcloud.com if a regional server fails.`,
      },
    ],
    structuredContent: response,
  };
}
