import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const GetthumblinkInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID of the image'),
    path: z.string().optional().describe('Path to the image (mutually exclusive with fileid)'),
    size: z
      .string()
      .regex(/^\d{2,4}x\d{2,4}$/)
      .describe('Thumbnail size, WIDTHxHEIGHT (width 16–2048, height 16–1024; both divisible by 4 or 5)'),
    crop: z.boolean().optional().describe('If true, crop to exactly the requested size (may cut edges)'),
    type: z.enum(['jpeg', 'png']).optional().describe('Output format (default jpeg)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const GetthumblinkOutputSchema = PcloudSuccess.extend({
  hosts: z.array(z.string()),
  path: z.string(),
  size: z.string().describe('The real produced size; may differ from the requested one unless crop was set'),
});

export async function getthumblinkHandler(
  args: { fileid?: number; path?: string; size: string; crop?: boolean; type?: 'jpeg' | 'png' },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof GetthumblinkOutputSchema>;
}> {
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
  const thumbUrl = response.hosts.length
    ? `https://${response.hosts[0]}${response.path}`
    : 'No thumbnail URL available';
  return {
    content: [{ type: "text", text: `Thumbnail URL (${response.size}): ${thumbUrl}` }],
    structuredContent: response,
  };
}
