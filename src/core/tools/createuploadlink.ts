import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const CreateuploadlinkInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional().describe('Destination folder id (owned by user)'),
    path: z.string().optional().describe('Destination folder path (mutually exclusive with folderid)'),
    comment: z.string().min(1).describe('Comment shown to uploaders (required)'),
    expire: z.string().optional().describe('Datetime at which the link expires'),
    maxspace: z.number().int().nonnegative().optional().describe('Max total bytes the link will accept'),
    maxfiles: z.number().int().nonnegative().optional().describe('Max total files the link will accept'),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path',
  });

export const CreateuploadlinkOutputSchema = PcloudSuccess.extend({
  uploadlinkid: z.number().int().positive().optional(),
  link: z.string().optional(),
  mail: z.string().optional(),
  code: z.string().optional(),
});

export const CreateuploadlinkToolMeta: ToolMeta<typeof CreateuploadlinkInputSchema> = {
  title: 'Create an Upload Link',
  description:
    'Create an upload link that lets anyone with the link upload files into a folder you own. ' +
    'comment is required and is the only context uploaders see. Optional expire / maxspace / maxfiles. ' +
    'Returns the uploadlinkid, the public link URL, a mail-upload address, and the upload code.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: CreateuploadlinkInputSchema,
};

export async function createuploadlinkHandler(
  args: {
    folderid?: number;
    path?: string;
    comment: string;
    expire?: string;
    maxspace?: number;
    maxfiles?: number;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof CreateuploadlinkOutputSchema>;
}> {
  args = CreateuploadlinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {
    comment: args.comment,
  };
  if (args.folderid !== undefined) params.folderid = args.folderid;
  else params.path = args.path!;
  if (args.expire !== undefined) params.expire = args.expire;
  if (args.maxspace !== undefined) params.maxspace = args.maxspace;
  if (args.maxfiles !== undefined) params.maxfiles = args.maxfiles;
  const response = await client.json<z.infer<typeof CreateuploadlinkOutputSchema>>(
    'createuploadlink',
    params
  );
  return {
    content: [
      {
        type: 'text',
        text: `Upload link created: ${response.link ?? '?'} (code=${response.code ?? '?'}, uploadlinkid=${response.uploadlinkid ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
