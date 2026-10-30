import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

const RenameOpSchema = z.object({
  fileid: z.number().int().positive().describe('File to rename/move'),
  toname: z.string().min(1).optional().describe('Destination filename (extension included)'),
  tofolderid: z.number().int().nonnegative().optional().describe('Destination folder ID'),
});

export const BatchrenameInputSchema = z.object({
  operations: z
    .array(RenameOpSchema)
    .min(1)
    .max(500)
    .describe('Rename/move operations to apply in order'),
  dryrun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Validate operations without calling pCloud; returns the planned result per op'),
});

const BatchrenameResultSchema = z.object({
  fileid: z.number().int().positive(),
  ok: z.boolean(),
  toname: z.string().optional(),
  tofolderid: z.number().int().nonnegative().optional(),
  newfileid: z.number().int().positive().optional(),
  error: z.string().optional(),
});

export const BatchrenameOutputSchema = PcloudSuccess.extend({
  applied: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(BatchrenameResultSchema).optional(),
});

type BatchrenameResult = z.infer<typeof BatchrenameResultSchema>;

export const BatchrenameToolMeta: ToolMeta<typeof BatchrenameInputSchema> = {
  title: 'Batch Rename / Move Files',
  description:
    'Apply many rename/move operations in one call. Each operation targets a file by fileid and ' +
    'optionally sets a new name (toname) and/or a new parent folder (tofolderid). Use dryrun to ' +
    'preview the plan without mutating anything. Individual failures do not abort the batch.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: BatchrenameInputSchema,
};

export async function batchrenameHandler(
  args: { operations: Array<{ fileid: number; toname?: string; tofolderid?: number }>; dryrun?: boolean },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof BatchrenameOutputSchema>;
}> {
  args = BatchrenameInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const results: BatchrenameResult[] = [];

  for (const op of args.operations) {
    if (args.dryrun) {
      results.push({
        fileid: op.fileid,
        ok: true,
        toname: op.toname,
        tofolderid: op.tofolderid,
      });
      continue;
    }

    const params: Record<string, string | number> = { fileid: op.fileid };
    if (op.toname !== undefined) params.toname = op.toname;
    if (op.tofolderid !== undefined) params.tofolderid = op.tofolderid;

    try {
      const response = await client.json<{
        result: 0;
        metadata: { fileid?: number; name?: string; path?: string };
      }>('renamefile', params);
      results.push({
        fileid: op.fileid,
        ok: true,
        toname: op.toname,
        tofolderid: op.tofolderid,
        newfileid: response.metadata.fileid,
      });
    } catch (err) {
      results.push({
        fileid: op.fileid,
        ok: false,
        toname: op.toname,
        tofolderid: op.tofolderid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const applied = results.filter((r) => r.ok).length;
  const failed = results.length - applied;
  const payload = {
    result: 0 as const,
    applied,
    failed,
    results,
  };

  const summary = args.dryrun
    ? `Dry run: ${applied} operation(s) planned, 0 applied.`
    : `Applied ${applied} operation(s), ${failed} failed.`;

  return {
    content: [{ type: "text", text: summary }],
    structuredContent: payload,
  };
}
