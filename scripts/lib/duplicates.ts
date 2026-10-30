/**
 * Chooses which copy of an identical file survives.
 *
 * pCloud keeps the trash, so deleting a redundant copy is reversible; still,
 * the copy that stays must be the one a reader looks for, not the one that
 * happens to sit in the oldest folder. The scoring below names the places
 * where a copy is a poor keeper and the places where it is a good one.
 */

export interface DuplicateMember {
  fileid: number;
  path: string;
  name: string;
  size: number;
}

/** Folders that hold a mirror of the corpus rather than the corpus itself. */
const MIRROR = /SAV\s*-\s*Serveur/i;

/** Folders that hold projects and tooling, not teaching material. */
const TECHNICAL = /^\/Pharmacie\/(_PROJETS|_OUTILS)\//;

/** The upload noise a drive export leaves behind. */
const UPLOAD_NOISE = /(?:^|\/)(?:copie\s*\d+|Drive(?:\s*\d+)?\s*-\s*Google Drive|Drive Comp[^/]*)\//i;

/**
 * How good a place a copy sits. The lowest score survives.
 *
 * The order of the penalties matters more than their size: a copy inside a
 * server mirror is never the keeper, whatever else it looks like.
 */
export function keeperScore(member: DuplicateMember): number {
  let score = 0;

  if (MIRROR.test(member.path)) score += 100;
  if (TECHNICAL.test(member.path)) score += 40;
  if (/ \(\d+\)\.[^.]+$/.test(member.name)) score += 20;
  if (UPLOAD_NOISE.test(member.path)) score += 10;

  // A path that names the semester says more about where the material
  // belongs than one that names only the year.
  if (/^\/Pharmacie\/(3A|4A|5A)\/(S1|S2)\//.test(member.path)) score += 0;
  else if (/^\/Pharmacie\/(3A|4A|5A)\/UE-[0-9]{2}-/.test(member.path)) score += 5;
  else if (/^\/Pharmacie\/(3A|4A|5A)\//.test(member.path)) score += 8;

  // A deeper path sits closer to the material it holds.
  score += Math.min(member.path.split('/').length, 12) / 100;

  return score;
}

/** The copy that stays, and the copies that go. */
export function pickKeeper(members: DuplicateMember[]): { keeper: DuplicateMember; redundant: DuplicateMember[] } {
  const sorted = [...members].sort(
    (a, b) => keeperScore(a) - keeperScore(b) || a.path.length - b.path.length || a.path.localeCompare(b.path)
  );
  const [keeper, ...redundant] = sorted;
  return { keeper, redundant };
}
