/**
 * Shows what the duplicate report holds, before anything is deleted.
 *
 * The report names groups of files that hold the same bytes. Deleting a
 * redundant copy is only safe if the copy that stays is the one a reader
 * looks for. This script makes that choice visible: where the survivors
 * sit, where the redundant copies sit, and which groups deserve a second
 * look before the deletion runs.
 *
 * Usage: bun run scripts/pharmacie-duplicate-overview.ts [report]
 */
import { readFile } from 'node:fs/promises';
import { pickKeeper, type DuplicateMember } from './lib/duplicates.js';

interface Group {
  size: number;
  members: DuplicateMember[];
}

const reportPath = process.argv[2] ?? '/tmp/pharmacie-file-duplicates.json';
const report = JSON.parse(await readFile(reportPath, 'utf8')) as { groups: Group[] };

/** Where a path sits in the tree, described by the parts that matter. */
function location(path: string): string {
  const relative = path.replace(/^\/Pharmacie\//, '');
  const parts = relative.split('/');
  return parts.length <= 2 ? relative : `${parts[0]}/${parts[1]}/…`;
}

const histogram = new Map<string, number>();
for (const group of report.groups) {
  const key = `${group.members.length} copies`;
  histogram.set(key, (histogram.get(key) ?? 0) + 1);
}

process.stderr.write(`${report.groups.length} groups of identical files\n`);
process.stderr.write(`group size: ${[...histogram.entries()].sort().map(([k, v]) => `${k}: ${v}`).join(', ')}\n`);

const keeperLocations = new Map<string, number>();
const copyLocations = new Map<string, number>();
let keeperOutsideCurriculum = 0;

for (const group of report.groups) {
  const { keeper, redundant } = pickKeeper(group.members);
  const where = location(keeper.path);
  keeperLocations.set(where, (keeperLocations.get(where) ?? 0) + 1);
  if (!/^\/Pharmacie\/(3A|4A|5A)\//.test(keeper.path)) keeperOutsideCurriculum += 1;
  for (const member of redundant) {
    const place = location(member.path);
    copyLocations.set(place, (copyLocations.get(place) ?? 0) + 1);
  }
}

process.stderr.write(`\nkeepers outside the year folders: ${keeperOutsideCurriculum}\n`);
process.stderr.write('\nwhere the keepers sit:\n');
for (const [where, count] of [...keeperLocations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  process.stderr.write(`  ${String(count).padStart(5)}  ${where}\n`);
}
process.stderr.write('\nwhere the redundant copies sit:\n');
for (const [where, count] of [...copyLocations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  process.stderr.write(`  ${String(count).padStart(5)}  ${where}\n`);
}

const top = [...report.groups]
  .sort((a, b) => (b.members.length - 1) * b.size - (a.members.length - 1) * a.size)
  .slice(0, 15);
process.stderr.write('\nthe fifteen groups that free the most space:\n');
for (const group of top) {
  const { keeper, redundant } = pickKeeper(group.members);
  const wasted = redundant.reduce((sum, member) => sum + member.size, 0);
  process.stderr.write(`\n  ${group.members.length} copies of ${(group.size / 1024 / 1024).toFixed(1)} MB, ${(wasted / 1024 / 1024).toFixed(1)} MB reclaimable\n`);
  process.stderr.write(`    KEEP    ${keeper.path.replace('/Pharmacie/', '')}\n`);
  for (const member of redundant) {
    process.stderr.write(`    remove  ${member.path.replace('/Pharmacie/', '')}\n`);
  }
}
