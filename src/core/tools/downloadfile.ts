import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const DownloadfileInputSchema = z
  .object({
    url: z.string().min(1).describe('One or more URLs to download, separated by whitespace'),
    folderid: z.number().int().nonnegative().optional()
      .describe('Destination folder ID (default 0 = root)'),
    path: z.string().optional()
      .describe('Destination path (discouraged; prefer folderid)'),
    target: z.string().optional()
      .describe('Comma-separated urlencoded list of desired filenames, one per URL. Empty positions keep the URL-derived name.'),
    progresshash: z.string().optional()
      .describe('Optional client-side progress token (not polled by the MCP server; returned to the caller for its own tracking).'),
  })
  .refine((v) => v.folderid === undefined || v.path === undefined, {
    message: 'Provide at most one of folderid or path (or neither for root)',
  });

export const DownloadfileOutputSchema = PcloudSuccess.extend({
  metadata: z.array(PcloudMetadata).optional(),
});

/**
 * Server-side download: pCloud fetches the URL(s) and stores the result(s)
 * in the destination folder. This is the inverse of uploadfile — no bytes
 * cross the MCP server, pCloud does the fetching. Blocks until all URLs are
 * downloaded, so large downloads will hold the tool call open.
 */
export async function downloadfileHandler(
  args: { url: string; folderid?: number; path?: string; target?: string; progresshash?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof DownloadfileOutputSchema>;
}> {
  args = DownloadfileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = { url: args.url };
  if (args.folderid !== undefined) params.folderid = args.folderid;
  if (args.path !== undefined) params.path = args.path;
  if (args.target !== undefined) params.target = args.target;
  if (args.progresshash !== undefined) params.progresshash = args.progresshash;

  const response = await client.json<z.infer<typeof DownloadfileOutputSchema>>(
    'downloadfile',
    params
  );
  const count = response.metadata?.length ?? 0;
  return {
    content: [
      {
        type: 'text',
        text: `Downloaded ${count} file(s): ${JSON.stringify(response.metadata?.map((m) => ({ name: m.name, fileid: m.fileid })) ?? [])}`,
      },
    ],
    structuredContent: response,
  };
}
