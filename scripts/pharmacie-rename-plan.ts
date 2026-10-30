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
  fileid?: number;
  folderid?: number;
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
  ['Drive #3', 'Drive 3 - Google Drive'],
  ['Drive #6', 'Drive 6 - Google Drive'],
  ['Drive1', 'Drive 1 - Google Drive'],
  ['Drive2', 'Drive 2 - Google Drive'],
  ['Drive3', 'Drive 3 - Google Drive'],
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
const seen = new Set<string>();

function propose(node: InvNode, newname: string, reason: string): void {
  // A folder carries a folderid, a file carries a fileid; pCloud renames
  // them through different endpoints, so the plan has to keep them apart.
  const key = `${node.isfolder ? 'f' : 'x'}:${node.folderid ?? node.fileid}`;
  if (seen.has(key)) return;
  seen.add(key);
  const op: RenameOp = {
    toname: sanitize(newname),
    reason,
    oldname: node.name,
  };
  if (node.isfolder) {
    if (node.folderid === undefined) return;
    op.folderid = node.folderid;
  } else {
    if (node.fileid === undefined) return;
    op.fileid = node.fileid;
  }
  ops.push(op);
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

/**
 * pCloud refuses a rename that would collide with a sibling (error 2004).
 * Two legacy names can normalise to the same readable name, so the plan is
 * post-processed: within each parent folder, a target name that is already
 * taken by a sibling that is not itself being renamed gets a numeric suffix.
 */
const parentOf = new Map<string, string>();
const siblingsByParent = new Map<string, Set<string>>();
const renamedIds = new Set<string>();

function indexSiblings(nodes: InvNode[], parent: string): void {
  for (const node of nodes) {
    if (!node.isfolder) continue;
    const id = String(node.folderid ?? node.fileid);
    parentOf.set(id, parent);
    renamedIds.add(id);
    if (!siblingsByParent.has(parent)) siblingsByParent.set(parent, new Set());
    siblingsByParent.get(parent)!.add(node.name);
    if (node.children) indexSiblings(node.children, node.path);
  }
}
indexSiblings(roots, '');

const opsByParent = new Map<string, RenameOp[]>();
for (const op of ops) {
  const id = op.folderid !== undefined ? String(op.folderid) : String(op.fileid);
  const parent = parentOf.get(id);
  if (parent === undefined) continue;
  if (!opsByParent.has(parent)) opsByParent.set(parent, []);
  opsByParent.get(parent)!.push(op);
}

for (const [parent, parentOps] of opsByParent) {
  const siblings = siblingsByParent.get(parent);
  if (!siblings) continue;
  const taken = new Set(siblings);
  const usedHere = new Set<string>();
  for (const op of parentOps) {
    const oldName = op.oldname;
    let candidate = op.toname;
    // A sibling that is itself being renamed frees its name.
    taken.delete(oldName);
    if (taken.has(candidate) || usedHere.has(candidate)) {
      const base = candidate.replace(/ (\d+)$/, '');
      let n = 2;
      while (taken.has(`${base} ${n}`) || usedHere.has(`${base} ${n}`)) n += 1;
      candidate = `${base} ${n}`;
      op.reason = `${op.reason}+collision`;
    }
    taken.add(candidate);
    usedHere.add(candidate);
    op.toname = candidate;
  }
}

const byReason = new Map<string, number>();
for (const op of ops) {
  byReason.set(op.reason, (byReason.get(op.reason) ?? 0) + 1);
}

await writeFile(planOut, JSON.stringify(ops, null, 1));
process.stderr.write(`Wrote ${planOut}: ${ops.length} operation(s)\n`);
for (const [reason, count] of [...byReason.entries()].sort()) {
  process.stderr.write(`  ${reason}: ${count}\n`);
}
