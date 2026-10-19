import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const GetvideolinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID of the video'),
    path: z.string().optional().describe('Path to the video (mutually exclusive with fileid)'),
    forcedownload: z.boolean().optional()
      .describe('If true, force Content-Disposition: attachment'),
    contenttype: z.string().optional().describe('Override the response Content-Type'),
    maxspeed: z.number().int().positive().optional().describe('Throttle the download speed (bytes/sec)'),
    skipfilename: z.boolean().optional().describe('If true, omit the filename from Content-Disposition'),
    abitrate: z.number().int().min(16).max(320).optional().describe('Audio bitrate in kbit (16–320, default 128)'),
    vbitrate: z.number().int().min(16).max(4000).optional().describe('Initial video bitrate in kbit (16–4000, default 1000, adaptive unless fixedbitrate)'),
    resolution: z
      .string()
      .regex(/^\d{2,4}x\d{2,4}$/)
      .optional()
      .describe('Transcode resolution WIDTHxHEIGHT (64x64 to 1280x960)'),
    fixedbitrate: z.boolean().optional().describe('If true, disable adaptive streaming (constant bitrate)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetvideolinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
});

export async function getvideolinkHandler(
  args: {
    fileid?: number;
    path?: string;
    forcedownload?: boolean;
    contenttype?: string;
    maxspeed?: number;
    skipfilename?: boolean;
    abitrate?: number;
    vbitrate?: number;
    resolution?: string;
    fixedbitrate?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetvideolinkOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  if (args.forcedownload) params.forcedownload = 1;
  if (args.contenttype !== undefined) params.contenttype = args.contenttype;
  if (args.maxspeed !== undefined) params.maxspeed = args.maxspeed;
  if (args.skipfilename) params.skipfilename = 1;
  if (args.abitrate !== undefined) params.abitrate = args.abitrate;
  if (args.vbitrate !== undefined) params.vbitrate = args.vbitrate;
  if (args.resolution !== undefined) params.resolution = args.resolution;
  if (args.fixedbitrate) params.fixedbitrate = 1;

  const response = await client.json<z.infer<typeof GetvideolinkOutputSchema>>(
    'getvideolink',
    params
  );
  const streamUrl = response.hosts.length
    ? `https://${response.hosts[0]}${response.path}`
    : 'No stream URL available';
  return {
    content: [{ type: "text", text: `Video stream URL (append &start=<seconds> to seek): ${streamUrl}` }],
    structuredContent: response,
  };
}
