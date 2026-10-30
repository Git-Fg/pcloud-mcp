/**
 * Removes the redundant copy of each group of identical files.
 *
 * The duplicate report names the groups whose members are byte-identical,
 * proven by hash. Each group keeps exactly one member: the copy that sits
 * where a reader looks for it — never the one inside a mirrored server
 * export, never the one stamped " (2)", and the one whose path names the
 * semester when the tree has one.
 *
 * The deletion goes to the pCloud trash, so it can be undone.
 *
 * Usage: bun run scripts/pharmacie-remove-file-duplicates.ts [report] [out] [--apply]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { pickKeeper, type DuplicateMember } from './lib/duplicates.js';

interface Group {
  size: number;
  members: DuplicateMember[];
}

const reportPath = process.argv[2] ?? '/tmp/pharmacie-file-duplicates.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-file-duplicates-removed.json';
const apply = process.argv.includes('--apply');

const report = JSON.parse(await readFile(reportPath, 'utf8')) as { groups: Group[] };

const kept: DuplicateMember[] = [];
const removed: DuplicateMember[] = [];

for (const group of report.groups) {
  const { keeper, redundant } = pickKeeper(group.members);
  kept.push(keeper);
  removed.push(...redundant);
}

const freed = removed.reduce((sum, member) => sum + member.size, 0);
await writeFile(outJson, JSON.stringify({ kept, removed }, null, 1));
process.stderr.write(`Keeping ${kept.length}, removing ${removed.length} (${(freed / 1024 / 1024 / 1024).toFixed(2)} GB)\n`);
for (const member of removed.slice(0, 30)) {
  process.stderr.write(`  remove ${member.path.replace('/Pharmacie/', '')}\n`);
}
if (removed.length > 30) process.stderr.write(`  ... and ${removed.length - 30} more\n`);

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
