import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { ToolMeta } from './tool-meta.js';

export const ReadfileInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File ID to read'),
    path: z.string().optional().describe('File path (discouraged)'),
    maxBytes: z.number().int().positive().max(10_000_000).optional()
      .describe('Safety cap on returned bytes (default 1 MB)'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const ReadfileOutputSchema = z.object({}).passthrough();

/**
 * Reads at most `cap` bytes from the pCloud download URL, stopping the
 * upstream stream the moment the cap is reached instead of buffering the
 * whole file first. The signed URL is never returned to the caller — it is a
 * short-lived credential.
 *
 * Output bytes are decoded as UTF-8 (with replacement on invalid sequences)
 * because pCloud's text-encoding signal is the filename, not the body. For
 * binary files the decoded `content` will be lossy; there is no raw-byte MCP
 * tool, so callers needing exact bytes must fetch the URL out-of-band.
 */
export const ReadfileToolMeta: ToolMeta<typeof ReadfileInputSchema> = {
  title: 'Read a File (UTF-8)',
  description:
    'Read a file from pCloud (getfilelink + streamed HTTP fetch) and return its content as a ' +
    'UTF-8 string. The response is capped to maxBytes (default 1 MB) and the upstream ' +
    'download is cancelled at the cap. The signed download URL is never returned (short-lived ' +
    'credential). Output is best-effort: binary files are decoded as UTF-8 with replacement ' +
    'on invalid sequences, so use the result for text or treat `bytes` as the source of truth.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ReadfileInputSchema,
};

export async function readfileHandler(
  args: { fileid?: number; path?: string; maxBytes?: number },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof ReadfileOutputSchema>;
}> {
  args = ReadfileInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const linkParams: Record<string, string | number> =
    args.fileid !== undefined ? { fileid: args.fileid } : { path: args.path! };
  const link = (await client.json<{
    result: 0;
    hosts: string[];
    path: string;
  }>('getfilelink', linkParams));
  if (!Array.isArray(link.hosts) || link.hosts.length === 0) {
    throw new Error('readfile: getfilelink returned no hosts');
  }
  const url = `https://${link.hosts[0]}${link.path}`;

  const cap = args.maxBytes ?? 1_000_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), client.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`readfile fetch failed: ${response.status} ${response.statusText}`);
    }
    reader = response.body.getReader();
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
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const result = { bytes: received, truncated, content: text };
    return {
      content: [{ type: "text", text }],
      structuredContent: result as z.infer<typeof ReadfileOutputSchema>,
    };
  } catch (err) {
    if (reader) await reader.cancel().catch(() => {});
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
