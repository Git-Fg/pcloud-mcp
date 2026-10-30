/**
 * Audits the canonical teaching-unit folders against the topic their content
 * is about.
 *
 * A folder named for one unit that holds material about another is a
 * misclassification: the numbering of the units changed between the third
 * and the fourth year, so a folder can carry the right number for the wrong
 * year.
 *
 * Usage: bun run scripts/pharmacie-audit-units.ts [inventory]
 */
import { readFile } from 'node:fs/promises';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-8.json';
const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirs: InvNode[] = [];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      dirs.push(node);
      walk(node.children ?? []);
    } else {
      files.push(node);
    }
  }
})(roots);

const under = new Map<string, number>();
for (const dir of dirs) under.set(dir.path, 0);
for (const file of files) {
  const segments = file.path.split('/');
  for (let i = 2; i < segments.length; i += 1) {
    const path = segments.slice(0, i).join('/');
    const count = under.get(path);
    if (count !== undefined) under.set(path, count + 1);
  }
}

/** The topics that identify a unit, and the unit they identify. */
const TOPICS: Array<[RegExp, string]> = [
  [/gnosie|pharmacognos|alcaloid|isoquinol|amino\s?alcool|aminoside|macrolid/i, 'PAM'],
  [/p[ée]nicilline|c[ée]phalosporine|antibact[ée]rien|bact[ée]riolog|streptoco|antifongique/i, 'MICROBIO'],
  [/antiviral|virolog|herp[èe]s|vaccin|cmv|vih\b/i, 'MICROBIO'],
  [/leuc[ée]mie|lymphome|cancer|oncolog|h[ée]mato|m[ée]lome|an[ée]mie/i, 'OMS'],
  [/anticoagul|antiagr[ée]gul|warfarine|heparine|aod\b/i, 'PAM'],
  [/cardio|hypertens|b[êe]ta?bloq|diur[ée]tique|insuffisance\s+card|rhythm/i, 'CV'],
  [/neuro|epileps|antiparkinson|sommeil|psycho|schizophr/i, 'SNC'],
  [/diab[èe]te|insulin|endocrino|thyro[ïi]de|corticost[ée]ro[ïi]de|aldost[ée]rone/i, 'SNC'],
  [/botaniqu|phytoth[ée]rap|hom[ée]opath|aromath|plantes?\s+toxiques/i, 'BOTANIQUE'],
  [/digestif|gastro|ent[ée]rite|colit|h[ée]pat|ulc[èe]re|pancrea/i, 'TUBE-DIG'],
  [/[ée]pid[ée]mi|sant[ée]\s+publique|assuranc|m[ée]decine\s+du\s+travail|pharmaco[ée]con/i, 'SANTE-PUB'],
  [/pharmaco[ée]con|prix\s+et\s+rembours|acc[eè]s\s+au\s+dossier/i, 'SANTE-PUB'],
  [/toxicolog|interaction\s+m[ée]dicament|cyp|surdosage/i, 'VEMA'],
  [/variabilit|pharmacocin[ée]t|posologie|clairance|stp\b/i, 'VEMA'],
  [/pharmaceutique|officine|dispensation|counseling|produit/i, 'PA'],
  [/vigilance|pharmaco[ée]vigilance|mat[ée]rovigilance|nutrivigilance/i, 'VIGILANCE'],
];

const unitDirs = dirs.filter((d) => /\/(3A|4A|5A)(\/(S1|S2))?\/UE-[A-Z0-9-]+$/.test(d.path));

for (const dir of unitDirs) {
  const count = under.get(dir.path) ?? 0;
  if (count < 5) continue;
  const unit = dir.name;
  const own = files.filter((f) => f.path.startsWith(`${dir.path}/`));
  const votes = new Map<string, number>();
  for (const file of own) {
    for (const [pattern, topic] of TOPICS) {
      if (pattern.test(file.name)) votes.set(topic, (votes.get(topic) ?? 0) + 1);
    }
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) continue;
  const [topTopic, topVotes] = ranked[0];
  const unitToken = unit.replace('UE-', '').replace('-', '');
  if (!unitToken.toUpperCase().includes(topTopic)) {
    const _year = dir.path.split('/').filter(Boolean)[1];
    console.log(
      `MISMATCH ${dir.path.replace('/Pharmacie/', '')}\n` +
        `  files=${count}  content is about ${topTopic} (${topVotes} hits)  but folder says ${unit}\n` +
        `  next: ${ranked.slice(1, 4).map(([t, c]) => `${t}:${c}`).join(' ') || '(none)'}\n` +
        `  sample: ${own.slice(0, 3).map((f) => f.name).join(' | ')}\n`
    );
  }
}
