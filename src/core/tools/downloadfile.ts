import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

// Private IP ranges and localhost addresses to block (SSRF protection)
const PRIVATE_IP_REGEX =
  /^(?:10\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/;

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(u.protocol)) {
      return false;
    }
    // Block private/internal IPs
    const hostname = u.hostname;
    if (PRIVATE_IP_REGEX.test(hostname)) {
      return false;
    }
    // Block localhost variants
    if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
      return false;
    }
    // Block metadata service IPs
    if (hostname === '169.254.169.254' || hostname === '[::ffff:169.254.169.254]') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
  })
  .refine(
    (v) => v.url.split(/\s+/).every(isAllowedUrl),
    {
      message:
        'URLs must use http/https scheme and cannot target private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x), localhost, or metadata endpoints (169.254.169.254).',
    }
  );

export const DownloadfileOutputSchema = PcloudSuccess.extend({
  metadata: z.array(PcloudMetadata).optional(),
});

/**
 * Server-side download: pCloud fetches the URL(s) and stores the result(s)
 * in the destination folder. This is the inverse of uploadfile, no bytes
 * cross the MCP server, pCloud does the fetching. Blocks until all URLs are
 * downloaded, so large downloads will hold the tool call open.
 */
export const DownloadfileToolMeta: ToolMeta<typeof DownloadfileInputSchema> = {
  title: 'Server-Side Download from URL',
  description:
    'Ask pCloud to fetch one or more URLs and store the resulting file(s) in a folder you own. ' +
    'Pass a single `url` string or several URLs separated by whitespace. Optionally pass `target` ' +
    'as a comma-separated urlencoded list of desired filenames (one per URL; empty positions ' +
    'keep the URL-derived name). Bytes never cross the MCP server, pCloud does the fetching. ' +
    'Blocks until all URLs are downloaded (large downloads hold the tool call open).',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  inputSchema: DownloadfileInputSchema,
};

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
