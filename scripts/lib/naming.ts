/**
 * Naming rules shared by the Pharmacie cleanup scripts.
 *
 * The pCloud tree went through several upload paths, so the same kind of
 * material carries different kinds of placeholder names: an index ("1.pdf"),
 * a content hash ("08078a88….png"), or nothing at all (no extension).
 */

/** A file name that says nothing about what the file holds. */
export function isGenericName(name: string): boolean {
  const stem = name.replace(/\.[^.]+$/, '');
  if (/^\d+$/.test(stem)) return true;
  if (/^[_\-.\s]+$/.test(stem)) return true;
  if (!/[A-Za-z]/.test(stem)) return true;
  if (stem.length <= 2) return true;
  if (/^[0-9a-f]{8,}$/i.test(stem)) return true;
  if (/^\d{4}[-_]?\d{2}[-_]?\d{2}$/.test(stem)) return true;
  return false;
}

/** A file that was uploaded without any extension. */
export function isExtensionless(name: string): boolean {
  return !name.includes('.');
}

/** Folders whose name says what kind of material they hold. */
export const DOC_TYPES = [
  'Annales',
  'Cours',
  'ED',
  'Fiches',
  'Autres',
  'Roneos',
  'Images',
  'Projets',
  'Transcriptions',
  'Videos',
  'TD',
  'Supports',
];

/**
 * A label for the folder a file lives in, used when the file itself carries
 * no title: the deepest meaningful ancestor, cleaned of the tool noise the
 * Drive exports left behind.
 */
export function folderLabel(segments: string[]): string {
  const meaningful = segments
    .filter((segment) => segment && segment !== 'Pharmacie')
    .filter((segment) => !/^(3A|4A|5A|S1|S2)$/.test(segment))
    .filter((segment) => !/^Drive( \d+)? - Google Drive$/.test(segment))
    .filter((segment) => !/^DFASP\d - \d+eme annee$/.test(segment))
    .filter((segment) => !/^DFGSP\d - \d+eme annee$/.test(segment))
    .map((segment) =>
      segment
        .replace(/^DFASP\d\s*-\s*\d+eme annee$/i, '')
        .replace(/^DFGSP\d\s*-\s*\d+eme annee$/i, '')
        .replace(/^Drive( \d+)? - Google Drive$/i, 'Drive')
        .replace(/^copie \d+$/i, '')
        .trim()
    )
    .filter(Boolean);
  return meaningful[meaningful.length - 1] ?? '';
}

/**
 * The kind of material a folder of photographs or media holds, taken from
 * its own name.
 */
export function mediaKind(segments: string[]): string {
  const label = folderLabel(segments).toLowerCase();
  if (label.includes('photo examen')) return 'Photo d’examen';
  if (label.includes('compte rendu') || label.startsWith('cr ')) return 'Compte rendu de TP';
  if (label.includes('interro')) return 'Interrogation';
  if (label.includes('parc floral')) return 'Sortie au parc floral';
  if (label.includes('media')) return 'Illustration';
  return 'Photo';
}

/**
 * Titles that name the format or the tool rather than the content. A file
 * called "FACULTÉ" says nothing about the 21 pages behind it.
 */
export const TITLE_NOISE: RegExp[] = [
  /^FACULT[ÉE]$/i,
  /^Documents? scann[ée]s$/i,
  /^SKM_/i,
  /^\d+e Ann[ée]e de Pharmacie$/i,
  /^Documents?$/i,
  /^FICHES?$/i,
  /^Photocop/i,
  /^Slide \d+$/i,
  /^T[ée]moin$/i,
  /^Subject:?$/i,
  /^PowerPoint Presentation$/i,
  /^Pr[ée]sentation PowerPoint$/i,
  /^HTMLTITLE$/i,
  /^Microsoft /i,
  /^Titre\b/i,
  /^D[ée]but\b/i,
];

/** Typographic ligatures that survive PDF and Word extraction. */
export function normalizeLigatures(text: string): string {
  return text
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl');
}

/** Lowercase titles read like sentences; a file name starts with a capital. */
export function capitalize(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

export function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
    .replace(/[-–—.,:;]+$/, '')
    .trim();
}

/** Keeps a name short and cut at a word boundary. */
export function clip(text: string, max = 110): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Builds a file name, keeping the extension when the title has to be cut.
 * The cut lands on a word boundary so the name never ends mid-word.
 */
export function fileName(base: string, extension: string, max = 110): string {
  const stem = clip(base, Math.max(max - extension.length, 20));
  return sanitize(`${stem}${extension}`);
}

/**
 * Strips the artefacts office metadata and word processors leave in a
 * document title: the application prefix, field codes, template leftovers
 * and the duplicated extension a DOCX-to-PDF conversion produces.
 */
export function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^Microsoft (Word|PowerPoint|Excel)\s*-\s*/i, '');
  t = t.replace(/\[Mode de compatibilit[ée]\]/gi, ' ');
  t = t.replace(/TOC\s*\\[a-z]\s*"[^"]*"/gi, ' ');
  t = t.replace(/\\[a-z]\b/g, ' ');
  t = t.replace(/\b(right|left)\s+\d+\b/gi, ' ');
  t = t.replace(/\bPAGEREF\b|\bREF\b|\bHYPERLINK\b/gi, ' ');
  t = t.replace(/\.(docx?|pdf|pptx?|odt|odp|rtf|txt)$/i, '');
  t = t.replace(/(docx|doc|pdf|pptx|ppt|odt)$/i, '');
  t = normalizeLigatures(t);
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s"'«»‹›#*•·◦‣_-]+/, '');
  t = t.replace(/[\s‹›#•·◦‣]+$/, '');
  // A title that ends on a separator was cut mid-thought: not a title.
  t = t.replace(/\s*[-–—]\s*$/, '');
  t = t.replace(/[.,:;]\s*$/, '');
  // A colon followed by a stub is a lead-in whose example never made it in.
  t = t.replace(/:\s*\S{1,3}$/, '');
  return t.trim();
}

/**
 * A title is worth keeping only when it names the document. A sentence
 * lifted from the first page does not, however informative it reads.
 */
export function isInformative(title: string, docType = ''): boolean {
  if (title.length < 3 || title.length > 85) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(title)) return false;
  if (TITLE_NOISE.some((noise) => noise.test(title))) return false;
  if (/\.\s+\S/.test(title)) return false;
  if (/[.,:;]\s*$/.test(title)) return false;
  if (docType && title.toLowerCase() === docType.toLowerCase()) return false;
  return true;
}

/** Removes a leading UE marker that repeats the folder the file sits in. */
export function dropRedundantUePrefix(title: string): string {
  const stripped = title
    .replace(/^DFASP\d\s*[–-]\s*/i, '')
    .replace(/^UE\s*\d+(?:\.\d+)*\s*[:.–-]?\s*/i, '')
    .trim();
  return stripped.length >= 3 ? stripped : title;
}

/**
 * A name that does not collide with what the folder already holds.
 *
 * pCloud replaces the file that sits under the target name, so a move that
 * reuses a name silently destroys what was there. The suffix follows the
 * convention the drive exports already left in the corpus.
 */
export function freeName(taken: ReadonlySet<string>, wanted: string): string {
  if (!taken.has(wanted)) return wanted;
  const dot = wanted.lastIndexOf('.');
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
  const extension = dot > 0 ? wanted.slice(dot) : '';
  let counter = 2;
  let candidate = `${stem} (${counter})${extension}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})${extension}`;
  }
  return candidate;
}
