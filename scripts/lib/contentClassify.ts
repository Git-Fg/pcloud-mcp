/**
 * Content classification for the Pharmacie migration.
 *
 * A file whose folder says nothing about its subject can still be placed
 * from what it says: the first page of a course names its discipline. These
 * rules read that text and name the teaching unit it belongs to.
 *
 * A unit number written in the text beats every topic signal; the topic
 * scoring only runs when there is none.
 */

import type { Unit } from './classify.js';

/**
 * The signals that name a unit, and how strongly they name it.
 *
 * A strong signal is a word only that unit uses: a molecule name, a course
 * title. A weak signal is a common word that many texts contain, so two of
 * them are needed before the unit is certain. Every signal is bounded by
 * word boundaries so a fragment of a common word can never match.
 */
const UNIT_SIGNALS: Array<{ unit: Unit; strong: RegExp[]; weak: RegExp[] }> = [
  {
    unit: 'UE-01-OMS',
    strong: [/rituximab|bortezomib|lenalidomide|daratumumab/, /chimioth[eé]rapie/, /leuc[eé]mie/, /lymphome/, /my[eé]lome/],
    weak: [/h[eé]matolog/, /oncolog/, /maladie\s*du\s*sang/, /an[eé]mie/],
  },
  {
    unit: 'UE-02-PAM',
    strong: [/pharmacognosie/, /chimie\s*th[eé]rapeutique/, /gal[eé]nique/, /birefringence/, /radioactivit[eé]/, /spectrom[eé]trie/, /\brmn\b/, /\buv-visible\b/, /macrolide/, /aminoside/, /p[ée]nicilline/, /c[ée]phalosporine/, /alcalo[ïi]de/, /quinine/, /colchicine/, /galanthamine/, /relation\s*structure\s*activit[ée]/],
    weak: [/principe\s*actif/, /spectro/, /\birm?\b/, /\buv\b/],
  },
  {
    unit: 'UE-03-VEMA',
    strong: [/pharmacocin[ée]tique/, /clairance\s*(r[ée]nale|de\s*la\s*cr[ée]atinine)/, /volume\s*de\s*distribution/, /biodisponibilit[ée]/, /demi[- ]vie/, /\bauc\b|aire\s*sous\s*la\s*courbe/, /toxicolog/, /surdosage/, /cystatine/, /ckd[- ]?epi/, /schwartz/, /ajustement\s*posolog/],
    weak: [/intoxication/, /n[ée]phrotoxicit[ée]/, /h[ée]patotoxicit[ée]/, /\bstp\b/, /suivi\s*th[ée]rapeutique/],
  },
  {
    unit: 'UE-04-PI',
    strong: [/infectiologie/, /antir[ée]troviral/, /\bvih\b/, /\bprep\b/, /dolut[ée]gravir|bict[ée]gravir|tenofovir|emtricitabine/, /m[ée]ningite/, /endocardite/, /tuberculose/, /paludisme/, /antibioth[ée]rapie/],
    weak: [/bact[ée]riolog/, /virolog/, /parasitolog/, /antiviral/, /antibiotique/, /s[ée]psis/],
  },
  {
    unit: 'UE-05-SNC',
    strong: [/[ée]pilepsie/, /parkinson/, /alzheimer/, /scl[ée]rose\s*en\s*plaque/, /antalgique/, /morphine|fentanyl|tramadol/, /gabapentine|pr[ée]gabaline/, /antid[ée]presseur/, /antipsychotique/, /\bpnedi\b/, /synapse/],
    weak: [/\bsnc\b/, /syst[ée]me\s*nerveux/, /neurolog/, /migraine/, /douleur/, /endocrinolog/, /diab[èe]te/, /insuline/, /thyro[ïi]de/, /cortico[ïi]de/],
  },
  {
    unit: 'UE-06-VIGILANCE',
    strong: [/pharmacovigilance/, /mat[ée]riovigilance/, /nutrivigilance/, /h[ée]movigilance/, /\bear\/veg\b/, /plan\s*de\s*gestion\s*des\s*risques/],
    weak: [/vigilance/, /\bmeddra\b/, /signalement/],
  },
  {
    unit: 'UE-07-CV',
    strong: [/anticoagulant/, /antiagr[ée]gant/, /warfarine|acenocoumarol|rivaroxaban|apixaban|dabigatran/, /h[ée]parine|enoxaparine/, /insuffisance\s*cardiaque/, /hypertension\s*art[ée]rielle/],
    weak: [/cardio/, /arythmie/, /\breins?\b/, /n[ée]phrolog/, /cr[ée]atinine/, /\bdfg\b|\bckd\b/, /h[ée]mostase/, /coagulation/],
  },
  {
    unit: 'UE-08-PA',
    strong: [/officine/, /dispensation/, /analyse\s*d['’]ordonnance/, /conduite\s*[àa]\s*tenir/, /\bamm\b|autorisation\s*de\s*mise\s*sur\s*le\s*march[ée]/, /affaires\s*r[ée]glementaires/, /assurance\s*qualit[ée]/, /cycle\s*de\s*vie\s*du\s*m[ée]dicament/, /g[ée]n[ée]rique/, /biosimilaire/],
    weak: [/industrie/, /\bbpf\b|\bbpfa\b|\bgmp\b/, /\bvea\b/, /pharmacie\s*clinique/, /remboursement/],
  },
  {
    unit: 'UE-09-MICROBIO',
    strong: [/chimie\s*inorganique/, /chimie\s*analytique/, /titrim[ée]trie/, /oxydor[ée]duction/, /ch[ée]lation/, /bioinorganique/],
    weak: [/indicateurs?\s*color[ée]s/, /\bph\b/, /oligo[ée]l[ée]ments?/, /qualit[ée]\s*de\s*l['’]eau/],
  },
  {
    unit: 'UE-10-BOTANIQUE',
    strong: [/botanique/, /phytoth[ée]rapie/, /plante\s*m[ée]dicinale/, /aromath[ée]rapie/, /huile\s*essentielle/, /anatomie\s*v[ée]g[ée]tale/],
    weak: [/hom[ée]opathie/, /fleurs?\s*et\s*fruits/],
  },
  {
    unit: 'UE-11-TUBE-DIG',
    strong: [/h[ée]patique|cholestase/, /cirrhose/, /\bmici\b|maladie\s*inflammatoire\s*intestinale/, /rectocolite|crohn/, /h\.?\s*pylori/, /inhibiteur\s*de\s*pompe\s*[àa]\s*protons?/],
    weak: [/digestif/, /gastro/, /ulc[èe]re/, /reflux/, /pancr[ée]as/],
  },
  {
    unit: 'UE-12-SANTE-PUB',
    strong: [/sant[ée]\s*publique/, /[ée]conomie\s*du\s*m[ée]dicament/, /[ée]valuation\s*m[ée]dico[- ][ée]conomique/, /droit\s*pharmaceutique/, /assurance\s*maladie/, /haute\s*autorit[ée]\s*de\s*la\s*sant[ée]|\bhas\b/],
    weak: [/[ée]pid[ée]miologie/, /s[ée]curit[ée]\s*sociale/, /l[ée]gislation/],
  },
];

/** The unit a text speaks about, or null when the text says nothing. */
export function classifyByText(t: string, year: string): Unit | null {
  const ueNum = t.match(/ue[\s\-.]*0?(\d{1,2})(?!\d)/);
  if (ueNum) {
    const num = Number(ueNum[1]);
    const map: Record<string, Record<number, Unit>> = {
      '3A': { 1: 'UE-02-PAM', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-01-OMS', 5: 'UE-05-SNC', 6: 'UE-05-SNC', 7: 'UE-07-CV', 8: 'UE-02-PAM', 9: 'UE-09-MICROBIO', 10: 'UE-09-MICROBIO', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
      '4A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
      '5A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' }
    };
    const mapped = map[year]?.[num];
    if (mapped) return mapped;
  }

  // A short text is not evidence: the title page of a scanned course or a
  // table of contents says nothing about the subject.
  if (t.trim().length < 200) return null;

  let best: Unit | null = null;
  let bestScore = 0;
  for (const { unit, strong, weak } of UNIT_SIGNALS) {
    let score = 0;
    if (strong.some((pattern) => pattern.test(t))) score += 2;
    const weakHits = weak.filter((pattern) => pattern.test(t)).length;
    if (weakHits >= 2) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = unit;
    }
  }
  return bestScore >= 2 ? best : null;
}

/** Classify from the text a file carries, falling back to its name. */
export function classifyByContent(text: string, fileName: string, year: string): Unit | null {
  const fromContent = text.trim() ? classifyByText(text.toLowerCase(), year) : null;
  if (fromContent) return fromContent;
  return classifyByText(fileName.toLowerCase(), year);
}
