import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const RevertrevisionInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File id to revert (mutually exclusive with path)'),
    path: z.string().optional().describe('File path to revert (mutually exclusive with fileid)'),
    revisionid: z.number().int().positive().describe('Revision id to revert to'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
    message: 'Provide exactly one of fileid or path',
  });

export const RevertrevisionOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export const RevertrevisionToolMeta: ToolMeta<typeof RevertrevisionInputSchema> = {
  title: 'Revert a File to a Previous Revision',
  description:
    'Revert a file by fileid or path to a previous revision (from listrevisions). The current ' +
    'contents are saved as a new revision so nothing is lost. Returns the updated metadata.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: RevertrevisionInputSchema,
};

export async function revertrevisionHandler(
  args: { fileid?: number; path?: string; revisionid: number },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof RevertrevisionOutputSchema>;
}> {
  args = RevertrevisionInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = { revisionid: args.revisionid };
  if (args.fileid !== undefined) params.fileid = args.fileid;
  else params.path = args.path!;
  const response = await client.json<z.infer<typeof RevertrevisionOutputSchema>>('revertrevision', params);
  return {
    content: [
      {
        type: 'text',
        text: `Reverted to revision ${args.revisionid}; current fileid=${response.metadata.fileid ?? '?'} (path=${response.metadata.path ?? '?'})`,
      },
    ],
    structuredContent: response,
  };
}
