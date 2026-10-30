import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { ToolMeta } from './tool-meta.js';

/**
 * Reads the first N bytes of a pCloud file without downloading the whole thing.
 *
 * The download URL from `getfilelink` supports HTTP Range requests, so a
 * curator can fetch the first 64 KiB of a PDF or DOCX and read its text layer
 * or its XML part without downloading the entire file. This is the only
 * server-assisted way to look inside a corpus at scale.
 *
 * The returned bytes are base64-encoded because MCP `content` arrays are
 * text; the caller decodes them locally. The signed download URL is never
 * returned — it is a short-lived credential.
 */
export const RangeReadInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to read'),
    path: z.string().optional().describe('File path (discouraged)'),
    range: z
      .string()
      .optional()
      .default('0-65535')
      .describe('HTTP Range header, e.g. "0-65535" for the first 64 KiB'),
    maxBytes: z
      .number()
      .int()
      .positive()
      .max(1_000_000)
      .optional()
      .default(65536)
      .describe('Hard cap on bytes returned (default 65536)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const RangeReadOutputSchema = z
  .object({
    fileid: z.number().int().positive().optional(),
    bytes: z.number().int().nonnegative().describe('Number of bytes returned'),
    truncated: z.boolean().describe('True when the range was cut short by maxBytes'),
    base64: z.string().describe('Base64-encoded bytes of the range'),
    contentType: z.string().optional().describe('Content-Type reported by the server, if any'),
    totalSize: z.number().int().nonnegative().optional().describe('Total file size, from the Content-Range header if present'),
  })
  .passthrough();

export const RangeReadToolMeta: ToolMeta<typeof RangeReadInputSchema> = {
  title: 'Read a Byte Range from a pCloud File',
  description:
    'Fetch a byte range of a pCloud file via HTTP Range request. Use this to read the first ' +
    '64 KiB of a PDF, DOCX, TXT or CSV without downloading the whole file. The returned bytes ' +
    'are base64-encoded (MCP content is text); decode them locally. The signed download URL is ' +
    'never returned. This is the only way to inspect a corpus at scale without transferring ' +
    'every file in full.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: RangeReadInputSchema,
};

export async function rangeReadHandler(
  args: { fileid?: number; path?: string; range?: string; maxBytes?: number },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof RangeReadOutputSchema>;
}> {
  args = RangeReadInputSchema.parse(args);
  const client = new PcloudHttpClient();

  const linkParams: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const link = (await client.json<{
    result: 0;
    hosts: string[];
    path: string;
  }>('getfilelink', linkParams));
  if (!Array.isArray(link.hosts) || link.hosts.length === 0) {
    throw new Error('range_read: getfilelink returned no hosts');
  }
  const url = `https://${link.hosts[0]}${link.path}`;

  const cap = args.maxBytes ?? 65536;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), client.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: `bytes=${args.range ?? '0-65535'}` },
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`range_read fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const contentRange = response.headers.get('content-range') ?? '';
    const totalSizeMatch = contentRange.match(/\/(\d+)$/);
    const totalSize = totalSizeMatch ? Number(totalSizeMatch[1]) : undefined;

    if (!response.body) {
      throw new Error('range_read: response body is null');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      const remaining = cap - received;
      if (value.length > remaining) {
        chunks.push(value.subarray(0, remaining));
        received += remaining;
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
      received += value.length;
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const base64 = Buffer.from(bytes).toString('base64');
    const result = {
      fileid: args.fileid,
      bytes: received,
      truncated,
      base64,
      contentType,
      totalSize,
    };

    return {
      content: [
        {
          type: 'text',
          text: `[range_read: ${contentType || 'unknown'}, ${received} bytes${truncated ? ' (truncated)' : ''}, total=${totalSize ?? '?'}]`,
        },
      ],
      structuredContent: result as z.infer<typeof RangeReadOutputSchema>,
    };
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}