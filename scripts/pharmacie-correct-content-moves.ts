/**
 * Corrects the placements the broken content classifier made.
 *
 * The audit that follows a classifier bug is a work list, not an answer key:
 * each disagreement is judged by what the file is, which its name, its
 * origin and its series all say. This script applies those judgments as
 * cluster rules — a file belongs with the series it came from — and leaves
 * alone whatever no rule covers.
 *
 * Usage: bun run scripts/pharmacie-correct-content-moves.ts [audit] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { detectYear } from './lib/classify.js';
import type { Unit } from './lib/classify.js';

interface AuditEntry {
  id: number;
  name: string;
  sitsIn: string;
  saysItIs: string | null;
  verdict: 'agree' | 'disagree' | 'unreadable';
}

interface MoveOrigin {
  id: number;
  from: string;
  toPath: string;
  toname: string;
}

interface Correction {
  id: number;
  name: string;
  fromUnit: string;
  toPath: string;
  rule: string;
}

const auditPath = process.argv[2] ?? '/tmp/pharmacie-audit-content.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-corrections.json';

const audit = JSON.parse(await readFile(auditPath, 'utf8')) as { entries: AuditEntry[] };

// Where each moved file came from, so a series can be recognised by its origin.
const manifestPaths = [
  '/tmp/pharmacie-inspect-plan-2.json',
  '/tmp/pharmacie-inspect-plan-3.json',
  '/tmp/pharmacie-inspect-plan-4.json',
  '/tmp/pharmacie-inspect-targeted.json',
];
const origins = new Map<number, MoveOrigin>();
for (const path of manifestPaths) {
  const plan = JSON.parse(await readFile(path, 'utf8')) as { moves: MoveOrigin[] };
  for (const move of plan.moves) origins.set(move.id, move);
}

/** The unit a file's own name declares, when it declares one. */
function unitFromName(name: string, year: string): Unit | null {
  const match = name.toLowerCase().match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/);
  if (!match) return null;
  const map: Record<string, Record<number, Unit>> = {
    '3A': { 1: 'UE-02-PAM', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-01-OMS', 5: 'UE-05-SNC', 6: 'UE-05-SNC', 7: 'UE-07-CV', 8: 'UE-02-PAM', 9: 'UE-09-MICROBIO', 10: 'UE-09-MICROBIO', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
    '4A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
    '5A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' }
  };
  return map[year]?.[Number(match[1])] ?? null;
}

const corrections: Correction[] = [];
const stays: Correction[] = [];
const untouched: AuditEntry[] = [];

