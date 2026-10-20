import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const ExtractarchiveInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID of the archive'),
    path: z.string().optional().describe('Path to the archive (mutually exclusive with fileid)'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination folder ID (0 = root)'),
    topath: z.string().optional().describe('Destination folder path'),
    toname: z.string().optional().describe('Name for the extracted output'),
    password: z.string().optional().describe('Password for a password-protected archive (else pCloud returns 7009)'),
    nooutput: z.boolean().optional().describe('If true, omit the extraction output lines from the response'),
    overwrite: z.enum(['rename', 'overwrite', 'skip']).optional()
      .describe("What to do when a target file already exists (default 'rename')"),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  })
  .refine(
    (v) => v.tofolderid !== undefined || v.topath !== undefined || v.toname !== undefined,
    { message: "Provide at least one of topath, tofolderid or toname" }
  );

export const ExtractarchiveOutputSchema = PcloudSuccess.extend({
  finished: z.boolean()
    .describe('True when pCloud finished the extraction within its ~2s window; otherwise poll with progresshash'),
  progresshash: z.string().optional().describe('Poll token for extractarchiveprogress when finished=false'),
  lines: z.number().int().optional().describe('Number of output lines already returned'),
  output: z.array(z.string()).optional().describe('Extraction program output lines'),
  hostname: z.string().optional().describe('Server running the extraction (polling must target this host)'),
  ip: z.string().optional().describe('IPv4 of the extraction server'),
});

export const ExtractarchiveToolMeta: ToolMeta<typeof ExtractarchiveInputSchema> = {
  title: 'Extract an Archive',
  description:
    'Ask pCloud to extract an archive (zip/tar/etc.) already in your filesystem into a destination ' +
    'folder. Runs for ~2s; if the extraction finishes in that window, `finished=true` in the ' +
    'response, otherwise `finished=false` and `progresshash` is returned, poll it on the ' +
    '`hostname` returned in the same response. On a password-protected archive, pCloud returns ' +
    'error 7009: retry with the `password` parameter. `overwrite` (default "rename") controls ' +
    'behaviour on name conflicts.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: ExtractarchiveInputSchema,
};

export async function extractarchiveHandler(
  args: {
    fileid?: number;
    path?: string;
    tofolderid?: number;
    topath?: string;
    toname?: string;
    password?: string;
    nooutput?: boolean;
    overwrite?: 'rename' | 'overwrite' | 'skip';
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ExtractarchiveOutputSchema>;
}> {
  args = ExtractarchiveInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  if (args.tofolderid !== undefined) params.tofolderid = args.tofolderid;
  if (args.topath !== undefined) params.topath = args.topath;
  if (args.toname !== undefined) params.toname = args.toname;
  if (args.password !== undefined) params.password = args.password;
  if (args.nooutput) params.nooutput = 1;
  if (args.overwrite !== undefined) params.overwrite = args.overwrite;

  const response = await client.json<z.infer<typeof ExtractarchiveOutputSchema>>(
    'extractarchive',
    params
  );
  const summary = response.finished
    ? `Extraction finished (${response.lines ?? 0} output lines)`
    : `Extraction running, poll extractarchiveprogress with hash=${response.progresshash ?? '?'} on ${response.hostname ?? 'the same server'}`;
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: response,
  };
}
