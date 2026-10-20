import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

export const CreatefolderifnotexistsInputSchema = z
  .object({
    folderid: z.number().int().gte(0).optional().describe('Parent folder ID (0 for root)'),
    name: z.string().min(1).optional().describe('Name of the folder to create or return'),
    path: z.string().optional().describe('Full path to the folder (discouraged; prefer folderid + name)'),
  })
  .refine((v) => (v.path !== undefined ? v.name === undefined && v.folderid === undefined : v.name !== undefined), {
    message: 'Provide either path, or folderid + name',
  });

export const CreatefolderifnotexistsOutputSchema = PcloudSuccess.extend({
  created: z.boolean().optional().describe('True if a new folder was created; false if it already existed'),
  metadata: PcloudMetadata,
});

/**
 * Idempotent createfolder: returns the existing folder's metadata instead of
 * erroring when the name already exists. Per pCloud docs, `created` is true
 * when a new folder was made and absent/false when it was returned as-is.
 */
export const CreatefolderifnotexistsToolMeta: ToolMeta<typeof CreatefolderifnotexistsInputSchema> = {
  title: 'Create a Folder (Idempotent)',
  description:
    'Idempotent version of createfolder: if a folder with the same name already exists under ' +
    'the parent (or the path already resolves to a folder), its existing metadata is returned ' +
    'instead of erroring with 2004. Use this when the caller does not know whether the folder ' +
    'exists. `created` is true on a fresh folder, false when the existing one was returned.',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: CreatefolderifnotexistsInputSchema,
};

export async function createfolderifnotexistsHandler(
  args: { folderid?: number; name?: string; path?: string },
  _ctx: unknown
): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: z.infer<typeof CreatefolderifnotexistsOutputSchema>;
}> {
  args = CreatefolderifnotexistsInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.path !== undefined) {
    params.path = args.path;
  } else {
    params.folderid = args.folderid ?? 0;
    params.name = args.name!;
  }
  const response = await client.json<z.infer<typeof CreatefolderifnotexistsOutputSchema>>(
    'createfolderifnotexists',
    params
  );
  return {
    content: [
      {
        type: "text",
        text: `Folder ${response.created ? 'created' : 'already exists'}: id=${response.metadata?.folderid ?? response.metadata?.id ?? "?"}, path=${response.metadata?.path ?? "?"}`,
      },
    ],
    structuredContent: response,
  };
}
