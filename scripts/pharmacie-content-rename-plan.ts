/**
 * Builds the rename-and-move plan for the extensionless pCloud files.
 *
 * These files carry the name of the folder they belong to and no extension:
 * "Annales" is a 21-page PDF of past papers and "Fiches" is a 30-page PDF of
 * summary sheets. The identification pass (scripts/pharmacie-identify.ts)
 * supplies the real format and, where the format carries one, the title.
 *
 * The target name is `<context> - <doc type> - <title>.<ext>`, where the
 * context is the nearest UE or CSP folder. The target folder is that UE's
 * canonical doc-type folder, so a file named "Annales" ends up inside the
 * "Annales" folder instead of next to it.
 *
 * Usage: bun run scripts/pharmacie-content-rename-plan.ts [identified] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';

interface Identified {
  fileid: number;
  path: string;
  name: string;
  size: number;
  format: string;
  extension: string;
  title: string;
  pages?: number;
  head?: string;
  entries?: number;
}

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface RenameOp {
  fileid: number;
  toname: string;
  tofolderid?: number;
  /** Destination folder path, resolved to an id once missing folders exist. */
  targetPath?: string;
  reason: string;
  oldname: string;
  path: string;
}

interface Plan {
  ops: RenameOp[];
  foldersToCreate: Array<{ parentid: number; name: string; path: string }>;
}

