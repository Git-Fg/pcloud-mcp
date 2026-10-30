/**
 * Workflow prompts for the pCloud server.
 *
 * A tool description says what one call does. A prompt says how a whole
 * curation job is done: which call comes first, what to do when one of them
 * fails, and where the judgement calls are. That knowledge has no other home
 * — a tool cannot state it without describing a workflow it does not own.
 *
 * The prompts therefore stay short, take few arguments, and name the
 * decision points rather than prescribing a single path: the agent picks
 * between options using what the tools report.
 */
import { z } from 'zod';
import { completable } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';

interface PromptSpec {
  name: string;
  title: string;
  description: string;
  argsSchema: z.ZodObject<z.ZodRawShape>;
  body: (args: Record<string, unknown>) => string;
}

/**
 * Helper to make a folderid argument completable by calling list_recursive.
 * Returns a Zod schema wrapped with the SDK's `completable` helper.
 * The callback is invoked with the user's partial input (a number) and
 * must return an array of matching folderid numbers.
 */
function completableFolderid(desc: string) {
  return completable(
    z.number().int().gte(0).describe(desc),
    async (partial): Promise<number[]> => {
      // The callback receives the partial user input as a number.
      // We call list_recursive to find folders whose path contains the partial.
      // Since we can't easily call MCP tools from here (no server context),
      // we return the root (0) as a fallback and a few common folders.
      // A full implementation would need the server's PcloudHttpClient.
      // For now, provide sensible defaults.
      if (partial === undefined || partial === null || partial === 0) {
        return [0];
      }
      // If the user typed something, return root plus the partial as-is
      // (the caller will validate it exists when they actually call list_recursive).
      return [0, partial];
    }
  );
}

