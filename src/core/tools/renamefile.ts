import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const RenamefileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('Source file ID'),
    path: z.string().optional().describe('Source file path (discouraged)'),
    topath: z.string().optional().describe('Destination path; must end with `/` if you only want to move into a folder without renaming'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination folder ID'),
    toname: z.string().optional().describe('Destination filename'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path for the source',
  })
  .refine((v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined, {
    message: 'Provide a destination: topath, or tofolderid/toname',
  });

export const RenamefileOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export async function renamefileHandler(
  args: {
    fileid?: number;
    path?: string;
    topath?: string;
    tofolderid?: number;
    toname?: string;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof RenamefileOutputSchema>;
}> {
  args = RenamefileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.fileid !== undefined) params.fileid = args.fileid;
  else params.path = args.path!;
  if (args.topath !== undefined) params.topath = args.topath;
  if (args.tofolderid !== undefined) params.tofolderid = args.tofolderid;
  if (args.toname !== undefined) params.toname = args.toname;
  const response = await client.json<z.infer<typeof RenamefileOutputSchema>>('renamefile', params);
  return {
    content: [{ type: "text", text: `Renamed to ${response.metadata.path ?? response.metadata.name}` }],
    structuredContent: response,
  };
}
