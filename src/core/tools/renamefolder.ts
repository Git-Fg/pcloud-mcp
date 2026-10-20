import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const RenamefolderInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional().describe('Source folder ID'),
    path: z.string().optional().describe('Source folder path (discouraged)'),
    topath: z.string().optional().describe('Destination path; must end with `/` if you only want to move into a folder without renaming'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination parent folder ID'),
    toname: z.string().optional().describe('New folder name'),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path for the source',
  })
  .refine((v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined, {
    message: 'Provide a destination: topath, or tofolderid/toname',
  });

export const RenamefolderOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const RenamefolderToolMeta: ToolMeta<typeof RenamefolderInputSchema> = {
  title: 'Rename / Move Folder',
  description: 'Rename or move a folder in a single atomic call. Provide topath, or tofolderid+toname.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: RenamefolderInputSchema,
};

export async function renamefolderHandler(
  args: {
    folderid?: number;
    path?: string;
    topath?: string;
    tofolderid?: number;
    toname?: string;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof RenamefolderOutputSchema>;
}> {
  args = RenamefolderInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.folderid !== undefined) params.folderid = args.folderid;
  else params.path = args.path!;
  if (args.topath !== undefined) params.topath = args.topath;
  if (args.tofolderid !== undefined) params.tofolderid = args.tofolderid;
  if (args.toname !== undefined) params.toname = args.toname;
  const response = await client.json<z.infer<typeof RenamefolderOutputSchema>>('renamefolder', params);
  return {
    content: [{ type: "text", text: `Renamed to ${response.metadata.path ?? response.metadata.name}` }],
    structuredContent: response,
  };
}
