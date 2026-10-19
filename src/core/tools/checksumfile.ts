import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata } from './schemas.js';

export const ChecksumfileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to checksum'),
    path: z.string().optional().describe('Path to file (mutually exclusive with fileid)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const ChecksumfileOutputSchema = z
  .object({
    sha1: z.string().describe('SHA-1 checksum (returned by both US and EU API servers)'),
    md5: z.string().optional().describe('MD5 checksum — US API servers only, not returned by EU'),
    sha256: z.string().optional().describe('SHA-256 checksum — EU API servers only, not returned by US'),
    metadata: PcloudMetadata,
  })
  .passthrough();

export async function checksumfileHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ChecksumfileOutputSchema>;
}> {
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof ChecksumfileOutputSchema>>(
    'checksumfile',
    params
  );
  return {
    content: [
      {
        type: 'text',
        text: `sha1=${response.sha1}${response.md5 ? ` md5=${response.md5}` : ''}${response.sha256 ? ` sha256=${response.sha256}` : ''}`,
      },
    ],
    structuredContent: response,
  };
}
