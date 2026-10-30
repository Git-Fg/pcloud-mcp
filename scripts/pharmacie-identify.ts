/**
 * Identifies the real format and content of the extensionless pCloud files.
 *
 * A batch of course material was uploaded with the file named after the
 * folder it should have been, and without an extension: "Annales" is a PDF,
 * "Fiches" is a DOCX, "Autres" is a PDF. This script downloads the head of
 * each one, detects the format from the magic bytes, and for PDFs extracts
 * the title so the file can be given a name that says what it is.
 *
 * Usage: bun run scripts/pharmacie-identify.ts [inventory] [outJson]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile as write } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { isExtensionless, isGenericName } from './lib/naming.js';

const exec = promisify(execFile);
/** `word/document.xml` of a slide-heavy deck easily exceeds the 1 MB default. */
const EXEC_OPTS = { maxBuffer: 256 * 1024 * 1024 } as const;

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface Identified {
  fileid: number;
  path: string;
  name: string;
  size: number;
  format: string;
  extension: string;
  title: string;
  pages?: number;
  /** First meaningful line of a plain-text document. */
  head?: string;
  /** Number of entries when the file is an archive. */
  entries?: number;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-3.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-identified.json';
/** Optional third argument: comma-separated formats to keep, e.g. "docx,pptx". */
const onlyFormats = process.argv[4]
  ? new Set(process.argv[4].split(',').map((s) => s.trim()))
  : null;
/** Optional fourth argument: which files to inspect. */
const selection = (process.argv[5] ?? 'extensionless') as 'extensionless' | 'generic';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const client = new PcloudHttpClient();

const files: InvNode[] = [];
function walk(nodes: InvNode[]): void {
  for (const node of nodes) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
}
walk(roots);

const targets =
  selection === 'generic' ? files.filter((f) => isGenericName(f.name)) : files.filter((f) => isExtensionless(f.name));

const MAGIC: Array<[string, string, string]> = [
  ['%PDF', 'pdf', '.pdf'],
  ['PK\x03\x04', 'zip', '.zip'],
  ['\xff\xd8\xff', 'jpeg', '.jpg'],
  ['\x89PNG', 'png', '.png'],
  ['GIF8', 'gif', '.gif'],
  ['ID3', 'mp3', '.mp3'],
  ['OggS', 'ogg', '.ogg'],
  ['\x1a\x45\xdf\xa3', 'matroska', '.mkv'],
  ['{\\rtf', 'rtf', '.rtf'],
  ['\xd0\xcf\x11\xe0', 'ole2', '.doc'],
  ['SQLite format 3', 'sqlite', '.db'],
  ['RIFF', 'riff', '.wav'],
  // Apple iWork bundle: Pages, Numbers and Keynote all start with "Bud1".
  ['\x00\x00\x00\x01Bud1', 'iwork', '.iwork'],
  // SQLite write-ahead-log shared-memory index (native little-endian header).
  ['\x18\xe2\x2d\x00', 'sqlite-shm', '.db-shm'],
];

/** Container formats whose brand sits after a fixed-size box header. */
const OFFSET_BRANDS: Array<[number, string, string, string]> = [
  [4, 'ftyp', 'mp4', '.mp4'],
  [8, 'WEBP', 'webp', '.webp'],
];

/**
 * A file is plain text when it decodes as UTF-8 without replacement
 * characters and carries no control bytes other than tab/newline/return.
 * Decoding (rather than byte-range heuristics) is what keeps accented
 * French and emoji text from being mistaken for binary.
 */
function looksLikeText(bytes: Buffer): boolean {
  if (bytes.length === 0) return false;
  const slice = bytes.subarray(0, Math.min(bytes.length, 8192));
  const decoded = new TextDecoder('utf-8').decode(slice);
  // A multi-byte sequence cut by the slice boundary lands as U+FFFD; drop
  // that one trailing marker before judging the rest.
  const text = decoded.endsWith('\ufffd') ? decoded.slice(0, -1) : decoded;
  if (text.includes('\ufffd')) return false;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/** UTF-16 text carries a byte-order mark at offset 0. */
function looksLikeUtf16(head: Buffer): 'utf16le' | 'utf16be' | null {
  if (head.length < 2) return null;
  if (head[0] === 0xff && head[1] === 0xfe) return 'utf16le';
  if (head[0] === 0xfe && head[1] === 0xff) return 'utf16be';
  return null;
}

/** The first line of a text document that carries actual words. */
function firstMeaningfulLine(text: string): string {
  for (const raw of text.split('\n').slice(0, 40)) {
    const line = raw.trim();
    if (line.length > 8 && /[A-Za-zÀ-ÿ]{4}/.test(line)) return line.slice(0, 120);
  }
  return '';
}

async function signedUrl(fileid: number): Promise<string> {
  const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid });
  const host = link.hosts[0];
  return (host.startsWith('http') ? host : `https://${host}`) + link.path;
}

