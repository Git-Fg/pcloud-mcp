/**
 * Inspects ambiguous files by downloading + reading their content,
 * then classifies them into the canonical UE tree.
 *
 * Focuses on the "UE-XX-NON-CLASSE", "Fiche Mel", "Fiche Claudie",
 * "Mes Fiches Complètes", "Rattrapages", "Fiches ultra condensées" folders.
 *
 * Usage: bun run scripts/pharmacie-inspect-and-classify.ts [inventory] [out] [maxFiles]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '/Users/felix/Documents/pcloud_mcp/src/core/http/pcloudClient.js';
import { detectYear, detectSemester, detectDocType, type Unit } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/classify.js';
import { classifyByText } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/contentClassify.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  children?: InvNode[];
}

interface MoveOp {
  kind: 'file';
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  reason: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-13.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-inspect-plan.json';
const maxFiles = Number(process.argv[4] ?? 100);

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirs: InvNode[] = []; const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) { dirs.push(node); walk(node.children ?? []); }
    else files.push(node);
  }
})(roots);

const allIds = new Map<string, number>();
for (const dir of dirs) allIds.set(dir.path, dir.folderid!);

/** Extract text from a Word document by reading its XML part. */
async function extractDocxText(fileid: number): Promise<string> {
  const client = new PcloudHttpClient();
  try {
    const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', { fileid, forcedownload: true, maxspeed: 5000000 });
    const link = `https://${linkRes.hosts[0]}${linkRes.path}`;
    const res = await fetch(link);
    const buf = await res.arrayBuffer();
    const tmp = `/tmp/pcloud-${fileid}.docx`;
    await writeFile(tmp, new Uint8Array(buf));
    const proc = Bun.spawn(['unzip', '-p', tmp, 'word/document.xml'], { stdout: 'pipe', stderr: 'ignore' });
    const xml = await new Response(proc.stdout).text();
    try { await Bun.file(tmp).delete(); } catch {}
    // Paragraphs become line breaks, the markup is dropped.
    const text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab[^>]*\/>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    return text.slice(0, 8000);
  } catch {
    return '';
  }
}

/** Extract plain text from a file, whatever its format. */
async function extractText(file: InvNode): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file.fileid!);
  if (name.endsWith('.docx') || name.endsWith('.doc')) return extractDocxText(file.fileid!);
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json')) {
    const client = new PcloudHttpClient();
    try {
      const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', { fileid: file.fileid!, forcedownload: true, maxspeed: 5000000 });
      const link = `https://${linkRes.hosts[0]}${linkRes.path}`;
      const res = await fetch(link);
      return (await res.text()).slice(0, 8000);
    } catch {
      return '';
    }
  }
  return '';
}

/** Extract text from a PDF (first 3 pages) using pdftotext. */
async function extractPdfText(fileid: number): Promise<string> {
  const client = new PcloudHttpClient();
  try {
    const linkRes = await client.json<{ link?: string; path: string; hosts: string[] }>('getfilelink', { fileid, forcedownload: true, maxspeed: 5000000 });
    const link = `https://${linkRes.hosts[0]}${linkRes.path}`;
    const res = await fetch(link);
    const buf = await res.arrayBuffer();
    const tmp = `/tmp/pcloud-${fileid}.pdf`;
    await writeFile(tmp, new Uint8Array(buf));
    const proc = Bun.spawn(['pdftotext', '-l', '3', '-q', tmp, '-'], { stdout: 'pipe', stderr: 'ignore' });
    const text = await new Response(proc.stdout).text();
    try { await Bun.file(tmp).delete(); } catch {}
    return text.slice(0, 8000);
  } catch {
    return '';
  }
}

/** Classify by content keywords, falling back to the file name. */
function classifyByContent(text: string, fileName: string, year: string): Unit | null {
  const fromContent = text.trim() ? classifyByText(text.toLowerCase(), year) : null;
  if (fromContent) return fromContent;
  return classifyByText(fileName.toLowerCase(), year);
}

const moves: MoveOp[] = [];
const foldersToCreate = new Map<string, { path: string; name: string; parentPath: string; parentid: number }>();

function ensureFolder(targetPath: string): number | null {
  const known = allIds.get(targetPath);
  if (known !== undefined) return known;
  const parentPath = targetPath.replace(/\/[^/]+$/, '');
  if (!parentPath) return null;
  const parentId = ensureFolder(parentPath);
  if (parentId === null) return null;
  if (!foldersToCreate.has(targetPath)) {
    foldersToCreate.set(targetPath, { path: targetPath, name: targetPath.slice(parentPath.length + 1), parentPath, parentid: parentId });
  }
  return 0;
}

function freeName(targetPath: string, wanted: string): string {
  return wanted;
}

async function processFile(file: InvNode): Promise<void> {
  const year = detectYear(file.path) ?? '4A';
  const semester = detectSemester(file.path);
  const base = `/Pharmacie/${year}${semester ? `/${semester}` : ''}`;

  const text = await extractText(file);
  const unit = classifyByContent(text, file.name, year);
  if (!unit) return;

  const docType = detectDocType(file.name) ?? 'Cours';
  const target = `${base}/${unit}/${docType}`;
  const targetId = ensureFolder(target);
  if (targetId === null) return;

  moves.push({
    kind: 'file',
    id: file.fileid!,
    from: file.path,
    toPath: target,
    toFolderid: targetId,
    toname: freeName(target, file.name),
    reason: `${unit}/${docType} from ${file.path} (content: ${text.slice(0,80)}...)`,
  });
}

let processed = 0;
const CANONICAL_UNIT = /^\/Pharmacie\/(3A|4A|5A)(\/(S1|S2))?\/UE-[0-9]{2}-[A-Z-]+/;
const CANONICAL_CSP = /^\/Pharmacie\/(3A|4A|5A)\/CSP\//;

// Every file still outside the canonical tree, except the technical
// material that belongs to no teaching unit at all.
const candidates = files.filter((f) => {
  if (CANONICAL_UNIT.test(f.path) || CANONICAL_CSP.test(f.path)) return false;
  if (f.path.startsWith('/Pharmacie/_PROJETS') || f.path.startsWith('/Pharmacie/_OUTILS')) return false;
  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
  return ['.pdf', '.docx', '.txt', '.md', '.csv'].includes(ext);
});

for (const file of candidates) {
  if (processed >= maxFiles) break;
  await processFile(file);
  processed++;
}

console.log(`Processed ${processed} files, ${moves.length} classified`);
await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()] }, null, 1));
console.log(`Written ${outJson}`);