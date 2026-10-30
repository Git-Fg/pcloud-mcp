import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

const RenameOpSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File to rename/move'),
    folderid: z.number().int().nonnegative().optional().describe('Folder to rename/move'),
    toname: z.string().min(1).optional().describe('Destination name (extension included for files)'),
    tofolderid: z.number().int().nonnegative().optional().describe('Destination parent folder ID'),
  })
  .refine((v) => (v.fileid === undefined) !== (v.folderid === undefined), {
    message: 'Provide exactly one of fileid or folderid for the source',
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
  fileid: z.number().int().positive().optional(),
  folderid: z.number().int().nonnegative().optional(),
  ok: z.boolean(),
  toname: z.string().optional(),
  tofolderid: z.number().int().nonnegative().optional(),
  newid: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const BatchrenameOutputSchema = PcloudSuccess.extend({
  applied: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(BatchrenameResultSchema).optional(),
});

type BatchrenameResult = z.infer<typeof BatchrenameResultSchema>;

export const BatchrenameToolMeta: ToolMeta<typeof BatchrenameInputSchema> = {
  title: 'Batch Rename / Move Files and Folders',
  description:
    'Apply many rename/move operations in one call. Each operation targets a file (fileid) or a ' +
    'folder (folderid) and optionally sets a new name (toname) and/or a new parent folder ' +
    '(tofolderid). Use dryrun to preview the plan without mutating anything. Individual failures ' +
    'do not abort the batch.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  inputSchema: BatchrenameInputSchema,
};

export async function batchrenameHandler(
  args: {
    operations: Array<{ fileid?: number; folderid?: number; toname?: string; tofolderid?: number }>;
    dryrun?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof BatchrenameOutputSchema>;
}> {
  args = BatchrenameInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const results: BatchrenameResult[] = [];

  for (const op of args.operations) {
    const isFolder = op.folderid !== undefined;
    const endpoint = isFolder ? 'renamefolder' : 'renamefile';

    if (args.dryrun) {
      results.push({
        fileid: op.fileid,
        folderid: op.folderid,
        ok: true,
        toname: op.toname,
        tofolderid: op.tofolderid,
      });
      continue;
    }

    const params: Record<string, string | number> = {};
    if (op.fileid !== undefined) params.fileid = op.fileid;
    else params.folderid = op.folderid!;
    if (op.toname !== undefined) params.toname = op.toname;
    if (op.tofolderid !== undefined) params.tofolderid = op.tofolderid;

    try {
      const response = await client.json<{
        result: 0;
        metadata: { fileid?: number; folderid?: number };
      }>(endpoint, params);
      results.push({
        fileid: op.fileid,
        folderid: op.folderid,
        ok: true,
        toname: op.toname,
        tofolderid: op.tofolderid,
        newid: response.metadata.fileid ?? response.metadata.folderid,
      });
    } catch (err) {
      results.push({
        fileid: op.fileid,
        folderid: op.folderid,
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