/** Fetches the first bytes of a file; enough to identify any format. */
async function fetchHead(url: string, bytes = 8192): Promise<Buffer> {
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok && res.status !== 206) throw new Error(`download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function download(fileid: number, dest: string): Promise<void> {
  const res = await fetch(await signedUrl(fileid));
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  await write(dest, Buffer.from(await res.arrayBuffer()));
}

function detectFormat(head: Buffer, name: string): { format: string; extension: string } {
  if (head.length === 0) return { format: 'empty', extension: '.empty' };
  // A .DS_Store starts with the same four bytes as an iWork package.
  if (name === '.DS_Store') return { format: 'dsstore', extension: '.dsstore' };
  for (const [sig, name, ext] of MAGIC) {
    if (head.subarray(0, sig.length).equals(Buffer.from(sig, 'latin1'))) {
      return { format: name, extension: ext };
    }
  }
  for (const [offset, brand, name, ext] of OFFSET_BRANDS) {
    if (head.subarray(offset, offset + brand.length).equals(Buffer.from(brand, 'latin1'))) {
      return { format: name, extension: ext };
    }
  }
  if (looksLikeUtf16(head)) return { format: 'text', extension: '.txt' };
  if (looksLikeText(head)) return { format: 'text', extension: '.txt' };
  return { format: 'unknown', extension: '.bin' };
}

/**
 * A ZIP with an OOXML layout is an Office document that lost its extension:
 * `word/document.xml` marks a Word file, `ppt/presentation.xml` a
 * PowerPoint, `xl/workbook.xml` a spreadsheet.
 */
const OOXML_MARKERS: Array<[string, string, string]> = [
  ['word/document.xml', 'docx', '.docx'],
  ['ppt/presentation.xml', 'pptx', '.pptx'],
  ['xl/workbook.xml', 'xlsx', '.xlsx'],
];

async function inspectZip(dest: string): Promise<{ format: string; extension: string; title: string; entries: number }> {
  const { stdout } = await exec('unzip', ['-Z1', dest]);
  const entries = stdout.split('\n').filter(Boolean);
  for (const [marker, format, extension] of OOXML_MARKERS) {
    if (!entries.includes(marker)) continue;
    return { format, extension, title: await ooxmlTitle(dest, format), entries: entries.length };
  }
  return { format: 'zip', extension: '.zip', title: '', entries: entries.length };
}

/** The document title an Office file carries, falling back to its first text. */
async function ooxmlTitle(dest: string, format: string): Promise<string> {
  try {
    const { stdout } = await exec('unzip', ['-p', dest, 'docProps/core.xml'], EXEC_OPTS);
    const title = stdout.match(/<dc:title>([^<]*)<\/dc:title>/)?.[1]?.trim();
    const cleaned = cleanOfficeTitle(title ?? '');
    if (cleaned) return cleaned;
  } catch {
    // no core properties
  }
  return format === 'pptx' ? await pptxTitle(dest) : await docxTitle(dest);
}

/** The first real paragraph of a Word document is its title. */
async function docxTitle(dest: string): Promise<string> {
  let xml: string;
  try {
    ({ stdout: xml } = await exec('unzip', ['-p', dest, 'word/document.xml'], EXEC_OPTS));
  } catch {
    return '';
  }
  for (const match of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const text = decodeXml(match[0].replace(/<[^>]+>/g, ' ')).trim();
    if (text.split(/\s+/).length < 3) continue;
    return clipText(text, 110);
  }
  return '';
}

/** The first slide's text is a presentation's title. */
async function pptxTitle(dest: string): Promise<string> {
  try {
    const { stdout } = await exec('unzip', ['-p', dest, 'ppt/slides/slide1.xml'], EXEC_OPTS);
    const runs = [...stdout.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    // The title is the first run; the rest of the slide is usually the
    // subtitle and the author list.
    const text = decodeXml(runs.slice(0, runs[0] && runs[0].length < 4 ? 2 : 1).join(' ')).trim();
    if (text.split(/\s+/).length >= 1 && text.length > 2) return clipText(text, 110);
  } catch {
    // no slide
  }
  return '';
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ');
}

/** Clip at a word boundary so a title never ends mid-word. */
function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Office metadata carries template leftovers and Word field codes; neither
 * belongs in a file name.
 */
function cleanOfficeTitle(title: string): string {
  return decodeXml(
    title
      .replace(/TOC\s*\\[a-z]\s*"[^"]*"/gi, ' ')
      .replace(/\\[a-z]\s*"?[0-9-]*"?/g, ' ')
      .replace(/\b(right|left)\s+\d+\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

const work = await mkdtemp(join(tmpdir(), 'pharmacie-identify-'));
const results: Identified[] = [];

for (const [i, file] of targets.entries()) {
  const dest = join(work, `f${i}`);
  try {
    const url = await signedUrl(file.fileid!);
    const head = await fetchHead(url);
    const detected = detectFormat(head, file.name);

    let format = detected.format;
    let extension = detected.extension;
    let title = '';
    let pages: number | undefined;
    let firstLine = '';
    let entries: number | undefined;

    if (format === 'empty') {
      extension = '.empty';
    } else if (format === 'pdf') {
      // pdfinfo and pdftotext need the whole file, trailer included.
      await download(file.fileid!, dest);
      try {
        const { stdout } = await exec('pdfinfo', [dest]);
        const m = stdout.match(/Title:\s*(.+)/);
        if (m && m[1].trim()) title = m[1].trim();
        const p = stdout.match(/Pages:\s*(\d+)/);
        if (p) pages = Number(p[1]);
      } catch {
        // pdfinfo can fail on a malformed PDF; fall back to text extraction.
      }
      if (!title) {
        try {
          const { stdout } = await exec('pdftotext', ['-f', '1', '-l', '1', dest, '-']);
          const line = stdout
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 12 && /[A-Za-zÀ-ÿ]{4}/.test(l));
          if (line) title = line.slice(0, 120).replace(/[:;]\s*$/, '').trim();
        } catch {
          // no text layer
        }
      }
    } else if (format === 'zip') {
      // The archive layout decides whether this is an Office document.
      await download(file.fileid!, dest);
      try {
        const inspected = await inspectZip(dest);
        format = inspected.format;
        extension = inspected.extension;
        title = inspected.title;
        entries = inspected.entries;
      } catch {
        // keep the generic zip classification
      }
    } else if (format === 'text') {
      firstLine = firstMeaningfulLine(head.toString('utf8'));
    }

    if (onlyFormats && !onlyFormats.has(format)) {
      process.stderr.write(`  ${i + 1}/${targets.length} ${file.name} -> ${format} (skipped)\n`);
      continue;
    }

    results.push({
      fileid: file.fileid!,
      path: file.path,
      name: file.name,
      size: file.size ?? 0,
      format,
      extension,
      title,
      pages,
      head: firstLine || undefined,
      entries,
    });
    process.stderr.write(`  ${i + 1}/${targets.length} ${file.name} -> ${format}\n`);
  } catch (err) {
    process.stderr.write(`  ${i + 1}/${targets.length} ${file.name} -> ERROR ${err}\n`);
  }
}

await rm(work, { recursive: true, force: true });

// A filtered pass only covers part of the corpus: merge it into whatever the
// previous pass already identified so the output stays complete.
let merged = results;
if (onlyFormats) {
  try {
    const previous = JSON.parse(await readFile(outJson, 'utf8')) as Identified[];
    const byId = new Map(previous.map((p) => [p.fileid, p]));
    for (const item of results) byId.set(item.fileid, item);
    merged = [...byId.values()];
  } catch {
    // no previous pass to merge with
  }
}

await writeFile(outJson, JSON.stringify(merged, null, 1));
process.stderr.write(`Wrote ${outJson}: ${merged.length} identified\n`);
