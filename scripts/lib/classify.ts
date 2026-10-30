/**
 * Classification rules for the pCloud Pharmacie migration.
 *
 * The legacy tree was produced by several Drive exports, so the same kind of
 * material sits under a dozen different folder names. These rules turn a
 * legacy path into the canonical coordinates — year, semester, teaching unit
 * and kind of material — that the reorganised tree is built from.
 *
 * The teaching-unit numbering changed between the third and the fourth year:
 * UE8 was pharmacognosie in the third year and pharmacie appliquée in the
 * fourth, so a unit number only means something together with its year.
 */

/** The canonical teaching units. */
export const UNITS = [
  'UE-01-OMS',
  'UE-02-PAM',
  'UE-03-VEMA',
  'UE-04-PI',
  'UE-05-SNC',
  'UE-06-VIGILANCE',
  'UE-07-CV',
  'UE-08-PA',
  'UE-09-MICROBIO',
  'UE-10-BOTANIQUE',
  'UE-11-TUBE-DIG',
  'UE-12-SANTE-PUB',
] as const;

export type Unit = (typeof UNITS)[number];

/** The kinds of material a canonical unit holds. */
export const DOC_TYPES = [
  'Cours',
  'Fiches',
  'Annales',
  'ED',
  'TD',
  'Supports',
  'Roneos',
  'Transcriptions',
  'Images',
  'Projets',
  'Videos',
  'Versions',
  'Autres',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

/**
 * The unit number a legacy folder names, per year. The third year only
 * covered the units from UE7 onwards; its UE8 was pharmacognosie, which
 * belongs with the active ingredients rather than with the applied
 * pharmacy of the fourth year.
 */
const UNIT_BY_YEAR: Record<string, Record<number, Unit>> = {
  '3A': {
    1: 'UE-02-PAM',
    2: 'UE-02-PAM',
    3: 'UE-03-VEMA',
    4: 'UE-01-OMS',
    5: 'UE-05-SNC',
    6: 'UE-05-SNC',
    7: 'UE-07-CV',
    8: 'UE-02-PAM',
    9: 'UE-09-MICROBIO',
    10: 'UE-09-MICROBIO',
    11: 'UE-11-TUBE-DIG',
    12: 'UE-12-SANTE-PUB',
  },
  '4A': {
    1: 'UE-01-OMS',
    2: 'UE-02-PAM',
    3: 'UE-03-VEMA',
    4: 'UE-04-PI',
    5: 'UE-05-SNC',
    6: 'UE-06-VIGILANCE',
    7: 'UE-07-CV',
    8: 'UE-08-PA',
    9: 'UE-09-MICROBIO',
    10: 'UE-10-BOTANIQUE',
    11: 'UE-11-TUBE-DIG',
    12: 'UE-12-SANTE-PUB',
  },
  '5A': {
    1: 'UE-01-OMS',
    2: 'UE-02-PAM',
    3: 'UE-03-VEMA',
    4: 'UE-04-PI',
    5: 'UE-05-SNC',
    6: 'UE-06-VIGILANCE',
    7: 'UE-07-CV',
    8: 'UE-08-PA',
    9: 'UE-09-MICROBIO',
    10: 'UE-10-BOTANIQUE',
    11: 'UE-11-TUBE-DIG',
    12: 'UE-12-SANTE-PUB',
  },
};

/**
 * Topic words that name a unit even in a folder that is not called a unit:
 * the course acronyms the students used ("PNEDI", "HEMATO") are unambiguous.
 */
const STRONG_TOPIC_UNITS: Array<[RegExp, Unit]> = [
  [/\bpnedi\b/i, 'UE-05-SNC'],
  [/\bh[ée]mato\b/i, 'UE-01-OMS'],
  [/\bonco\b/i, 'UE-01-OMS'],
  [/\bbotaniqu|\bplantes?\b/i, 'UE-10-BOTANIQUE'],
  [/\bmicrobiol/i, 'UE-09-MICROBIO'],
  [/\bvema\b/i, 'UE-03-VEMA'],
  [/\bcardio/i, 'UE-07-CV'],
  [/\boms\b/i, 'UE-01-OMS'],
  [/\bpam\b/i, 'UE-02-PAM'],
  [/\bgnosi|gal[ée]nique|chimie\s+th[ée]rapeut/i, 'UE-02-PAM'],
  [/toxicolog|pharmacocin[ée]t|variabilit[ée]/i, 'UE-03-VEMA'],
  [/\binfecti|\bbact[ée]rio|\bvirolog/i, 'UE-04-PI'],
  [/\bparasito|\bmyco/i, 'UE-09-MICROBIO'],
  [/\bdiab[èe]te|\bendorcrino|\bneuro/i, 'UE-05-SNC'],
  [/\bcardia|\binsuffisance\s+card|\bh[ée]mostase/i, 'UE-07-CV'],
];

/**
 * Topic words that name a unit when the folder only carries a number.
 * They override the numbering, which is ambiguous between years.
 */
const TOPIC_UNITS: Array<[RegExp, Unit]> = [
  [/oncolog|h[ée]mato|leuc[ée]mi|lymphom|pharmacie\s+clinique|\boms\b/i, 'UE-01-OMS'],
  [/principe|chimie\s+th[ée]rapeut|pharmacognos|gal[ée]nique|\bpam\b/i, 'UE-02-PAM'],
  [/variabilit|pharmacocin[ée]t|pharmacog[ée]n[ée]t|\bvema\b|toxicolog/i, 'UE-03-VEMA'],
  [/infecti|bact[ée]rio|virolog|parasitolog|\bpi\b/i, 'UE-04-PI'],
  [/snc|neuro|pnedi|endocrino|douleur|inflammat/i, 'UE-05-SNC'],
  [/vigilance|pharmaceutique\s+de\s+pharmac|\bvea\b/i, 'UE-06-VIGILANCE'],
  [/cardio|h[ée]mostase|cardia|insuffisance/i, 'UE-07-CV'],
  [/pharmacie\s+appliqu[ée]|\bpa\b|officine|produits?\s+de\s+sant[ée]/i, 'UE-08-PA'],
  [/microbiol|bact[ée]riolog|virolog|antibioti/i, 'UE-09-MICROBIO'],
  [/botaniqu|phytoth[ée]rap|plantes|m[ée]dicaments? \d*v/i, 'UE-10-BOTANIQUE'],
  [/digestif|hepat|gastro|ent[ée]ro|nutrition/i, 'UE-11-TUBE-DIG'],
  [/sant[ée]\s+publique|[ée]pid[ée]mi|assuranc|m[ée]decine\s+du\s+travail/i, 'UE-12-SANTE-PUB'],
];

/**
 * Folder names that say what kind of material they hold. The names carry
 * qualifiers ("Annales Thomas", "Fiches Magiques", "ED UE7 Pharmaco"), so
 * they are matched on their beginning.
 */
const DOC_TYPE_FOLDERS: Array<[RegExp, DocType]> = [
  [/^annales?\b/i, 'Annales'],
  [/^fiches?\b/i, 'Fiches'],
  [/^fiche\s+(de\s+cours|finale)/i, 'Fiches'],
  [/^cours?\b/i, 'Cours'],
  [/^en\s+cours\b/i, 'Cours'],
  [/^ed\b/i, 'ED'],
  [/^ed[0-9]/i, 'ED'],
  [/^tp\b/i, 'TD'],
  [/^travaux\s+pratiques/i, 'TD'],
  [/^ron[ée]os?\b/i, 'Roneos'],
  [/^transcriptions?\b/i, 'Transcriptions'],
  [/^(images?|media|photos?)\b/i, 'Images'],
  [/^projets?\b/i, 'Projets'],
  [/^(vid[ée]os?|panopto)\b/i, 'Videos'],
  [/^supports?\b/i, 'Supports'],
  [/^anciennes?\s+versions?\b/i, 'Versions'],
];

/** The year the material belongs to. */
export function detectYear(path: string): string | null {
  if (/\/(3A|4A|5A)\//.test(path)) {
    const match = path.match(/\/(3A|4A|5A)\//);
    return match ? match[1] : null;
  }
  if (/DFGSP3/i.test(path)) return '3A';
  if (/DFASP1/i.test(path)) return '4A';
  return null;
}

/**
 * The semester the material belongs to.
 *
 * The Drive exports nested a content folder inside a folder named after
 * another semester, so the deepest signal is the one that describes the
 * material itself. Signals that contradict each other leave the semester
 * unknown rather than guessing.
 */
export function detectSemester(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  const signals: Array<string | null> = [];
  for (const segment of segments) {
    const explicit = segment.match(/semestre\s*([12])/i)?.[1];
    if (explicit) {
      signals.push(`S${explicit}`);
      continue;
    }
    const compact = segment.match(/\bS([12])\b/i)?.[1];
    if (compact) {
      signals.push(`S${compact}`);
      continue;
    }
    signals.push(null);
  }
  // The deepest signal wins; a contradiction at that level leaves it unknown.
  for (let i = signals.length - 1; i >= 0; i -= 1) {
    if (signals[i]) return signals[i];
  }
  return null;
}

/** The unit a folder name refers to, or null when it names none. */
export function detectUnit(folderName: string, year: string | null): Unit | null {
  const number = folderName.match(/^UE[\s\-.]*0?(\d{1,2})/i)?.[1];
  if (number !== undefined && year) {
    const unit = UNIT_BY_YEAR[year]?.[Number(number)];
    if (unit) return unit;
  }
  // A course acronym names its unit wherever it appears.
  for (const [pattern, unit] of STRONG_TOPIC_UNITS) {
    if (pattern.test(folderName)) return unit;
  }
  // Only a folder that names itself a unit may be recognised by its topic:
  // a course folder called "Plantes toxiques" is not a unit.
  if (!/^UE\b|^UE[\s\-]/i.test(folderName)) return null;
  for (const [pattern, unit] of TOPIC_UNITS) {
    if (pattern.test(folderName)) return unit;
  }
  return null;
}

/**
 * The sources the "Certificat de synthèse" revision was compiled from. A
 * folder named after one of them holds revision material rather than course
 * material, and the revision is organised by source, not by teaching unit.
 */
const CSP_SOURCES = new Set(['COMP', 'FICHES', 'ED', 'ATP', 'OFFICIEL', 'OLD', 'QSTS', 'AUTRES']);

/**
 * The "Certificat de synthèse" folder a path belongs to. The CSP revision
 * material is organised by its source (COMP, ATP, QSTS, ED, FICHES,
 * OFFICIEL, OLD), not by teaching unit. A session year names a revision too,
 * and is kept as it reads.
 */
export function detectCspSource(path: string): string | null {
  for (const segment of path.split('/')) {
    const match = segment.match(/^CSP-(.+)$/i);
    if (!match) continue;
    const suffix = match[1].trim();
    if (CSP_SOURCES.has(suffix.toUpperCase())) return suffix.toUpperCase();
    if (/^\d{4}$/.test(suffix)) return suffix;
  }
  return null;
}

/** The kind of material a folder name refers to. */
export function detectDocType(folderName: string): DocType | null {
  for (const [pattern, docType] of DOC_TYPE_FOLDERS) {
    if (pattern.test(folderName.trim())) return docType;
  }
  return null;
}

/** True when the folder name names a teaching unit at all. */
export function namesUnit(folderName: string): boolean {
  return /^UE[\s\-.]*0?\d/i.test(folderName) || /^UEI\d/i.test(folderName);
}