for (const entry of audit.entries) {
  if (entry.verdict !== 'disagree') continue;
  const origin = origins.get(entry.id);
  const from = origin?.from ?? '';
  const toPath = origin?.toPath ?? '';
  const year = detectYear(toPath) ?? '4A';
  const semester = /\/S([12])\//.exec(toPath)?.[1];
  // pCloud stores names with decomposed accents; the rules read composed ones.
  const name = entry.name.normalize('NFC');
  const base = `/Pharmacie/${year}${semester ? `/S${semester}` : ''}`;

  // 1) A unit number in the file's own name is authoritative: the file was
  //    written for that unit. When it already sits there, the audit was
  //    wrong and the file stays. A name like "ue71" writes a subunit of
  //    unit seven ("UE 7.1"), so the first digit names the unit.
  const byName = unitFromName(name, year);
  const subunit = name.toLowerCase().match(/\bue\s?(\d)(\d)/);
  const bySubunit = subunit ? unitFromName(`UE${subunit[1]}`, year) : null;
  const declared = byName ?? bySubunit;
  if (declared && declared !== entry.sitsIn) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/${declared}`, rule: 'unit named in file' });
    continue;
  }
  if (declared && declared === entry.sitsIn) {
    stays.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: '', rule: 'unit named in file' });
    continue;
  }

  // 2) The stage worksheets: prescription analysis grids of the hospital placement.
  if (/grille[_\s]*analyse|ordo\d|profil_patient/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-08-PA/Autres`, rule: 'stage worksheet' });
    continue;
  }

  // 3) The "Certificat de synthèse" exam papers belong with the revision
  //    material, not with a teaching unit.
  if (/^csp\b|^certificat\s*de\s*synth|^corrig[ée]_?qst|^sujet\s*\d|^correctionannales|^csp_|^\d{4}-\d{4}\s*annales/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `/Pharmacie/${year}/CSP/AUTRES/Annales`, rule: 'CSP exam paper' });
    continue;
  }

  // 4) The industry course series: the numbered development-and-regulation
  //    lectures of the industrial track.
  if (
    /amm|autorisation\s*de\s*mise|qualit[eé]|recherche\s*clinique|orphelins|bioanalyse|d[eé]veloppement\s*du\s*m[eé]dicament|[ée]valuation\s*non\s*clinique|innovation\s*pharmaceutique|m[eé]dicaments\s*biologiques|chimiste\s*m[eé]dicinal/i.test(name) ||
    /indus/i.test(from)
  ) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-08-PA`, rule: 'industry series' });
    continue;
  }

  // 5) The infectious-disease course series: antibiotic classes, infections
  //    and the immunology that opens it.
  if (/atb\b|bact[ée]ri[ée]mies|infcutan|infmaterno|infurinaires|\bist\b|quinolones|t[ée]tracyclines|\borl\b|autoi\b|\bimmuno\b/i.test(name)) {
    const unit: Unit = year === '3A' ? 'UE-09-MICROBIO' : 'UE-04-PI';
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/${unit}`, rule: 'infectious series' });
    continue;
  }

  // 5b) The pipeline and prompt artefacts the revision workflow left behind.
  if (/pipeline|processed_hashes|output_fiches|copilot-instructions|^prompt|^instr/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: '/Pharmacie/_OUTILS/CSP-Pipeline', rule: 'pipeline artefact' });
    continue;
  }

  // 5c) Generic revision fiches not tied to a teaching unit.
  if (/fichesv2_?r[eé]vision/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `/Pharmacie/${year}/CSP/AUTRES`, rule: 'generic revision' });
    continue;
  }

  // 5c) The research-track material (PIR) and its own unit numbers.
  if (/\bpir\b|^ue31\b|^ue23\b/i.test(name) || /pir/i.test(from)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-12-SANTE-PUB`, rule: 'research track' });
    continue;
  }

  // 5d) A discipline named alone in the title names the unit.
  if (/n[ée]phro/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-07-CV`, rule: 'discipline in title' });
    continue;
  }
  if (/anesth[ée]si|dmard/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-05-SNC`, rule: 'discipline in title' });
    continue;
  }

  // 5e) The interpretation of laboratory results is pharmacy practice.
  if (/interpr[ée]tation\s*des\s*examens|analyse\s*des\s*examens/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-08-PA/Autres`, rule: 'lab interpretation' });
    continue;
  }

  // 6) The clinical pharmacology fiches of the "Fiche Mel" and "Fiche Claudie"
  //    series: neurology, pain, endocrinology — one exception for the gut.
  if (/fiche\s+(mel|claudie)|cours\/fiche\s+(mel|claudie)/i.test(from)) {
    const unit: Unit = /mici|digestif/i.test(name) ? 'UE-11-TUBE-DIG' : /bact[eé]rio/i.test(name) ? 'UE-04-PI' : 'UE-05-SNC';
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/${unit}`, rule: 'fiche series' });
    continue;
  }

  // 6b) A drug monograph — one file named after one medicine — and the
  //     worksheets that go with it are stage material.
  if (
    /^med\d+_/i.test(name) ||
    /analyse[_\s]*ordo|guide[_\s]*analyse|instruct\.txt/i.test(name) ||
    /^(doliprane|dafalgan|propranolol|xigduo|xultophy|zestoretic|crestor|kardegic|eliquis|aflusivel|forxiga|jardiance)\b/i.test(name)
  ) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-08-PA/Autres`, rule: 'drug monograph / stage' });
    continue;
  }

  // 6c) The exams of the industry unit.
  if (/examen\s*i1|^annales?\s*examen\s*i1/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/UE-08-PA/Annales`, rule: 'industry exam' });
    continue;
  }

  // 6d) The revision sections of the certificate.
  if (/^[a-z]\s*[-–]\s*sciences\s*pharmaceutiques/i.test(name)) {
    corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `/Pharmacie/${year}/CSP/AUTRES`, rule: 'certificate section' });
    continue;
  }

  // 7) The audit's unit is backed by a clear topic word in the file's own
  //    name: the name says what the file is about, follow it.
  if (entry.saysItIs) {
    const TOPIC_WORD: Array<[RegExp, Unit]> = [
      [/cardio|n[ée]phro|angor|arythmie/i, 'UE-07-CV'],
      [/diab|endocrino|insulin|thyro[ïi]de/i, 'UE-05-SNC'],
      [/onco|h[ée]mato|leuc[ée]mi|lymphome|my[ée]lome/i, 'UE-01-OMS'],
      [/toxico|intoxication/i, 'UE-03-VEMA'],
      [/pharmacocin[ée]t|clairance/i, 'UE-03-VEMA'],
      [/infecti|bact[ée]rio|viro|antibiot|ist\b/i, 'UE-04-PI'],
      [/digestif|mici|colite|h[ée]patique/i, 'UE-11-TUBE-DIG'],
      [/pharmaco_|^ains\b|clinic_|rhumatismes|^ric\b|analg[ée]sique|opio[ïi]de/i, 'UE-05-SNC'],
      [/sant[ée]\s*publique|assurance|[ée]conomie|droit\s*pharm/i, 'UE-12-SANTE-PUB'],
      [/officine|industri|amm\b|qualit[ée]/i, 'UE-08-PA'],
    ];
    const backed = TOPIC_WORD.find(([pattern, unit]) => unit === entry.saysItIs && pattern.test(name));
    if (backed) {
      corrections.push({ id: entry.id, name, fromUnit: entry.sitsIn, toPath: `${base}/${entry.saysItIs}`, rule: 'audit backed by name' });
      continue;
    }
  }

  untouched.push(entry);
}

// A rule that sends a file where it already sits says the file was right all
// along: that is a stay, not a move.
for (let i = corrections.length - 1; i >= 0; i -= 1) {
  const correction = corrections[i];
  if (correction.toPath.endsWith(`/${correction.fromUnit}`)) {
    corrections.splice(i, 1);
    stays.push({ ...correction, toPath: '', rule: `${correction.rule} (already there)` });
  }
}

const byRule = corrections.reduce<Record<string, number>>((acc, c) => {
  acc[c.rule] = (acc[c.rule] ?? 0) + 1;
  return acc;
}, {});

await writeFile(outJson, JSON.stringify({ corrections, stays, untouched }, null, 1));
process.stderr.write(`Moves: ${corrections.length} | Stays: ${stays.length} | Untouched: ${untouched.length}\n`);
for (const [rule, count] of Object.entries(byRule)) {
  process.stderr.write(`  ${String(count).padStart(4)}  ${rule}\n`);
}
process.stderr.write(`\nUntouched (need a human eye):\n`);
for (const entry of untouched.slice(0, 30)) {
  process.stderr.write(`  ${entry.name.slice(0, 55)}  ${entry.sitsIn} -> ${entry.saysItIs}\n`);
}
if (untouched.length > 30) process.stderr.write(`  ... and ${untouched.length - 30} more\n`);
process.stderr.write(`Written ${outJson}\n`);
