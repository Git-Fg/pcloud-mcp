import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const DiffInputSchema = z
  .object({
    diffid: z.number().int().nonnegative().optional(),
    after: z.string().optional(),
    last: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(1000).optional().default(100),
  })
  .refine(
    (v) => [v.diffid !== undefined, v.after !== undefined, v.last !== undefined].filter(Boolean).length <= 1,
    { message: 'Provide at most one of diffid, after, last' }
  );

export const DiffOutputSchema = PcloudSuccess.extend({
  diffid: z.union([z.string(), z.number()]).optional(),
  entries: z.array(z.object({}).passthrough()).optional(),
});

export async function diffHandler(
  args: { diffid?: number; after?: string; last?: number; limit?: number },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof DiffOutputSchema>;
}> {
  args = DiffInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  if (args.diffid !== undefined) params.diffid = args.diffid;
  if (args.after !== undefined) params.after = args.after;
  if (args.last !== undefined) params.last = args.last;
  if (args.limit !== undefined) params.limit = args.limit;
  const response = await client.json<z.infer<typeof DiffOutputSchema>>('diff', params);
  return {
    content: [
      {
        type: 'text',
        text: `diffid=${String(response.diffid ?? '?')}, entries=${response.entries?.length ?? 0}`,
      },
    ],
    structuredContent: response,
  };
}
