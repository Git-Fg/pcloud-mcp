import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const ShowuploadlinkInputSchema = z.object({
  uploadlinkid: z.number().int().positive().describe('Upload link id returned by createuploadlink'),
  expire: z.string().optional(),
  deleteexpire: z.boolean().optional(),
  maxspace: z.number().int().nonnegative().optional(),
  maxfiles: z.number().int().nonnegative().optional(),
});

export const ShowuploadlinkOutputSchema = PcloudSuccess.extend({
  uploadlinkid: z.number().int().positive().optional(),
  code: z.string().optional(),
  link: z.string().optional(),
  mail: z.string().optional(),
  comment: z.string().optional(),
  expires: z.string().optional(),
  maxspace: z.number().int().nonnegative().optional(),
  maxfiles: z.number().int().nonnegative().optional(),
});

export async function showuploadlinkHandler(
  args: {
    uploadlinkid: number;
    expire?: string;
    deleteexpire?: boolean;
    maxspace?: number;
    maxfiles?: number;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof ShowuploadlinkOutputSchema>;
}> {
  args = ShowuploadlinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = { uploadlinkid: args.uploadlinkid };
  if (args.expire !== undefined) params.expire = args.expire;
  if (args.deleteexpire) params.deleteexpire = 1;
  if (args.maxspace !== undefined) params.maxspace = args.maxspace;
  if (args.maxfiles !== undefined) params.maxfiles = args.maxfiles;
  const response = await client.json<z.infer<typeof ShowuploadlinkOutputSchema>>('showuploadlink', params);
  return {
    content: [
      {
        type: 'text',
        text: `Upload link ${args.uploadlinkid}: code=${response.code ?? '?'}, comment=${response.comment ?? '?'}`,
      },
    ],
    structuredContent: response,
  };
}
