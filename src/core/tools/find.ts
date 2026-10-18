import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudMetadata, PcloudSuccess } from './schemas.js';

export const FindInputSchema = z.object({
  query: z.string().min(1).describe('Substring to search for (case-insensitive)'),
  folderid: z.number().int().nonnegative().optional().default(0),
  maxDepth: z.number().int().nonnegative().max(10).optional().default(3),
  maxResults: z.number().int().positive().max(500).optional().default(100),
});

export const FindOutputSchema = z.object({
  result: z.literal(0),
  query: z.string(),
  scanned: z.number().int().nonnegative(),
  truncated: z.boolean(),
  matches: z.array(
    z.object({
      name: z.string(),
      path: z.string().optional(),
      isfolder: z.boolean(),
      fileid: z.number().int().positive().optional(),
      folderid: z.number().int().nonnegative().optional(),
      size: z.number().int().nonnegative().optional(),
      modified: z.string().optional(),
    })
  ),
});

export type FindOutput = z.infer<typeof FindOutputSchema>;

export async function findHandler(
  args: { query: string; folderid?: number; maxDepth?: number; maxResults?: number },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: FindOutput;
}> {
  args = FindInputSchema.parse(args);
  const client = new PcloudHttpClient();
  const queryLc = args.query.toLowerCase();
  const maxDepth = args.maxDepth ?? 3;
  const maxResults = args.maxResults ?? 100;
  const matches: FindOutput['matches'] = [];
  let scanned = 0;
  let truncated = false;
  type QueueItem = { folderid: number; depth: number };
  const queue: QueueItem[] = [{ folderid: args.folderid ?? 0, depth: 0 }];
  type ListfolderResponse = z.infer<typeof PcloudSuccess> & { metadata: z.infer<typeof PcloudMetadata> };
  while (queue.length > 0) {
    if (matches.length >= maxResults) {
      truncated = true;
      break;
    }
    const { folderid, depth } = queue.shift()!;
    const response = await client.json<ListfolderResponse>('listfolder', { folderid });
    const contents = response.metadata.contents ?? [];
    for (const item of contents) {
      scanned += 1;
      if (item.name && item.name.toLowerCase().includes(queryLc)) {
        matches.push({
          name: item.name,
          path: item.path,
          isfolder: item.isfolder,
          fileid: item.fileid,
          folderid: item.folderid,
          size: item.size,
          modified: item.modified,
        });
        if (matches.length >= maxResults) {
          truncated = true;
          break;
        }
      }
      if (item.isfolder && item.folderid !== undefined && depth < maxDepth) {
        queue.push({ folderid: item.folderid, depth: depth + 1 });
      }
    }
  }
  const out: FindOutput = {
    result: 0,
    query: args.query,
    scanned,
    truncated,
    matches,
  };
  return {
    content: [
      { type: 'text', text: `find(${args.query}) → ${matches.length} match(es), scanned ${scanned}${truncated ? ' (truncated)' : ''}` },
    ],
    structuredContent: out,
  };
}
