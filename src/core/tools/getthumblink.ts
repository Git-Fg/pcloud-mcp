import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const GetthumblinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID of the image'),
    path: z.string().optional().describe('Path to the image (mutually exclusive with fileid)'),
    size: z
      .string()
      .regex(/^\d{2,4}x\d{2,4}$/, 'Format must be WIDTHxHEIGHT, e.g. 1280x720')
      .refine(
        (s) => {
          const [w, h] = s.split('x').map(Number) as [number, number];
          return (
            w >= 16 && w <= 2048 && h >= 16 && h <= 1024 &&
            (w % 4 === 0 || w % 5 === 0) && (h % 4 === 0 || h % 5 === 0)
          );
        },
        { message: 'width must be 16–2048 and height 16–1024; each dimension divisible by 4 or 5' }
      )
      .describe('Thumbnail size, WIDTHxHEIGHT (width 16–2048, height 16–1024; both divisible by 4 or 5)'),
    crop: z.boolean().optional().describe('If true, crop to exactly the requested size (may cut edges)'),
    type: z.literal('png').optional().describe('Only "png" is documented (default format is jpeg)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetthumblinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
  size: z.string().describe('The real produced size; may differ from the requested one unless crop was set'),
});

export const GetthumblinkToolMeta: ToolMeta<typeof GetthumblinkInputSchema> = {
  title: 'Get Image Thumbnail Link',
  description:
    'Return a thumbnail download URL for an image file. size is required (WIDTHxHEIGHT; width ' +
    '16–2048, height 16–1024, both divisible by 4 or 5, pCloud returns error 1015 otherwise). ' +
    'Set crop=true for exactly the requested size (edges may be cut), type=png for PNG output ' +
    '(default jpeg). Works only on files whose metadata has thumb=true (error 1014 otherwise). ' +
    'Thumbnails are created on first request and cached server-side; re-request after the file ' +
    'hash changes.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: GetthumblinkInputSchema,
};

export async function getthumblinkHandler(
  args: { fileid?: number; path?: string; size: string; crop?: boolean; type?: 'png' },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetthumblinkOutputSchema>;
}> {
  args = GetthumblinkInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number | boolean> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  params.size = args.size;
  if (args.crop) params.crop = 1;
  if (args.type !== undefined) params.type = args.type;

  const response = await client.json<z.infer<typeof GetthumblinkOutputSchema>>(
    'getthumblink',
    params
  );
  if (!Array.isArray(response.hosts) || response.hosts.length === 0) {
    throw new Error(
      'getthumblink: pCloud returned result:0 but no thumbnail hosts. No thumbnail may exist for this file.'
    );
  }
  const thumbUrl = `https://${response.hosts[0]}${response.path}`;
  return {
    content: [{ type: "text", text: `Thumbnail URL (${response.size}): ${thumbUrl}` }],
    structuredContent: response,
  };
}
