import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const TrashRestoreInputSchema = z
  .object({
    fileid: z.number().int().positive().optional().describe('File id to restore (mutually exclusive with folderid)'),
    folderid: z.number().int().nonnegative().optional().describe('Folder id to restore (0 = restore the entire trash)'),
    restoreto: z.number().int().nonnegative().optional().describe('Destination folder id'),
    metadata: z.boolean().optional(),
  })
  .refine((v) => !(v.fileid !== undefined && v.folderid !== undefined), {
    message: 'Provide fileid or folderid, not both',
  })
  .refine((v) => v.fileid !== undefined || v.folderid !== undefined, {
    message: 'Provide fileid or folderid',
  });

export const TrashRestoreOutputSchema = PcloudSuccess.extend({ metadata: PcloudMetadata });

export async function trashRestoreHandler(
  args: { fileid?: number; folderid?: number; restoreto?: number; metadata?: boolean },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof TrashRestoreOutputSchema>;
}> {
  args = TrashRestoreInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.fileid !== undefined) params.fileid = args.fileid;
  if (args.folderid !== undefined) params.folderid = args.folderid;
  if (args.restoreto !== undefined) params.restoreto = args.restoreto;
  if (args.metadata) params.metadata = 1;
  const response = await client.json<z.infer<typeof TrashRestoreOutputSchema>>('trash_restore', params);
  return {
    content: [
      {
        type: 'text',
        text: `Restored via trash_restore: ${JSON.stringify(response.metadata ?? {}, null, 2)}`,
      },
    ],
    structuredContent: response,
  };
}
