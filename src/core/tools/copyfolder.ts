import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const CopyfolderInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional().describe('Source folder id (mutually exclusive with path)'),
    path: z.string().optional().describe('Source folder path (mutually exclusive with folderid)'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination parent folder id'),
    topath: z.string().optional().describe('Destination path (mutually exclusive with tofolderid unless toname also given)'),
    toname: z.string().optional().describe('Destination folder name'),
    noover: z.boolean().optional().describe('If true and a conflict exists, fail with 2004'),
    skipexisting: z.boolean().optional().describe('If true, skip files that already exist in the destination'),
    copycontentonly: z.boolean().optional().describe('If true, copy the contents of source into dest rather than nesting under dest'),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path for the source',
  })
  .refine(
    (v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined,
    { message: 'Provide a destination: topath, or one of tofolderid/toname' }
  );

export const CopyfolderOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const CopyfolderToolMeta: ToolMeta<typeof CopyfolderInputSchema> = {
  title: 'Copy a Folder',
  description:
    'Server-side copy of a folder. Source by folderid or path; destination by topath, or ' +
    'tofolderid (+ optional toname). set copycontentonly=true to copy the contents of the ' +
    'source into the destination rather than nesting a new folder under it. skipexisting ' +
    'and noover control conflict behaviour.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: CopyfolderInputSchema,
};

export async function copyfolderHandler(
  args: {
    folderid?: number;
    path?: string;
    tofolderid?: number;
    topath?: string;
    toname?: string;
    noover?: boolean;
    skipexisting?: boolean;
    copycontentonly?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof CopyfolderOutputSchema>;
}> {
  args = CopyfolderInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.folderid !== undefined) params.folderid = args.folderid;
  else params.path = args.path!;
  if (args.tofolderid !== undefined) params.tofolderid = args.tofolderid;
  if (args.topath !== undefined) params.topath = args.topath;
  if (args.toname !== undefined) params.toname = args.toname;
  if (args.noover) params.noover = 1;
  if (args.skipexisting) params.skipexisting = 1;
  if (args.copycontentonly) params.copycontentonly = 1;
  const response = await client.json<z.infer<typeof CopyfolderOutputSchema>>('copyfolder', params);
  return {
    content: [
      {
        type: 'text',
        text: `Copied folder → new folderid=${response.metadata.folderid ?? '?'} (path=${response.metadata.path ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
