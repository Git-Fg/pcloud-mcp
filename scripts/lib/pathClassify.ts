/**
 * Path classification for the Pharmacie migration.
 *
 * The legacy tree encodes the teaching unit in the folder names above the
 * file. Those names are the first thing to read: a folder called "TP
 * Microbio" says what its content is about, and it says it better than the
 * first pages of a long document do. The content of a file is the fallback
 * for the folders that say nothing.
 */

import { detectYear } from './classify.js';
import { unitByNumber, type Unit } from './codebook.js';

export { unitByNumber };

/**
 * The unit a path segment refers to, or null when it refers to none.
 *
 * A unit number wins over a topic word: "ED UE8 Chimie Théra" is unit
 * eight whatever its title says. The infectious-disease topics sit in the
 * infectious-disease unit of the fourth and fifth years, but in the
 * microbiology unit of the third year, where unit nine is "microbiologie
 * générale et clinique".
 */
export function signalFromSegment(segment: string, year: string | null): Unit | null {
  const s = segment.trim().toLowerCase();

  // 1) A unit number anywhere in the segment: "ED UE8 Chimie Théra",
  //    "UE1.2.ED3 Corrigé", "Fiches condensées UE7".
  const ueNum = s.match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/);
  if (ueNum) {
    const mapped = unitByNumber(Number(ueNum[1]), year);
    if (mapped) return mapped;
  }

  // 2) The orientation units of the officine track.
  if (/ue\s*o1\b|o1\s*[-–]\s*dialogue/.test(s)) return 'UE-08-PA';
  if (/ue\s*o2\b|o2\s*[-–]\s*phyto/.test(s)) return 'UE-10-BOTANIQUE';
  if (/ue\s*o3\b|o3\s*[-–]\s*environnement/.test(s)) return 'UE-12-SANTE-PUB';
  if (/ue\s*o4\b|o4\s*[-–]\s*activit/.test(s)) return 'UE-08-PA';
  if (/ue\s*o6\b|o6\s*[-–]\s*suivi/.test(s)) return 'UE-08-PA';
  if (/ue\s*o7\b|o7\s*[-–]\s*environnement|mycologie\s*officinale/.test(s)) return 'UE-08-PA';
  if (/ue\s*o10\b|o10\s*[-–]\s*gestion/.test(s)) return 'UE-08-PA';
  if (/pop\s*officine|dialogue\s*sur\s*ordo/.test(s)) return 'UE-08-PA';

  // 3) The industry and research track.
  if (/(^|\s)(ir[3456]|i[1234])(\s|$|\b)/.test(s)) return 'UE-08-PA';
  if (/industrie/.test(s)) return 'UE-08-PA';

  // 4) The named disciplines.
  const infectTopics = /infecti|bact[eé]rio|virolog|parasitolog|mycolog/;
  if (year === '3A') {
    if (infectTopics.test(s) || /microbiol/.test(s)) return 'UE-09-MICROBIO';
  } else if (infectTopics.test(s)) {
    return 'UE-04-PI';
  } else if (/microbiol/.test(s)) {
    return 'UE-09-MICROBIO';
  }
  if (/^cv$|^cardio$|rein\b|h[eé]mostase|s[eé]mio\s*cv/.test(s)) return 'UE-07-CV';
  if (/^pam\b|pharmacognosie|gal[eé]nique|chimie\s*th[eé]rapeut/.test(s)) return 'UE-02-PAM';
  if (/^micro\b|viro\b/.test(s)) return 'UE-09-MICROBIO';
  if (/h[eé]mato\b|oncolog|leuc[eé]mi|lymphom|pharmacie\s*clinique/.test(s)) return 'UE-01-OMS';
  if (/toxico|toxicolog/.test(s)) return 'UE-03-VEMA';
  if (/pk\b|pharmacocin|variabilit|stp\b/.test(s)) return 'UE-03-VEMA';
  if (/snc\b|neuro|pnedi|douleur|inflammat|endocrino|diab[eé]te|epileps|migraine|alzheimer|parkinson|psychiatrie/.test(s)) return 'UE-05-SNC';
  if (/vea\b|vigilance/.test(s)) return 'UE-06-VIGILANCE';
  if (/pir\b|economie|[ée]co\s*droit|droit\s*pharm/.test(s)) return 'UE-12-SANTE-PUB';
  if (/indus\b/.test(s)) return 'UE-08-PA';
  if (/botaniqu|phyto|plantes|hom[eé]opath/.test(s)) return 'UE-10-BOTANIQUE';
  if (/digestif|h[eé]pat|gastro|ent[eé]ro|nutrition|mici\b/.test(s)) return 'UE-11-TUBE-DIG';
  if (/sant[eé]\s*publique|[eé]pid[eé]mi|assuranc/.test(s)) return 'UE-12-SANTE-PUB';

  return null;
}

/**
 * The unit a path refers to, read from its segments deepest first. The
 * deepest segment that names a unit is the one that describes the material.
 */
export function resolveUnitFromPath(path: string): Unit | null {
  const year = detectYear(path);
  const segments = path.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    const unit = signalFromSegment(segments[i], year);
    if (unit) return unit;
  }
  return null;
}

/**
 * The unit number a path names, read from its segments deepest first.
 *
 * The canonical unit folder is left out on purpose. Its number comes from
 * the codebook, and in the third year the codebook folds several programme
 * units into one name, so that number is not the unit the document was
 * taught in. The folders below it, and the document itself, keep the
 * programme number.
 *
 * The third year numbers its units differently from the fourth, so the
 * number only means something together with the year it belongs to.
 */
export function resolveUnitNumberFromPath(path: string, year: string | null): number | null {
  const segments = path.split('/').filter(Boolean);
  const canonical = segments.findIndex(
    (segment, i) =>
      /^UE-[0-9]{2}-[A-Z-]+$/.test(segment) &&
      (segments[i - 1] === '3A' || segments[i - 1] === 'S1' || segments[i - 1] === 'S2')
  );
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (i === canonical) continue;
    const match = segments[i].match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/i);
    if (!match) continue;
    const number = Number(match[1]);
    if (number >= 1 && number <= 12 && unitByNumber(number, year)) return number;
  }
  return null;
}
