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
    mtime: z.number().int().optional()
      .describe('Set the file\'s modified time (unix seconds). pCloud applies it after upload.'),
    ctime: z.number().int().optional()
      .describe('Set the file\'s creation time (unix seconds). mtime is required when ctime is set.'),
    progresshash: z.string().optional()
      .describe('Hash returned to the client for resumable-upload polling (used by pCloud\'s binary protocol, not by this MCP server).'),
  })
  .refine((v) => v.folderid === undefined || v.path === undefined, {
    message: 'Provide at most one of folderid or path (omit both to upload to the root folder)',
  })
  .refine((v) => v.ctime === undefined || v.mtime !== undefined, {
    message: 'ctime requires mtime to be set (pCloud rejects ctime without mtime)',
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
    mtime?: number;
    ctime?: number;
    progresshash?: string;
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
  else fields.folderid = args.folderid ?? 0;
  fields.filename = filename;
  if (args.renameifexists) fields.renameifexists = 1;
  if (args.nopartial) fields.nopartial = 1;
  if (args.mtime !== undefined) fields.mtime = args.mtime;
  if (args.ctime !== undefined) fields.ctime = args.ctime;
  if (args.progresshash !== undefined) fields.progresshash = args.progresshash;

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
