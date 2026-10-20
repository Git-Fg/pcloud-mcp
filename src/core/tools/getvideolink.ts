import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

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
      .regex(/^\d{2,4}x\d{2,4}$/, 'Format must be WIDTHxHEIGHT, e.g. 640x480')
      .refine(
        (s) => {
          const [w, h] = s.split('x').map(Number) as [number, number];
          return w >= 64 && w <= 1280 && h >= 64 && h <= 960;
        },
        { message: 'width must be 64–1280 and height 64–960' }
      )
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

export const GetvideolinkToolMeta: ToolMeta<typeof GetvideolinkInputSchema> = {
  title: 'Get Video Streaming Link',
  description:
    'Return a transcoded streaming URL for a video file (FLV container, x264/mp3, adaptive ' +
    'bitrate by default). Optional transcode controls: abitrate (16–320 kbit), vbitrate ' +
    '(16–4000 kbit), resolution (64x64–1280x960), fixedbitrate (disable adaptive streaming). ' +
    'The generated link accepts a start GET parameter to skip ahead N seconds. Returns error ' +
    "2044 if the file is not a video. This method can't be used from web applications. " +
    'Referrer is restricted to pcloud.com.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: GetvideolinkInputSchema,
};

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
  args = GetvideolinkInputSchema.parse(args);
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
  if (!Array.isArray(response.hosts) || response.hosts.length === 0) {
    throw new Error(
      'getvideolink: pCloud returned result:0 but no stream hosts. The file may not be a supported video format.'
    );
  }
  const streamUrl = `https://${response.hosts[0]}${response.path}`;
  return {
    content: [{ type: "text", text: `Video stream URL (append &start=<seconds> to seek): ${streamUrl}` }],
    structuredContent: response,
  };
}
