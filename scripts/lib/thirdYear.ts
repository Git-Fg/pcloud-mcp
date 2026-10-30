/**
 * Which unit of the third-year programme a document belongs to.
 *
 * Some folders of the third year hold more than one unit of the
 * programme: the folder on blood diseases and immune disorders holds the
 * immunology of the first semester and the haematology of the second. The
 * name of the document says which, often; when it does not, the subject of
 * the document says it.
 *
 * These rules read the subject and name the programme unit. The unit then
 * gives both the semester and the teaching unit the document belongs to.
 *
 * The subject of each unit follows the programme, so the rules stay
 * readable: a text that talks about a receptor belongs to the physiology
 * unit, a text that talks about a culture belongs to the microbiology one.
 */

interface ProgrammeUnit {
  number: number;
  strong: RegExp[];
  weak: RegExp[];
}

const PROGRAMME_UNITS: ProgrammeUnit[] = [
  {
    number: 1,
    strong: [/physiologie/, /pharmacologie/, /neurotransmetteur/, /r[ée]cepteur/, /synapse/, /ac[ée]tylcholine/, /dopamine/, /s[ée]rotonine/, /\bgaba\b/, /glutamate/, /noradr[ée]naline/, /adr[ée]nergique/, /hormone/, /insulin[ée]/],
    weak: [/membrane/, /potentiel/, /transport/, /\bion\b/, /enzyme/],
  },
  {
    number: 2,
    strong: [/gal[ée]nique/, /physicochim/, /chromatograph/, /chimie analytique/, /spectrom[ée]trie/, /birefringence/, /dosage/, /titrim[ée]trie/, /granul/, /compression/, /b[ée]tonage/, /formulation/],
    weak: [/excipient/, /dissolution/, /stability|stabilit[ée]/, /lib[ée]ration/],
  },
  {
    number: 3,
    strong: [/pharmacocin[ée]tique/, /toxicolog/, /clairance/, /volume de distribution/, /demi[- ]vie/, /biodisponibilit/, /intoxication/, /surdosage/, /antidote/, /macromyc[èe]te/, /pharmacom[ée]tr/, /dosage plasmatique/],
    weak: [/absorption/, /m[ée]tabolisme/, /excr[ée]tion/, /interaction/],
  },
  {
    number: 4,
    strong: [/immunopatholog/, /immunolog/, /immunit[ée]/, /auto[- ]?immun/, /immunoth[ée]rap/, /bioth[ée]rap/, /gammapathie/, /immunod[ée]ficien/, /lymphocyte/, /cytokine/, /greffe de cellules souches/],
    weak: [/antig[èe]ne/, /anticorps/, /inflammation/],
  },
  {
    number: 5,
    strong: [/diab[èe]te/, /ob[ée]sit[ée]/, /antidiab[ée]tique/, /m[ée]tabolisme/, /endocrinopath/, /glyc[ée]mie/, /insulinor[ée]sistance/],
    weak: [/hormone/, /pancr[ée]as/, /poids/],
  },
  {
    number: 7,
    strong: [/cardiovasculaire/, /ath[ée]rome/, /insuffisance cardiaque/, /hypertension/, /anticoagulant/, /antiagr[ée]gant/, /h[ée]mostase/, /thrombose/, /h[ée]matolog/, /an[ée]mie/, /leuc[ée]mie/, /lymphome/, /my[ée]lome/, /insuffisance r[ée]nale/, /cystatine/, /\bdfg\b/, /n[ée]phro/, /h[ée]modialyse/],
    weak: [/coagulation/, /pression art[ée]rielle/, /rein/, /sang/],
  },
  {
    number: 8,
    strong: [/pharmacognosie/, /chimie th[ée]rapeutique/, /principe actif/, /alcalo[ïi]de/, /macrolide/, /aminoside/, /quinine/, /colchicine/, /relation structure activit[ée]/, /m[ée]dicament naturel/],
    weak: [/mol[ée]cule/, /m[ée]canisme d'action/, /posolog/],
  },
  {
    number: 9,
    strong: [/bact[ée]riolog/, /virolog/, /microbiolog/, /antibact[ée]rien/, /antiviral/, /h[ée]moculture/, /antibiotique/, /antiseps/, /staphyloco/, /pseudomonas/, /listeria/, /ent[ée]robact[ée]rie/],
    weak: [/bact[ée]rie/, /\bvirus\b/, /\bsouche\b/, /\bantibioth[ée]rapie\b/],
  },
  {
    number: 10,
    strong: [/parasitolog/, /fongique/, /mycos/, /leishmani/, /amibiase/, /paludisme/, /helminth/, /\bascaris\b/, /\btrichine\b/],
    weak: [/parasite/, /champignon/, /spore/],
  },
  {
    number: 11,
    strong: [/digestif/, /h[ée]patite/, /h[ée]patolog/, /cholestase/, /\bmici\b/, /maladie inflammatoire intestinale/, /crohn/, /rectocolite/, /ulc[èe]re/, /reflux/, /pancr[ée]as/, /intestin/],
    weak: [/foie/, /\bbile\b/, /\babsorption intestinale\b/, /\bmicrobiote\b/],
  },
  {
    number: 12,
    strong: [/sant[ée] publique/, /[ée]pid[ée]miolog/, /assurance maladie/, /droit pharmaceutique/, /[ée]conomie du m[ée]dicament/, /m[ée]decine du travail/],
    weak: [/s[ée]curit[ée] sociale/, /l[ée]gislation/, /co[ûu]t/],
  },
];

/**
 * The programme unit a text speaks about, or null when it says nothing.
 *
 * A strong signal is a word only that unit uses; a weak signal is a common
 * word that many texts carry, so two of them are needed before the unit is
 * certain. Every signal is bounded by word boundaries, so a fragment of a
 * common word never matches.
 */
export function thirdYearUnitFromText(text: string): number | null {
  const haystack = text.toLowerCase();
  if (haystack.trim().length < 200) return null;

  let best: number | null = null;
  let bestScore = 0;
  for (const unit of PROGRAMME_UNITS) {
    let score = 0;
    if (unit.strong.some((pattern) => pattern.test(haystack))) score += 2;
    const weakHits = unit.weak.filter((pattern) => pattern.test(haystack)).length;
    if (weakHits >= 2) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = unit.number;
    }
  }
  return bestScore >= 2 ? best : null;
}
