import { stat as fsStat } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { readFileChunked, makeProgressNotifier, type ToolCtx } from '../http/upload.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const UploadtolinkInputSchema = z
  .object({
    code: z.string().min(1).describe('Upload link code returned by createuploadlink'),
    filePath: z.string().describe('Local filesystem path of the file to upload'),
    filename: z.string().optional().describe('Override filename on pCloud (defaults to basename of filePath)'),
    nopartial: z.boolean().optional().describe('If true, partially uploaded files are discarded on connection drop'),
    progresshash: z.string().optional().describe('Hash used with uploadlinkprogress to poll progress'),
  })
  .refine((v) => v.code.length > 0 && v.filePath.length > 0, {
    message: 'code and filePath are required',
  });

export const UploadtolinkOutputSchema = PcloudSuccess.extend({
  fileids: z.array(z.number().int().positive()).optional(),
  metadata: z.array(z.object({}).passthrough()).optional(),
});

export const UploadtolinkToolMeta: ToolMeta<typeof UploadtolinkInputSchema> = {
  title: 'Upload a File to an Upload Link',
  description:
    'Upload a local file to a pCloud upload link by code. The link owner gets the file in the ' +
    'destination folder. No access token is sent — pCloud authenticates by the link code. ' +
    'Emits notifications/progress while reading the local file.',
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  inputSchema: UploadtolinkInputSchema,
};

export async function uploadtolinkHandler(
  args: {
    code: string;
    filePath: string;
    filename?: string;
    nopartial?: boolean;
    progresshash?: string;
  },
  ctx: ToolCtx
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof UploadtolinkOutputSchema>;
}> {
  args = UploadtolinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const fileStat = await fsStat(args.filePath);
  const filename = args.filename ?? basename(args.filePath);
  const fields: Record<string, string | number> = {
    code: args.code,
    filename,
  };
  if (args.nopartial) fields.nopartial = 1;
  if (args.progresshash) fields.progresshash = args.progresshash;

  const notifyProgress = makeProgressNotifier(ctx, fileStat.size, filename);
  const buf = await readFileChunked(args.filePath, (bytes) => notifyProgress?.(bytes, 'read'));
  notifyProgress?.(fileStat.size, 'uploading');

  const response = (await client.upload('uploadtolink', fields, {
    blob: new Blob([new Uint8Array(buf)]),
    filename,
  }, { auth: false })) as z.infer<typeof UploadtolinkOutputSchema>;
  return {
    content: [
      {
        type: 'text',
        text: `Uploaded ${filename} (${fileStat.size} bytes) to upload link (code=${args.code}) → fileids=${JSON.stringify(response.fileids ?? [])}`,
      },
    ],
    structuredContent: response,
  };
}
