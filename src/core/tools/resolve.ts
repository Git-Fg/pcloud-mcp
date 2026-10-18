import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

/**
 * Resolve a pCloud path to its numeric id. Wraps `stat` so agents never have
 * to think in numeric ids; every other tool accepts either an id or a path,
 * but in practice path-only calls are common, and this tool gives the
 * canonical id form for chaining.
 */
export const ResolveInputSchema = z.object({
  path: z.string().min(1).describe('Absolute path to a file or folder (e.g. "/docs/spec.md")'),
});

export const ResolveOutputSchema = PcloudSuccess.extend({
  isfolder: z.boolean(),
  fileid: z.number().int().positive().optional(),
  folderid: z.number().int().nonnegative().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  modified: z.string().optional(),
  metadata: PcloudMetadata.optional(),
});

type StatEnvelopeInfer = z.infer<typeof PcloudSuccess> & { metadata: z.infer<typeof PcloudMetadata> };

export type ResolveOutput = z.infer<typeof ResolveOutputSchema>;

export async function resolveHandler(
  args: { path: string },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: ResolveOutput;
}> {
  args = ResolveInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const response = await client.json<StatEnvelopeInfer>('stat', { path: args.path });
  const md = response.metadata;
  const size = typeof md.size === 'number' ? md.size : undefined;
  const out: ResolveOutput = {
    result: 0,
    isfolder: md.isfolder === true,
    fileid: md.fileid,
    folderid: md.folderid,
    name: md.name,
    path: md.path,
    ...(size !== undefined ? { size } : {}),
    modified: md.modified,
    metadata: md,
  };
  const idLine = out.isfolder ? `folderid=${out.folderid ?? '?'}` : `fileid=${out.fileid ?? '?'}`;
  return {
    content: [
      {
        type: 'text',
        text: `Resolved ${out.path ?? args.path} → ${out.isfolder ? 'folder' : 'file'} (${idLine}, name=${out.name ?? '?'})`,
      },
    ],
    structuredContent: out,
  };
}
