import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const GetfilepublinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional(),
    path: z.string().optional(),
    expire: z.string().optional(),
    maxdownloads: z.number().int().positive().optional(),
    maxtraffic: z.number().int().nonnegative().optional(),
    shortlink: z.boolean().optional(),
    linkpassword: z.string().optional(),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetfilepublinkOutputSchema = PcloudSuccess.extend({
  linkid: z.union([z.string(), z.number()]).optional(),
  link: z.string().optional(),
  code: z.string().optional(),
  shortlink: z.string().optional(),
  shortcode: z.string().optional(),
});

export const GetfilepublinkToolMeta: ToolMeta<typeof GetfilepublinkInputSchema> = {
  title: 'Create Public Link to a File',
  description:
    'Create a public share link to a file. Returns the link URL and code. Optional constraints: ' +
    'expire, maxdownloads, maxtraffic, shortlink, linkpassword. Note: pCloud restricts the ' +
    'referrer to pcloud.com for these links, so some embedded preview flows will not work.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: GetfilepublinkInputSchema,
};

export async function getfilepublinkHandler(
  args: {
    fileid?: number;
    path?: string;
    expire?: string;
    maxdownloads?: number;
    maxtraffic?: number;
    shortlink?: boolean;
    linkpassword?: string;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof GetfilepublinkOutputSchema>;
}> {
  args = GetfilepublinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  if (args.expire !== undefined) params.expire = args.expire;
  if (args.maxdownloads !== undefined) params.maxdownloads = args.maxdownloads;
  if (args.maxtraffic !== undefined) params.maxtraffic = args.maxtraffic;
  if (args.shortlink) params.shortlink = 1;
  if (args.linkpassword !== undefined) params.linkpassword = args.linkpassword;
  const response = await client.json<z.infer<typeof GetfilepublinkOutputSchema>>(
    'getfilepublink',
    params
  );
  return {
    content: [
      {
        type: 'text',
        text: `Public link created: ${response.link ?? '?'} (code=${response.code ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
