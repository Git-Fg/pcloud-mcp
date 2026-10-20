import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const GetaudiolinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID of the audio (or video) file'),
    path: z.string().optional().describe('Path to the file (mutually exclusive with fileid)'),
    forcedownload: z.boolean().optional()
      .describe('If true, force Content-Disposition: attachment'),
    contenttype: z.string().optional().describe('Override the response Content-Type'),
    abitrate: z.number().int().min(16).max(320).optional().describe('Audio bitrate in kbit (16–320, default 192)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetaudiolinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
});

export const GetaudiolinkToolMeta: ToolMeta<typeof GetaudiolinkInputSchema> = {
  title: 'Get Audio Streaming Link',
  description:
    'Return an MP3 streaming URL for an audio (or video) file, also usable to extract the ' +
    'audio track from a video, or to play FLAC etc. on MP3-only devices. abitrate controls the ' +
    'transcode bitrate (16–320 kbit, default 192). The generated link accepts a start GET ' +
    "parameter to skip ahead N seconds. This method can't be used from web applications. " +
    'Referrer is restricted to pcloud.com.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: GetaudiolinkInputSchema,
};

export async function getaudiolinkHandler(
  args: { fileid?: number; path?: string; forcedownload?: boolean; contenttype?: string; abitrate?: number },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetaudiolinkOutputSchema>;
}> {
  args = GetaudiolinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  if (args.forcedownload) params.forcedownload = 1;
  if (args.contenttype !== undefined) params.contenttype = args.contenttype;
  if (args.abitrate !== undefined) params.abitrate = args.abitrate;

  const response = await client.json<z.infer<typeof GetaudiolinkOutputSchema>>(
    'getaudiolink',
    params
  );
  if (!Array.isArray(response.hosts) || response.hosts.length === 0) {
    throw new Error(
      'getaudiolink: pCloud returned result:0 but no stream hosts. The file may not be a supported audio format.'
    );
  }
  const streamUrl = `https://${response.hosts[0]}${response.path}`;
  return {
    content: [{ type: "text", text: `Audio stream URL (MP3; append &start=<seconds> to seek): ${streamUrl}` }],
    structuredContent: response,
  };
}
