/**
 * The teaching units, and the numbering each year uses for them.
 *
 * The number a unit carries changed between the third and the fourth year:
 * unit eight was the principles of the active ingredients in the third year
 * and the applied pharmacy in the fourth, so a number only means something
 * together with the year it belongs to.
 *
 * The third year follows the programme that was in force when the corpus
 * was taught, and that programme numbers its units differently from the
 * later years:
 *
 *   semester 1   1 physiologie et pharmacologie
 *                2 ingénierie du médicament, sciences galéniques et physicochimiques
 *                3 pharmacocinétique, toxicologie, champignons macroscopiques toxiques
 *                4 immunologie fondamentale, immunopathologie, biothérapies
 *                5 diabète et obésité
 *   semester 2   7 maladies cardiovasculaires et rénales, hématologie
 *                8 principes actifs d'origine naturelle, agents anti-infectieux
 *                9 microbiologie générale et clinique
 *                10 maladies parasitaires et fongiques
 *                11 pathologies du système digestif
 *                12 santé publique
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

/**
 * The unit a number names, per year.
 *
 * The third year has no unit on infectious diseases as such: its
 * microbiology is a general and clinical one, which is where its
 * bacteriology, virology and parasitology belong. Its pharmacology is a
 * foundation — physiology and pharmacology — which sits with the
 * disciplines the later years teach in their second half, and its
 * pharmaceutical engineering — galenics and physical chemistry — sits
 * with the unit on the variability of exposure.
 */
export const UNIT_BY_YEAR: Record<string, Record<number, Unit>> = {
  '3A': {
    1: 'UE-05-SNC',
    2: 'UE-03-VEMA',
    3: 'UE-03-VEMA',
    4: 'UE-01-OMS',
    5: 'UE-05-SNC',
    6: 'UE-12-SANTE-PUB',
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

/** The unit a number names, whatever the year. */
export function unitByNumber(number: number, year: string | null): Unit | null {
  if (!year) return null;
  return UNIT_BY_YEAR[year]?.[number] ?? null;
}