/** Folders whose name says what kind of material they hold. */
const DOC_TYPES = [
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
 * Titles that name the format or the tool rather than the content. A file
 * called "FACULTÉ" says nothing about the 21 pages behind it.
 */
const TITLE_NOISE: RegExp[] = [
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

/** Formats whose name needs a qualifier to be understandable. */
const FORMAT_QUALIFIER: Record<string, string> = {
  iwork: 'document iWork',
  empty: 'fichier vide',
  jpeg: 'photo JPEG',
  png: 'capture d’écran PNG',
  riff: 'audio WAV',
  ole2: 'document Word',
  sqlite: 'base de données SQLite',
  zip: 'archive',
};

/** Text documents that carry no usable title get a descriptive fallback. */
const TEXT_FALLBACK: Record<string, string> = {
  Transcriptions: 'notes de cours',
  Videos: 'notes de cours',
  ED: 'corrigé',
  Annales: 'corrigé',
  Fiches: 'synthèse',
  Cours: 'support de cours',
  Autres: 'divers',
};

const identifiedPath = process.argv[2] ?? '/tmp/pharmacie-identified.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-content-plan.json';
const inventoryPath = process.argv[4] ?? '/tmp/pharmacie-inventory-3.json';

const identified = JSON.parse(await readFile(identifiedPath, 'utf8')) as Identified[];
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

/** Folder id of every folder in the inventory, keyed by its full path. */
const folderIdByPath = new Map<string, number>();
(function walk(nodes: InvNode[]): void {
  for (const node of nodes) {
    if (!node.isfolder) continue;
    folderIdByPath.set(node.path, node.folderid!);
    walk(node.children ?? []);
  }
})(inventory);

/** The UE or CSP folder a path belongs to, if any. */
function contextFolder(segments: string[]): string | null {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (/^(UE-|CSP-)/.test(segment)) return segment;
  }
  return null;
}

/** The year and semester a path sits in, e.g. "4A-S1". */
function yearContext(segments: string[]): string | null {
  const year = segments.find((s) => /^\dA$/.test(s));
  if (!year) return null;
  const semester = segments.find((s) => /^S[12]$/.test(s));
  return semester ? `${year}-${semester}` : year;
}

/** The kind of material a file holds, taken from its own name or its folder. */
function docTypeFor(name: string, parent: string): string {
  if (DOC_TYPES.includes(name)) return name;
  if (DOC_TYPES.includes(parent)) return parent;
  return 'Autres';
}

/** Lowercase titles read like sentences; a file name starts with a capital. */
function capitalize(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

/** Typographic ligatures that survived the PDF and Word extraction. */
function normalizeLigatures(text: string): string {
  return text
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl');
}

function stripLeadingMarkers(text: string): string {
  return text
    .replace(/^[\s"'«»‹›#*•·◦‣_-]+/, '')
    .replace(/[\s‹›#•·◦‣]+$/, '')
    .trim();
}

/**
 * Strips the artefacts that office metadata and word processors leave in a
 * document title: the application prefix, field codes, template leftovers and
 * the duplicated extension that a DOCX-to-PDF conversion produces.
 */
function cleanTitle(raw: string): string {
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
  t = stripLeadingMarkers(t);
  // A title that ends on a separator was cut mid-thought: not a title.
  t = t.replace(/\s*[-–—]\s*$/, '');
  t = t.replace(/[.,:;]\s*$/, '');
  return t;
}

/**
 * A title is worth keeping only when it names the document. A sentence lifted
 * from the first page does not, however informative it reads.
 */
function isInformative(title: string, docType: string): boolean {
  if (title.length < 3 || title.length > 85) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(title)) return false;
  if (TITLE_NOISE.some((noise) => noise.test(title))) return false;
  // A sentence boundary means the extraction ran into the body text.
  if (/\.\s+\S/.test(title)) return false;
  if (title.toLowerCase() === docType.toLowerCase()) return false;
  return true;
}

/** Removes a leading UE marker that repeats the folder the file sits in. */
function dropRedundantUePrefix(title: string): string {
  const stripped = title
    .replace(/^DFASP\d\s*[–-]\s*/i, '')
    .replace(/^UE\s*\d+(?:\.\d+)*\s*[:.–-]?\s*/i, '')
    .trim();
  return stripped.length >= 3 ? stripped : title;
}

/** The title of a text file, when its first line actually names it. */
function textTitle(item: Identified): string {
  const head = (item.head ?? '').trim();
  if (!head) return '';
  const markdown = head.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  const discourse = /^(voil[àa]|donc|ok\b|bon\b|pour la question|l'objectif|on va|il faut|alors\b)/i;
  if (/^[#*]/.test(head) || (!discourse.test(head) && /^[A-ZÀ-Þ]/.test(head))) {
    return normalizeLigatures(markdown).replace(/\s+/g, ' ').trim();
  }
  return '';
}

/**
 * The descriptive part of the name: the document's own title when it has
 * one, otherwise a qualifier naming what the file actually is.
 */
function descriptorFor(item: Identified, docType: string): string {
  if (item.format === 'text') {
    const title = textTitle(item);
    if (title && isInformative(title, docType)) return title;
    return TEXT_FALLBACK[docType] ?? 'notes';
  }
  if (item.format === 'sqlite') return FORMAT_QUALIFIER.sqlite;
  const qualifier = FORMAT_QUALIFIER[item.format];
  if (qualifier) return qualifier;
  const title = cleanTitle(item.title);
  if (isInformative(title, docType)) return dropRedundantUePrefix(title);
  return '';
}

function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

/** Keeps a name short and cut at a word boundary. */
function clip(text: string, max = 110): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Files that are storage artefacts rather than course material. */
function isJunk(item: Identified): boolean {
  if (item.path.includes('/.git/')) return true;
  if (item.name === 'db-shm') return true;
  // A name with no letter or digit in it is mojibake, not a label.
  if (!/[A-Za-z0-9]/.test(item.name)) return true;
  // Inside an exploded iWork bundle the file names are part names.
  if (item.path.includes('.pages/')) return true;
  return false;
}

const ops: RenameOp[] = [];
const foldersToCreate: Array<{ parentid: number; name: string; path: string }> = [];
const skipped: Array<{ path: string; reason: string }> = [];
/** Names already taken in a destination folder, so two files never collide. */
const used = new Map<string, Set<string>>();
/** Folders already scheduled for creation, so none is created twice. */
const scheduled = new Set<string>();

for (const item of identified) {
  if (isJunk(item)) {
    skipped.push({ path: item.path, reason: 'junk' });
    continue;
  }

  const segments = item.path.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1];
  const parentPath = '/' + segments.slice(0, -1).join('/');
  const parent = segments[segments.length - 2] ?? '';
  const context = contextFolder(segments);
  const docType = docTypeFor(fileName, parent);
  const descriptor = descriptorFor(item, docType);

  const parts = [context ?? yearContext(segments) ?? '', docType];
  if (descriptor) parts.push(capitalize(descriptor));
  const base = parts.filter(Boolean).join(' - ');

  const extension = item.format === 'empty' ? '.txt' : item.extension;
  let toname = sanitize(clip(`${base}${extension}`));

  // Two files can share a title; the second one gets a numbered suffix.
  const bucketKey = `${parentPath}::${docType}`;
  const bucket = used.get(bucketKey) ?? new Set<string>();
  if (bucket.has(toname)) {
    const stem = toname.slice(0, toname.length - extension.length);
    let n = 2;
    while (bucket.has(`${stem} (${n})${extension}`)) n += 1;
    toname = sanitize(`${stem} (${n})${extension}`);
  }
  bucket.add(toname);
  used.set(bucketKey, bucket);

  // A file named after a doc type belongs inside that doc type's folder; a
  // file that already sits in one stays where it is.
  const op: RenameOp = {
    fileid: item.fileid,
    toname,
    reason: item.format,
    oldname: fileName,
    path: item.path,
  };
  if (context && DOC_TYPES.includes(fileName)) {
    const targetPath = `${parentPath}/${docType}`;
    op.targetPath = targetPath;
    const targetId = folderIdByPath.get(targetPath);
    if (targetId !== undefined) {
      op.tofolderid = targetId;
    } else {
      const parentId = folderIdByPath.get(parentPath);
      if (parentId !== undefined && !scheduled.has(targetPath)) {
        foldersToCreate.push({ parentid: parentId, name: docType, path: targetPath });
        scheduled.add(targetPath);
      }
    }
  }

  ops.push(op);
}

const plan: Plan = { ops, foldersToCreate };
await writeFile(outJson, JSON.stringify(plan, null, 1));
process.stderr.write(`Wrote ${outJson}: ${ops.length} operation(s), ${foldersToCreate.length} folder(s) to create\n`);

const byReason = new Map<string, number>();
for (const op of ops) byReason.set(op.reason, (byReason.get(op.reason) ?? 0) + 1);
for (const [reason, count] of [...byReason.entries()].sort()) {
  process.stderr.write(`  ${reason}: ${count}\n`);
}
if (skipped.length) {
  process.stderr.write(`  skipped (junk): ${skipped.length}\n`);
  for (const s of skipped) process.stderr.write(`    ${s.path}\n`);
}
