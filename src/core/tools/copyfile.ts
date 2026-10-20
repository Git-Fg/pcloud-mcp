import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const CopyfileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('Source file id (mutually exclusive with path)'),
    path: z.string().optional().describe('Source file path (mutually exclusive with fileid)'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination folder id'),
    topath: z.string().optional().describe('Destination path (mutually exclusive with tofolderid unless toname also given)'),
    toname: z.string().optional().describe('Destination filename; defaults to the source filename'),
    noover: z.boolean().optional().describe('If true and the destination exists, fail with 2004 instead of overwriting'),
    mtime: z.number().int().optional().describe('Set modified time (unix seconds)'),
    ctime: z.number().int().optional().describe('Set created time (unix seconds); requires mtime'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path for the source',
  })
  .refine(
    (v) =>
      v.topath !== undefined ||
      v.tofolderid !== undefined ||
      v.toname !== undefined,
    { message: 'Provide a destination: topath, or one of tofolderid/toname' }
  );

export const CopyfileOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const CopyfileToolMeta: ToolMeta<typeof CopyfileInputSchema> = {
  title: 'Copy a File',
  description:
    'Server-side copy of a file. Source by fileid or path; destination by topath, or ' +
    'tofolderid (+ optional toname). If toname is omitted, the source filename is used. ' +
    'The copy is a new, independent file. Optionally set noover=true to fail on conflicts ' +
    'instead of overwriting, and mtime/ctime to pin timestamps (unix seconds).',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: CopyfileInputSchema,
};

export async function copyfileHandler(
  args: {
    fileid?: number;
    path?: string;
    tofolderid?: number;
    topath?: string;
    toname?: string;
    noover?: boolean;
    mtime?: number;
    ctime?: number;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof CopyfileOutputSchema>;
}> {
  args = CopyfileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.fileid !== undefined) params.fileid = args.fileid;
  else params.path = args.path!;
  if (args.tofolderid !== undefined) params.tofolderid = args.tofolderid;
  if (args.topath !== undefined) params.topath = args.topath;
  if (args.toname !== undefined) params.toname = args.toname;
  if (args.noover) params.noover = 1;
  if (args.mtime !== undefined) params.mtime = args.mtime;
  if (args.ctime !== undefined) params.ctime = args.ctime;
  const response = await client.json<z.infer<typeof CopyfileOutputSchema>>('copyfile', params);
  return {
    content: [
      {
        type: 'text',
        text: `Copied file → new fileid=${response.metadata.fileid ?? '?'} (path=${response.metadata.path ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
