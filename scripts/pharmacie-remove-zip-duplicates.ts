/**
 * Removes the redundant copy of each group of identical archives.
 *
 * The duplicate report names the groups whose members are byte-identical,
 * proven by hash. Each group keeps exactly one member; the survivor is the
 * copy that sits in the folder a reader would look in — never the copy
 * nested inside a mirrored server export, never the one stamped " (2)".
 *
 * Usage: bun run scripts/pharmacie-remove-zip-duplicates.ts [report] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface Member {
  fileid: number;
  path: string;
  name: string;
}

interface Group {
  size: number;
  members: Member[];
}

const reportPath = process.argv[2] ?? '/tmp/pharmacie-zip-dupes.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-zip-duplicates-removed.json';
const apply = process.argv.includes('--apply');

const report = JSON.parse(await readFile(reportPath, 'utf8')) as { groups: Group[] };

/** How much a copy is worth keeping: the lowest rank survives. */
function rank(member: Member): number {
  let score = 0;
  if (/SAV - Serveur/i.test(member.path)) score += 2;
  if (/ \(\d+\)\./.test(member.name)) score += 1;
  return score;
}

const removed: Member[] = [];
const kept: Member[] = [];

for (const group of report.groups) {
  const sorted = [...group.members].sort((a, b) => rank(a) - rank(b));
  const [survivor, ...rest] = sorted;
  kept.push(survivor);
  removed.push(...rest);
}

await writeFile(outJson, JSON.stringify({ kept, removed }, null, 1));
process.stderr.write(`Keeping ${kept.length}, removing ${removed.length}\n`);
for (const member of kept) process.stderr.write(`  keep   ${member.path.replace('/Pharmacie/', '')}\n`);
for (const member of removed) process.stderr.write(`  remove ${member.path.replace('/Pharmacie/', '')}\n`);

if (!apply) {
  process.stderr.write(`Wrote ${outJson}\n`);
  process.exit(0);
}

const client = new PcloudHttpClient();
let deleted = 0;
let failed = 0;
for (const member of removed) {
  try {
    await client.json('deletefile', { fileid: member.fileid });
    deleted += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${member.path}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}
process.stderr.write(`Deleted ${deleted}, failed ${failed}\n`);
