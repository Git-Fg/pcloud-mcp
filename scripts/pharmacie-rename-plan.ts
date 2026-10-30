/**
 * Builds a rename plan for the pCloud Pharmacie tree.
 *
 * The plan is data, not action: it reads the inventory produced by
 * scripts/pharmacie-inventory.ts and emits a list of renamefile operations
 * with a `reason` per entry, so the operator can review before applying.
 *
 * Usage: bun run scripts/pharmacie-rename-plan.ts [inventory] [planOut]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { repairMojibake } from './lib/cp437.js';

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
  reason: string;
  oldname: string;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory.json';
const planOut = process.argv[3] ?? '/tmp/pharmacie-rename-plan.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

/**
 * Folder names that describe a file format or a tool, never the content.
 * The key is the exact legacy spelling; the value is the readable name.
 */
const FORMAT_ONLY = new Map<string, string>([
  ['md files', 'Markdown'],
  ['md file', 'Markdown'],
  ['md filea', 'Markdown'],
  ['md', 'Markdown'],
  ['txt files', 'Transcription TXT'],
  ['txt', 'Transcription TXT'],
  ['word', 'Word DOCX'],
  ['words', 'Word DOCX'],
  ['docx', 'Word DOCX'],
  ['pdf', 'PDF'],
  ['old', 'Anciennes versions'],
  ['old_old', 'Anciennes versions'],
  ['old save', 'Anciennes versions'],
  ['_old', 'Anciennes versions'],
]);

/** Acronyms that are opaque without expansion. */
const ACRONYMS = new Map<string, string>([
  ['PIR', 'PIR - Parcours Initiation Recherche'],
  ['PIR ', 'PIR - Parcours Initiation Recherche'],
  ['SAV', 'SAV - Serveur Applications Virtuelles'],
  ['Drive', 'Drive - Google Drive'],
  ['Drive #3', 'Drive - Google Drive'],
  ['Drive #6', 'Drive - Google Drive'],
  ['Drive1', 'Drive - Google Drive'],
  ['Drive2', 'Drive - Google Drive'],
  ['Drive3', 'Drive - Google Drive'],
  ['DFASP1', 'DFASP1 - 4eme annee'],
  ['DFGSP3', 'DFGSP3 - 3eme annee'],
  ['Doc Whatsapp', 'Documents WhatsApp'],
  ['sujet - 2024', 'Sujets ED 2024'],
  ['transcription', 'Transcriptions'],
]);

/**
 * The mojibake: UTF-8 bytes were decoded through CP437, so "é" (0xC3 0xA9)
 * became "├©". The transformation is reversible; see scripts/lib/cp437.ts.
 */
function unmojibake(input: string): string | null {
  return repairMojibake(input);
}

/** Collapse runs of whitespace and trim the ends. */
function tidy(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Strip characters pCloud rejects in a name. */
function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

const ops: RenameOp[] = [];
const seen = new Set<number>();

function propose(node: InvNode, newname: string, reason: string): void {
  if (!node.fileid || node.fileid <= 0) return;
  if (seen.has(node.fileid)) return;
  seen.add(node.fileid);
  ops.push({
    fileid: node.fileid,
    toname: sanitize(newname),
    reason,
    oldname: node.name,
  });
}

function walk(nodes: InvNode[]): void {
  for (const node of nodes) {
    const original = node.name;
    const repaired = unmojibake(original);

    if (repaired !== null && repaired !== original) {
      propose(node, tidy(repaired), 'mojibake-fix');
    } else {
      const tidied = tidy(original);
      if (tidied !== original) {
        propose(node, tidied, 'whitespace-fix');
      } else if (FORMAT_ONLY.has(tidied)) {
        propose(node, FORMAT_ONLY.get(tidied)!, 'format-only-name');
      } else if (ACRONYMS.has(tidied)) {
        propose(node, ACRONYMS.get(tidied)!, 'acronym-expansion');
      }
    }

    if (node.children) walk(node.children);
  }
}

walk(roots);

const byReason = new Map<string, number>();
for (const op of ops) {
  byReason.set(op.reason, (byReason.get(op.reason) ?? 0) + 1);
}

await writeFile(planOut, JSON.stringify(ops, null, 1));
process.stderr.write(`Wrote ${planOut}: ${ops.length} operation(s)\n`);
for (const [reason, count] of [...byReason.entries()].sort()) {
  process.stderr.write(`  ${reason}: ${count}\n`);
}
