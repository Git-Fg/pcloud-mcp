import { stat as fsStat } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { readFileChunked, makeProgressNotifier, type ToolCtx } from '../http/upload.js';
import { PcloudSuccess } from './schemas.js';

export const UploadfileInputSchema = z
  .object({
    filePath: z.string().describe('Local filesystem path of the file to upload'),
    folderid: z.number().int().nonnegative().optional().describe('Destination folder ID (default 0 = root)'),
    path: z.string().optional().describe('Destination path (discouraged; prefer folderid + filename)'),
    filename: z.string().optional().describe('Override filename in pCloud; defaults to the basename of filePath'),
    renameifexists: z.boolean().optional().describe('If true, append (2)/(3)… instead of overwriting'),
    nopartial: z.boolean().optional().describe('If true, discard the file on a connection drop instead of saving a partial'),
  })
  .refine((v) => v.folderid !== undefined || v.path !== undefined, {
    message: 'Provide folderid or path',
  });

export const UploadfileOutputSchema = PcloudSuccess.extend({
  fileids: z.array(z.number().int().positive()).optional(),
  metadata: z.array(z.object({}).passthrough()).optional(),
});

export async function uploadfileHandler(
  args: {
    filePath: string;
    folderid?: number;
    path?: string;
    filename?: string;
    renameifexists?: boolean;
    nopartial?: boolean;
  },
  ctx: ToolCtx
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof UploadfileOutputSchema>;
}> {
  args = UploadfileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const fileStat = await fsStat(args.filePath);
  const filename = args.filename ?? basename(args.filePath);
  const fields: Record<string, string | number> = {};
  if (args.path !== undefined) fields.path = args.path;
  else fields.folderid = args.folderid!;
  fields.filename = filename;
  if (args.renameifexists) fields.renameifexists = 1;
  if (args.nopartial) fields.nopartial = 1;

  const notifyProgress = makeProgressNotifier(ctx, fileStat.size, filename);
  const buf = await readFileChunked(args.filePath, (bytes) => notifyProgress?.(bytes, 'read'));
  notifyProgress?.(fileStat.size, 'uploading');

  const response = (await client.upload('uploadfile', fields, {
    blob: new Blob([new Uint8Array(buf)]),
    filename,
  })) as z.infer<typeof UploadfileOutputSchema>;
  return {
    content: [
      {
        type: 'text',
        text: `Uploaded ${filename} (${fileStat.size} bytes) → fileids=${JSON.stringify(response.fileids ?? response.metadata?.map((m: { fileid?: number }) => m.fileid) ?? [])}`,
      },
    ],
    structuredContent: response,
  };
}
