/**
 * Proves that an archive's members are in the tree, and deletes the archive
 * when they are.
 *
 * A name and a size do not prove that two files hold the same content. The
 * proof is the content hash pCloud computes for every file: the archive is
 * extracted server-side into a scratch folder, and each extracted member is
 * matched against the tree by that hash.
 *
 * Nothing is downloaded. Each archive is extracted into its own folder
 * under the scratch, and that folder is removed afterwards, so one
 * archive's members can never be counted for another. The extraction shows
 * up in the listing a moment after pCloud reports it finished, so the
 * listing is polled until the expected number of members is there.
 *
 * Usage: bun run scripts/pharmacie-prove-zips.ts [inventory] [candidates] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  hash?: number;
  children?: InvNode[];
}

interface Candidate {
  fileid: number;
  path: string;
  size: number;
  members: number;
  present: string[];
  renamed: string[];
  absent: string[];
  verdict: string;
}

interface Proof {
  fileid: number;
  path: string;
  size: number;
  members: number;
  proven: number;
  unproven: string[];
  verdict: 'proven-redundant' | 'holds-unique-content';
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inv-5.json';
const candidatesPath = process.argv[3] ?? '/tmp/pharmacie-zip-verification.json';
const outPath = process.argv[4] ?? '/tmp/pharmacie-zip-proof.json';
const apply = process.argv.includes('--apply');

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

/** The content hash of every file of the tree, by hash and size. */
const treeByContent = new Map<string, InvNode[]>();
for (const file of files) {
  if (file.isfolder || file.hash === undefined) continue;
  const key = `${file.hash} ${file.size ?? 0}`;
  const list = treeByContent.get(key) ?? [];
  list.push(file);
  treeByContent.set(key, list);
}

const candidates: Candidate[] = JSON.parse(await readFile(candidatesPath, 'utf8')).plans.filter(
  (plan: Candidate) => plan.absent.length === 0,
);

const client = new PcloudHttpClient();
const SCRATCH = 'Pharmacie-VERIFY';

interface Entry {
  name: string;
  fileid: number;
  folderid?: number;
  isfolder: boolean;
  hash?: number;
  size?: number;
}

interface Listing {
  metadata: { contents?: Entry[] };
}

/** The identifier of a folder at the account root, created when missing. */
async function rootFolder(name: string): Promise<number> {
  const listing = await client.json<Listing>('listfolder', { folderid: 0 });
  const existing = listing.metadata.contents?.find((entry) => entry.name === name && entry.isfolder);
  if (existing?.folderid) return existing.folderid;
  const created = await client.json<{ metadata: { folderid: number } }>('createfolder', { folderid: 0, name });
  return created.metadata.folderid;
}

/** Every file under a folder, with the hash pCloud computed for it. */
async function listWithHash(folderid: number): Promise<Array<{ name: string; fileid: number; hash?: number; size: number }>> {
  const found: Array<{ name: string; fileid: number; hash?: number; size: number }> = [];
  let level = [folderid];
  while (level.length > 0) {
    const listings = await Promise.all(level.map(async (id) => client.json<Listing>('listfolder', { folderid: id })));
    const next: number[] = [];
    for (const listing of listings) {
      for (const entry of listing.metadata.contents ?? []) {
        if (entry.isfolder) {
          if (entry.folderid) next.push(entry.folderid);
          continue;
        }
        found.push({ name: entry.name, fileid: entry.fileid, hash: entry.hash, size: entry.size ?? 0 });
      }
    }
    level = next;
  }
  return found;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scratchId = await rootFolder(SCRATCH);
const proofs: Proof[] = [];

for (const [position, candidate] of candidates.entries()) {
  // Each archive is extracted into a folder of its own, so one archive's
  // members can never be counted for another.
  const workingName = `archive-${position}`;
  try {
    const working = await client.json<{ metadata: { folderid: number } }>('createfolderifnotexists', {
      folderid: scratchId,
      name: workingName,
    });
    const workingId = working.metadata.folderid;

    await client.json<{ finished: boolean }>('extractarchive', {
      fileid: candidate.fileid,
      tofolderid: workingId,
    });

    // The extraction shows up in the listing a moment after pCloud reports
    // it finished, so the listing is polled until every member is there.
    let members: Array<{ name: string; fileid: number; hash?: number; size: number }> = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(1000);
      members = await listWithHash(workingId);
      if (members.length >= candidate.members) break;
    }

    if (members.length < candidate.members) {
      process.stderr.write(`  SKIP ${candidate.path}: ${members.length}/${candidate.members} members appeared\n`);
      await client.json('deletefolderrecursive', { folderid: workingId });
      continue;
    }

    const unproven: string[] = [];
    let proven = 0;
    for (const member of members) {
      const key = `${member.hash} ${member.size}`;
      if (member.hash !== undefined && treeByContent.has(key)) proven += 1;
      else unproven.push(member.name);
    }

    await client.json('deletefolderrecursive', { folderid: workingId });

    const verdict = unproven.length === 0 ? 'proven-redundant' : 'holds-unique-content';
    proofs.push({
      fileid: candidate.fileid,
      path: candidate.path,
      size: candidate.size,
      members: members.length,
      proven,
      unproven,
      verdict,
    });
    process.stderr.write(
      `  ${verdict.padEnd(22)} ${proven}/${members.length} members proven by content hash  ${candidate.path.replace('/Pharmacie/', '')}\n`,
    );
  } catch (err) {
    process.stderr.write(`  FAIL ${candidate.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}

const redundant = proofs.filter((proof) => proof.verdict === 'proven-redundant');
const bytes = redundant.reduce((sum, proof) => sum + proof.size, 0);
process.stderr.write(
  `\n${redundant.length}/${proofs.length} archives hold nothing the tree lacks — ${(bytes / 1048576).toFixed(0)} MB\n`,
);

await writeFile(outPath, JSON.stringify({ proofs, redundant: redundant.map((proof) => proof.fileid) }, null, 1));
process.stderr.write(`Wrote ${outPath}\n`);

if (!apply) {
  process.stderr.write('Dry run. Pass --apply to delete the proven-redundant archives.\n');
  process.exit(0);
}

let deleted = 0;
let failed = 0;
for (const proof of redundant) {
  try {
    await client.json('deletefile', { fileid: proof.fileid });
    deleted += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${proof.path}: ${err instanceof Error ? err.message : err}\n`);
  }
}
process.stderr.write(`Deleted ${deleted}, failed ${failed}\n`);

// The scratch folder has served its purpose.
try {
  await client.json('deletefolderrecursive', { folderid: scratchId });
} catch {
  // It may already be gone; nothing depends on it.
}
