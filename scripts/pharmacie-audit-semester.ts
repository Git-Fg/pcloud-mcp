/**
 * Checks that the third year honours the programme.
 *
 * The third year runs over two semesters: the first holds the units one to
 * six, the second the units seven to twelve. A document that names its unit
 * — in its own name or in the folder above it — therefore belongs to one
 * semester and no other. This audit reads the whole tree and reports every
 * document that sits in the semester the programme does not give it.
 *
 * The audit is the gate the split has to pass: it is run before and after.
 *
 * Usage: bun run scripts/pharmacie-audit-semester.ts [inventory]
 */
import { readFile } from 'node:fs/promises';
import { resolveUnitNumberFromPath } from './lib/pathClassify.js';
import { semesterForUnit } from './lib/classify.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-20.json';
const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const inThirdYear = files.filter((f) => /^\/Pharmacie\/3A\//.test(f.path));

let inSemester = 0;
let atYearLevel = 0;
const mismatches: Array<{ path: string; semester: string; expected: string; unit: number }> = [];
const undecidable: string[] = [];

for (const file of inThirdYear) {
  const match = file.path.match(/^\/Pharmacie\/3A\/(S1|S2)\//);
  if (!match) {
    atYearLevel += 1;
    continue;
  }
  const semester = match[1];
  inSemester += 1;

  const number = resolveUnitNumberFromPath(file.path, '3A');
  if (number === null) {
    undecidable.push(file.path);
    continue;
  }
  const expected = semesterForUnit('3A', number);
  if (expected !== semester) {
    mismatches.push({ path: file.path, semester, expected: expected!, unit: number });
  }
}

const outsideThirdYear = files.filter((f) => !/^\/Pharmacie\/3A\//.test(f.path)).length;

process.stderr.write(`third-year files: ${inThirdYear.length}\n`);
process.stderr.write(`  in a semester: ${inSemester}\n`);
process.stderr.write(`  still at the level of the year: ${atYearLevel}\n`);
process.stderr.write(`  outside the third year: ${outsideThirdYear}\n`);
process.stderr.write(`  semester contradicts the unit number: ${mismatches.length}\n`);
process.stderr.write(`  unit number not stated: ${undecidable.length}\n`);

for (const mismatch of mismatches.slice(0, 40)) {
  process.stderr.write(`  ${mismatch.path.replace('/Pharmacie/', '')}  says UE${mismatch.unit} (${mismatch.expected}) but sits in ${mismatch.semester}\n`);
}
if (mismatches.length > 40) process.stderr.write(`  ... and ${mismatches.length - 40} more\n`);
