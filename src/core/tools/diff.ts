import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';

export const DiffInputSchema = z
  .object({
    diffid: z.number().int().nonnegative().optional()
      .describe('Return only changes after this diffid cursor'),
    after: z.string().optional()
      .describe('RFC-822 datetime; return only changes after this time (alternative to diffid)'),
    last: z.number().int().nonnegative().optional()
      .describe('Return the last N events; 0 = just the latest diffid cursor'),
    limit: z.number().int().positive().max(1000).optional()
      .describe('Max entries returned (default 100)'),
    block: z.boolean().optional()
      .describe('If true, block the server response until new changes are available (advanced; long-poll)'),
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
  args: {
    diffid?: number;
    after?: string;
    last?: number;
    limit?: number;
    block?: boolean;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof DiffOutputSchema>;
}> {
  args = DiffInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const params: Record<string, string | number> = {};
  // The MCP SDK does not surface a "no args" call idiomatically — but pCloud's
  // documented "return latest diffid" path is `diff?last=0`. Default last=0 so
  // an empty args object returns the cursor, matching the docs.
  if (args.diffid !== undefined) params.diffid = args.diffid;
  else if (args.after !== undefined) params.after = args.after;
  else params.last = args.last ?? 0;
  if (args.limit !== undefined) params.limit = args.limit;
  if (args.block) params.block = 1;
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
