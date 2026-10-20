import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const CurrentserverInputSchema = z.object({});

export const CurrentserverOutputSchema = PcloudSuccess.extend({
  hostname: z.string().describe('Hostname of the server handling this request'),
  ip: z.string().describe('IPv4 address of the server'),
  ipbin: z.string().optional().describe('IPv4 address of the binary-protocol endpoint'),
  ipv6: z.string().optional().describe('IPv6 address of the server'),
});

export const CurrentserverToolMeta: ToolMeta<typeof CurrentserverInputSchema> = {
  title: 'Get Current API Server',
  description:
    'Return the ip and hostname of the server currently handling requests (no auth required). ' +
    'The hostname resolves only to the same server. Useful to pin an upload target when polling ' +
    'upload progress.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: CurrentserverInputSchema,
};

export async function currentserverHandler(
  _args: Record<string, never>,
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof CurrentserverOutputSchema>;
}> {
  CurrentserverInputSchema.parse(_args);
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof CurrentserverOutputSchema>>('currentserver', {});
  return {
    content: [
      {
        type: 'text',
        text: `Current server: ${response.hostname} (${response.ip})`,
      },
    ],
    structuredContent: response,
  };
}
