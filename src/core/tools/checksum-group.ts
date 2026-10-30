import { z } from 'zod';
import { PcloudHttpClient } from '../http/pcloudClient.js';
import { PcloudSuccess } from './schemas.js';
import { ToolMeta } from './tool-meta.js';

/**
 * Confirms which of many files hold the same bytes, in as few API calls as
 * possible.
 *
 * pCloud computes no digest for a tree in one call: `checksumfile` takes a
 * single fileid. Asking it about 11 000 files would be 11 000 round-trips.
 *
 * The pCloud metadata already carries a 64-bit content hash per file, which
 * `list_recursive` returns. Files that share a hash AND a size are the only
 * possible duplicates, so this tool groups on that pair, asks `checksumfile`
 * about ONE representative per group, and returns the digest for every
 * member. A group of ten costs one call instead of ten.
 *
 * The hash is a 64-bit integer that JSON transports as a double, so it can
 * lose precision. That is safe here: a lost bit can only merge two groups
 * that the SHA-1 then separates, never split a group that belongs together.
 */
export const ChecksumGroupInputSchema = z.object({
  files: z
    .array(
      z
        .object({
          fileid: z.number().int().positive(),
          size: z.number().int().nonnegative().optional(),
          /** The 64-bit pCloud content hash, rounded by JSON. See list_recursive. */
          hash: z.number().optional(),
        })
        .passthrough()
    )
    .min(1)
    .max(5000)
    .describe(
      'Files to group, each with at least a fileid. Add size and hash (from list_recursive) so ' +
        'the grouping needs no extra API call.'
    ),
  includeSingletons: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, also checksum files that stand alone in their group'),
  concurrency: z
    .number()
    .int()
    .positive()
    .max(16)
    .optional()
    .default(4)
    .describe('How many checksumfile calls to run at once (default 4)'),
});

const GroupSchema = z
  .object({
    sha1: z.string(),
    size: z.number().int().nonnegative().optional(),
    fileids: z.array(z.number().int().positive()),
    count: z.number().int().positive(),
  })
  .passthrough();

export const ChecksumGroupOutputSchema = PcloudSuccess.extend({
  digests: z.record(z.string(), z.string()).optional().describe('fileid to sha1'),
  groups: z.array(GroupSchema).optional().describe('Groups of files sharing one SHA-1'),
  duplicates: z.array(GroupSchema).optional().describe('Only the groups holding more than one file'),
  stats: z
    .object({
      files: z.number().int().nonnegative(),
      groups: z.number().int().nonnegative(),
      duplicates: z.number().int().nonnegative(),
      redundantCopies: z.number().int().nonnegative(),
      bytesReclaimable: z.number().int().nonnegative(),
      apiCalls: z.number().int().nonnegative(),
    })
    .optional(),
});

export const ChecksumGroupToolMeta: ToolMeta<typeof ChecksumGroupInputSchema> = {
  title: 'Confirm Duplicate Groups by SHA-1',
  description:
    'Prove which files hold the same bytes without one API call per file. The tool groups the ' +
    'given files by their pCloud content hash and size, asks checksumfile about ONE ' +
    'representative per group, and returns the SHA-1 for every member plus the groups that hold ' +
    'more than one file. Pass the hash and size from list_recursive so the grouping costs no ' +
    'extra call. A group of N files costs one call, not N.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  inputSchema: ChecksumGroupInputSchema,
};

type InputFile = { fileid: number; size?: number; hash?: number };
type Group = {
  key: string;
  members: InputFile[];
  size?: number;
};

export async function checksumGroupHandler(
  args: {
    files: InputFile[];
    includeSingletons?: boolean;
    concurrency?: number;
  },
  _ctx: unknown
): Promise<{
  content: { type: 'text'; text: string }[];
  structuredContent: z.infer<typeof ChecksumGroupOutputSchema>;
}> {
  args = ChecksumGroupInputSchema.parse(args);
  const client = new PcloudHttpClient();

  // Group by hash and size. A file without a hash cannot be grouped, so it
  // stands alone until its metadata is known.
  const groups = new Map<string, Group>();
  const ungrouped: InputFile[] = [];
  for (const file of args.files) {
    if (file.hash === undefined) {
      ungrouped.push(file);
      continue;
    }
    const key = `${file.hash}:${file.size ?? 'x'}`;
    const group = groups.get(key) ?? { key, members: [], size: file.size };
    group.members.push(file);
    groups.set(key, group);
  }

  // A file whose metadata was not supplied still needs its hash: fetch it.
  if (ungrouped.length > 0) {
    const fetched = await Promise.all(
      ungrouped.map(async (file) => {
        try {
          const response = await client.json<{
            result: 0;
            metadata: { hash?: number; size?: number };
          }>('stat', { fileid: file.fileid });
          return { ...file, hash: response.metadata.hash, size: response.metadata.size ?? file.size };
        } catch {
          return file;
        }
      })
    );
    for (const file of fetched) {
      if (file.hash === undefined) {
        groups.set(`solo:${file.fileid}`, { key: `solo:${file.fileid}`, members: [file], size: file.size });
        continue;
      }
      const key = `${file.hash}:${file.size ?? 'x'}`;
      const group = groups.get(key) ?? { key, members: [], size: file.size };
      group.members.push(file);
      groups.set(key, group);
    }
  }

  const candidates = [...groups.values()].filter(
    (group) => args.includeSingletons || group.members.length > 1
  );

  // One checksumfile call per group, run a few at a time.
  const concurrency = args.concurrency ?? 4;
  const digests = new Map<string, string>();
  let apiCalls = 0;

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (group) => {
        const representative = group.members[0];
        try {
          const response = await client.json<{ result: 0; sha1?: string }>('checksumfile', {
            fileid: representative.fileid,
          });
          apiCalls += 1;
          if (response.sha1) {
            for (const member of group.members) digests.set(String(member.fileid), response.sha1);
          }
        } catch {
          apiCalls += 1;
        }
      })
    );
  }

  const digestMap: Record<string, string> = {};
  for (const [fileid, sha1] of digests) digestMap[fileid] = sha1;

  const resolvedGroups = candidates
    .filter((group) => group.members.every((m) => digests.has(String(m.fileid))))
    .map((group) => ({
      sha1: digests.get(String(group.members[0].fileid))!,
      size: group.size,
      fileids: group.members.map((m) => m.fileid),
      count: group.members.length,
    }));

  const duplicates = resolvedGroups.filter((group) => group.count > 1);
  const redundantCopies = duplicates.reduce((sum, group) => sum + group.count - 1, 0);
  const bytesReclaimable = duplicates.reduce(
    (sum, group) => sum + (group.size ?? 0) * (group.count - 1),
    0
  );

  const payload = {
    result: 0 as const,
    digests: digestMap,
    groups: resolvedGroups,
    duplicates,
    stats: {
      files: args.files.length,
      groups: resolvedGroups.length,
      duplicates: duplicates.length,
      redundantCopies,
      bytesReclaimable,
      apiCalls,
    },
  };

  const summary =
    `${args.files.length} files in ${groups.size} group(s); ${duplicates.length} duplicate group(s) ` +
    `holding ${redundantCopies} redundant cop(ies), ${(bytesReclaimable / 1024 / 1024).toFixed(1)} MB; ` +
    `${apiCalls} checksumfile call(s).`;

  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: payload as z.infer<typeof ChecksumGroupOutputSchema>,
  };
}