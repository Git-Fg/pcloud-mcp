import type { ServerContext, ProgressToken } from '@modelcontextprotocol/server';
import { createReadStream } from 'node:fs';

/**
 * The context every tool handler receives. Derived from the MCP SDK's own
 * `ServerContext` rather than hand-rolled, so `notify`/`_meta`/`signal` stay
 * compile-checked against the real protocol contract.
 *
 * Handlers accept `undefined` as well: the unit tests invoke them directly
 * with no transport, and a progress reporter is optional by design.
 */
export type ToolCtx = ServerContext | undefined;

/**
 * Reads a local file in chunks, invoking `onChunk` with the running byte
 * count. Used by the upload tools to surface read progress; the bytes are
 * accumulated because Bun's `FormData`/`Blob` require the full buffer.
 *
 * The underlying stream is destroyed on every termination path (resolve,
 * error, or caller abort) so the file descriptor is not leaked.
 */
export function readFileChunked(
  filePath: string,
  onChunk: (bytes: number) => void
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const stream = createReadStream(filePath);
    const cleanup = () => {
      stream.destroy();
    };
    stream.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(buf);
      total += buf.length;
      onChunk(total);
    });
    stream.on('end', () => {
      cleanup();
      resolve(Buffer.concat(chunks, total));
    });
    stream.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Builds a throttled `notifications/progress` emitter bound to the
 * originating request.
 *
 * Per the MCP spec a progress notification must carry the `progressToken`
 * the client supplied in `params._meta` of the request, and a server must not
 * emit progress the client did not ask for. So:
 *   - no `progressToken` on the request → returns `undefined`, no notifications;
 *   - a token present → every notification echoes that exact token.
 *
 * `phase` names what is actually being measured. Read progress covers the
 * local disk read only, the subsequent multipart POST to pCloud is a single
 * request whose byte-level progress this runtime cannot observe, so the
 * emitter reports `read` while reading and `uploading` on completion rather
 * than implying bytes-sent that are not being tracked.
 */
export function makeProgressNotifier(
  ctx: ToolCtx,
  total: number,
  label: string
): ((bytes: number, phase: 'read' | 'uploading') => void) | undefined {
  const token = ctx?.mcpReq?._meta?.progressToken as ProgressToken | undefined;
  const notify = ctx?.mcpReq?.notify;
  if (token === undefined || typeof notify !== 'function') return undefined;

  let lastReported = 0;
  return (bytes: number, phase: 'read' | 'uploading'): void => {
    const now = Date.now();
    if (now - lastReported < 250 && bytes !== total) return;
    lastReported = now;
    notify({
      method: 'notifications/progress',
      params: {
        progressToken: token,
        progress: bytes,
        total,
        message:
          phase === 'uploading'
            ? `Upload complete for ${label} (${bytes}/${total} bytes read, sending to pCloud)`
            : `Read ${bytes}/${total} bytes of ${label}`,
      },
    }).catch(() => {});
  };
}
