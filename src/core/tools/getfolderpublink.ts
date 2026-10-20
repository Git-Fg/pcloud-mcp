import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const GetfolderpublinkInputSchema = z
  .object({
    folderid: z.number().int().nonnegative().optional(),
    path: z.string().optional(),
    expire: z.string().optional(),
    maxdownloads: z.number().int().positive().optional(),
    maxtraffic: z.number().int().nonnegative().optional(),
    shortlink: z.boolean().optional(),
    linkpassword: z.string().optional(),
  })
  .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of folderid or path',
  });

export const GetfolderpublinkOutputSchema = PcloudSuccess.extend({
  linkid: z.union([z.string(), z.number()]).optional(),
  link: z.string().optional(),
  code: z.string().optional(),
  shortlink: z.string().optional(),
  shortcode: z.string().optional(),
});

export const GetfolderpublinkToolMeta: ToolMeta<typeof GetfolderpublinkInputSchema> = {
  title: 'Create Public Link to a Folder',
  description:
    'Create a public share link to a folder. Same optional constraints as getfilepublink; ' +
    'maxdownloads here limits total downloads from the folder, not per-file. Root folder ' +
    '(folderid=0) cannot be shared.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: GetfolderpublinkInputSchema,
};

export async function getfolderpublinkHandler(
  args: {
    folderid?: number;
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
  structuredContent: z.infer<typeof GetfolderpublinkOutputSchema>;
}> {
  args = GetfolderpublinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.folderid !== undefined ? { folderid: args.folderid } : { path: args.path! };
  if (args.expire !== undefined) params.expire = args.expire;
  if (args.maxdownloads !== undefined) params.maxdownloads = args.maxdownloads;
  if (args.maxtraffic !== undefined) params.maxtraffic = args.maxtraffic;
  if (args.shortlink) params.shortlink = 1;
  if (args.linkpassword !== undefined) params.linkpassword = args.linkpassword;
  const response = await client.json<z.infer<typeof GetfolderpublinkOutputSchema>>(
    'getfolderpublink',
    params
  );
  return {
    content: [
      {
        type: 'text',
        text: `Public folder link created: ${response.link ?? '?'} (code=${response.code ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
