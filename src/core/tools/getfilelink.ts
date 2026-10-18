import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const GetfilelinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to get a download link for'),
    path: z.string().optional().describe('Path to file (mutually exclusive with fileid)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetfilelinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
});

export async function getfilelinkHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetfilelinkOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof GetfilelinkOutputSchema>>(
    'getfilelink',
    params
  );
  const downloadUrl = response.hosts.length
    ? `https://${response.hosts[0]}${response.path}`
    : 'No download URL available';
  return {
    content: [{ type: "text", text: `Download URL: ${downloadUrl}` }],
    structuredContent: response,
  };
}
