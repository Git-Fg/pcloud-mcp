import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const UserinfoInputSchema = z.object({});

export const UserinfoOutputSchema = PcloudSuccess;

export const UserinfoToolMeta: ToolMeta<typeof UserinfoInputSchema> = {
  title: 'Get pCloud User Info',
  description: 'Get account info for the authenticated pCloud user (id, email, quota, premium status).',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: UserinfoInputSchema,
};

export async function userinfoHandler(
  _args: Record<string, never>,
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof UserinfoOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const response = await client.json<z.infer<typeof UserinfoOutputSchema>>(
    'userinfo',
    {}
  );
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    structuredContent: response,
  };
}