const PROMPTS: PromptSpec[] = [
  {
    name: 'audit_duplicates',
    title: 'Audit Duplicate Files',
    description:
      'Find files that hold the same bytes across a pCloud tree, then propose which copies to keep.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to audit (0 for the root folder)'),
      minSize: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Ignore files smaller than this, in bytes'),
    }),
    body: (args) => `Audit the duplicates in pCloud folder ${args.folderid}.

1. Call \`list_recursive\` with folderid ${args.folderid} to get the tree as a compact index. Each
   entry carries fileid, path, size and the pCloud content hash.
2. Keep the files at or above ${args.minSize ?? 0} bytes.
3. Call \`checksum_group\` with those files, passing the hash and size you already have. It costs
   one checksumfile call per candidate group, not one per file.
4. Report every group with more than one member: the SHA-1, the paths, and the bytes wasted.

When a group needs a decision, offer the choices rather than choosing:
- Keep the copy that sits where a reader looks for it, and delete the rest.
- Keep every copy but rename them so the difference is visible.
- Keep every copy and do nothing.

Deleting is reversible — pCloud puts the file in the trash. Say so before proposing it, and
never delete a group whose members hold different content.`,
  },
  {
    name: 'classify_corpus',
    title: 'Classify an Unlabelled Corpus',
    description: 'Place files of a pCloud folder into a taxonomy, reading their content to decide.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to classify (0 for the root folder)'),
      taxonomy: z.string().describe('The categories to assign, one per line or comma-separated'),
    }),
    body: (args) => `Classify the files of pCloud folder ${args.folderid} into this taxonomy:

${args.taxonomy}

1. Call \`list_recursive\` with folderid ${args.folderid}.
2. For each file, judge it from what the path says first. Only when the path says nothing, call
   \`range_read\` to read the first 64 KiB and judge from the content. A PDF's first pages carry
   its title; a DOCX's first bytes carry its document XML.
3. Group the files by the category you assigned, and report the counts.
4. Propose the folder layout the categories imply, then ask before moving anything: \`createfolderifnotexists\`
   for the folders, \`batchrename\` for the moves.

Judge from content only when the path is silent. A file whose name already says "Anemies" needs
no download.`,
  },
  {
    name: 'rename_from_content',
    title: 'Rename Files From Their Content',
    description: 'Give files meaningful names by reading what is inside them.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder whose files to rename'),
      pattern: z
        .string()
        .optional()
        .describe('Only rename files whose name matches this regular expression'),
    }),
    body: (args) => `Rename the badly-named files of pCloud folder ${args.folderid}${
      args.pattern ? ` whose name matches /${args.pattern}/` : ''
    }.

1. Call \`list_recursive\` with folderid ${args.folderid}.
2. Keep the files whose name says nothing about their content: "document", "scan", a bare number, a
   hash, an empty name.
3. For each of them, call \`range_read\` and take the name from the content: the document title, the
   first heading, the author and year if they are there.
4. Present the mapping, old name to new name, and ask before applying it.
5. Apply with \`batchrename\`. The name must keep the extension.

A name that already describes the file is not a candidate. Only rename what the name fails to say.`,
  },
  {
    name: 'curation_report',
    title: 'Produce a Curation Report',
    description: 'Summarise a pCloud tree: size, composition, duplicates, links and trash.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to report on (0 for the root folder)'),
    }),
    body: (args) => `Write a curation report for pCloud folder ${args.folderid}.

1. Call \`list_recursive\` with folderid ${args.folderid}.
2. From that one index, compute the file count, the total bytes, the distribution by content type,
   the largest files and the most recently modified files.
3. Call \`checksum_group\` on the same files to count the duplicate groups and the bytes they waste.
4. Call \`listpublinks\` to list the public links, and note the ones pointing inside this tree.
5. Call \`trash_list\` to report what the trash holds. Note that it may fail with "1000 Log in
   required" — that is a known pCloud limitation with OAuth tokens, not a fault in the call.

Report what the tools returned, with the numbers. When a call failed, say which one and why
rather than quietly leaving that section out.`,
  },
  {
    name: 'summarize_tree',
    title: 'Summarise a Tree Without Dumping It',
    description: 'Describe a large pCloud tree compactly, without returning every entry.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to summarise (0 for the root folder)'),
      maxDepth: z.number().int().nonnegative().max(10).optional().describe('Depth to descend to'),
    }),
    body: (args) => `Summarise pCloud folder ${args.folderid} in a few lines.

Call \`list_recursive\` with folderid ${args.folderid} and maxdepth ${args.maxDepth ?? 3}, then
report the shape rather than the contents: how many folders at each level, how many files in each
top folder, the total bytes, and the three largest files.

Do not list the files. The point of this prompt is to fit the tree in the context window.`,
  },
  {
    name: 'verify_upload',
    title: 'Verify an Upload Against a Local File',
    description: 'Check that a file on pCloud still matches the local copy it came from.',
    argsSchema: z.object({
      fileid: z.number().int().positive().describe('The uploaded file on pCloud'),
      localSha1: z.string().describe('The SHA-1 of the local file'),
    }),
    body: (args) => `Verify that pCloud file ${args.fileid} still matches its local original.

1. Call \`checksumfile\` on fileid ${args.fileid} and read the sha1.
2. Compare it with ${args.localSha1}.
3. On a match, report it and stop.
4. On a mismatch, call \`listrevisions\` to see whether an earlier revision matches the local
   digest. If one does, offer to \`revertrevision\` to it — reverting keeps the current content as
   a revision, so nothing is lost either way.
5. If no revision matches, call \`range_read\` and show the first bytes so the mismatch can be seen.

A mismatch means the file changed since the upload, or that it was never the file you think it was.
Say which of the two the evidence supports.`,
  },
  {
    name: 'audit_public_links',
    title: 'Audit Public Links',
    description: 'Review the public links of an account for exposure and stale targets.',
    argsSchema: z.object({
      folderid: completableFolderid('Restrict to links whose target is under this folder (0 for root)'),
    }),
    body: (args) => `Audit the public links of this pCloud account${
      args.folderid !== undefined ? ` whose target is under folder ${args.folderid}` : ''
    }.

1. Call \`listpublinks\` to get every link with its target, expiry and download counter.
2. For each, call \`stat\` on its target to see whether the file is still there and still what the
   link claims to point at.
3. Sort the links into: expired, no expiry set, high traffic, and pointing at something that moved
   or is gone.
4. Report the table with a recommendation per link.

Do not delete anything on your own. A public link may be in use somewhere you cannot see; the
download counter is the only evidence of that. Propose \`deletepublink\` for the links that are
expired or orphaned and ask first.`,
  },
  {
    name: 'recover_from_trash',
    title: 'Recover Files From the Trash',
    description: 'Restore deleted pCloud files, working around the OAuth limitation of the trash family.',
    argsSchema: z.object({
      folderid: completableFolderid('Restore into this destination folder (0 for root)'),
    }),
    body: (args) => `Recover files from the pCloud trash${
      args.folderid !== undefined ? `, restoring them into folder ${args.folderid}` : ''
    }.

The trash endpoints are the weak point of this account: \`trash_list\` and \`trash_restore\` answer
"1000 Log in required" for OAuth tokens even though the same token works everywhere else. This is a
known pCloud limitation, not something you can fix by retrying.

1. Call \`trash_list\` with recursive true.
2. If it answers 1000, say so plainly and offer the alternatives instead of retrying:
   - Ask the user for the name of what they are looking for, then call \`find\` to locate it.
   - Ask them to restore it from the pCloud web interface, where the session token is accepted.
   - If a session token is configured, call the trash endpoints with it.
3. If the trash does answer, group the items by the folder they came from, show the list with
   sizes and dates, and ask which ones to restore before calling \`trash_restore\`.

Restoring puts the item back where it was deleted from unless a destination is given.`,
  },
  {
    name: 'search_contents',
    title: 'Search Inside File Contents',
    description: 'Find files whose text contains a pattern, reading only the first bytes of each.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to search (0 for the root folder)'),
      pattern: z.string().describe('The text to look for'),
    }),
    body: (args) => `Find the files under pCloud folder ${args.folderid} whose text contains "${args.pattern}".

pCloud has no API that searches inside file contents, so the search has to be done by reading.

1. Call \`list_recursive\` with folderid ${args.folderid}.
2. For each file, call \`range_read\` with range "0-65535" to read its first bytes. Decode the
   base64 and look for the pattern.
3. Report the matching files with the excerpt that matched.

Two limits to state in the report: only the first 64 KiB of each file are searched, so a match
later in a long document is not found; and the bytes of a PDF are compressed, so a PDF match is
only found when the pattern sits in an uncompressed part of the file.`,
  },
  {
    name: 'taxonomy_drift_check',
    title: 'Check Files Against Their Taxonomy',
    description: 'Find files whose name contradicts the folder they sit in.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder holding the taxonomy'),
    }),
    body: (args) => `Check pCloud folder ${args.folderid} for files that no longer fit their folder.

1. Call \`list_recursive\` with folderid ${args.folderid} and includeFolders true.
2. For each file, read the unit or category its own name declares, and compare it with the folder
   it sits in.
3. Report the files whose name and folder disagree: the name says one thing, the place says
   another.
4. For each disagreement, say which of the two is the better evidence — a file named after a unit
   that sits in another unit's folder was probably filed by mistake.

Do not move anything. A name that says one thing and a folder that says another is sometimes a
file filed deliberately, and only a person can say which.`,
  },
  {
    name: 'checksum_manifest',
    title: 'Build or Verify a Checksum Manifest',
    description:
      'Build a SHA-1 manifest for a pCloud tree, or verify an existing manifest against the live tree.',
    argsSchema: z.object({
      folderid: completableFolderid('Folder to manifest (0 for the root folder)'),
      manifestFileid: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Existing manifest fileid to verify against (optional)'),
      update: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true and manifestFileid given, upload a new version of the manifest'),
    }),
    body: (args) => `Build or verify a SHA-1 manifest for pCloud folder ${args.folderid}${
      args.manifestFileid ? `, verifying against existing manifest fileid ${args.manifestFileid}` : ''
    }.

1. Call \`list_recursive\` with folderid ${args.folderid} to get the tree as a compact index.
2. Call \`checksum_group\` with all files (passing hash and size) to get SHA-1 for every file.
   This costs one \`checksumfile\` call per content-hash group, not one per file.
3. Build the manifest: an object mapping fileid → { path, name, size, sha1, modified }.
   Include the generation timestamp and the total file count.
4. ${args.manifestFileid ? 'Call \`readfile\` on the existing manifest and compare. Report any files that are missing, new, or have a different SHA-1.' : 'No existing manifest to verify against.'}
5. ${args.update && args.manifestFileid ? 'If the manifest changed, call \`uploadfile\` to overwrite it with the new version (keeping the same fileid).' : 'No update requested.'}

Return the manifest (or the diff report) as structured JSON. The manifest is a durable record that can be used later to verify the integrity of the entire tree without re-scanning every file.`,
  },
];

export function registerPcloudPrompts(server: McpServer): void {
  for (const prompt of PROMPTS) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      (args) => ({
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text: prompt.body(args as Record<string, unknown>) },
          },
        ],
      })
    );
  }
}
