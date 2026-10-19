import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const GetfilelinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to get a download link for'),
    path: z.string().optional().describe('Path to file (mutually exclusive with fileid)'),
    forcedownload: z.boolean().optional()
      .describe('If true, force Content-Disposition: attachment (download instead of inline)'),
    contenttype: z.string().optional()
      .describe('Override the response Content-Type (e.g. "application/octet-stream")'),
    maxspeed: z.number().int().positive().optional()
      .describe('Throttle the download to this many bytes per second'),
    skipfilename: z.boolean().optional()
      .describe('If true, omit the filename from Content-Disposition'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetfilelinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
});

export async function getfilelinkHandler(
  args: {
    fileid?: number;
    path?: string;
    forcedownload?: boolean;
    contenttype?: string;
    maxspeed?: number;
    skipfilename?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetfilelinkOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  if (args.forcedownload) params.forcedownload = 1;
  if (args.contenttype !== undefined) params.contenttype = args.contenttype;
  if (args.maxspeed !== undefined) params.maxspeed = args.maxspeed;
  if (args.skipfilename) params.skipfilename = 1;

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
