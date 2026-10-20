import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

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
    md5: z.string().optional().describe('MD5 checksum, US API servers only, not returned by EU'),
    sha256: z.string().optional().describe('SHA-256 checksum, EU API servers only, not returned by US'),
    metadata: PcloudMetadata,
  })
  .passthrough();

export const ChecksumfileToolMeta: ToolMeta<typeof ChecksumfileInputSchema> = {
  title: 'Get File Checksum(s)',
  description:
    'Return the cryptographic hash(es) for a file. SHA-1 is always returned. MD5 is added by ' +
    'US API servers, SHA-256 by EU API servers, call once on each region to get the full set. ' +
    'Use this to compare two files, or to verify an upload / download round-trip without ' +
    're-reading the bytes.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ChecksumfileInputSchema,
};

export async function checksumfileHandler(
  args: { fileid?: number; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ChecksumfileOutputSchema>;
}> {
  args = ChecksumfileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const response = await client.json<z.infer<typeof ChecksumfileOutputSchema>>(
    'checksumfile',
    params
  );
  if (typeof response.sha1 !== 'string') {
    throw new Error(
      'checksumfile: pCloud returned result:0 but no sha1 checksum. This is a server-side anomaly, retry, and verify the fileid with stat.'
    );
  }
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
