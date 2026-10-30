/**
 * Builds the rename plan for generically-named pCloud files.
 *
 * These files carry an index ("1.pdf"), a content hash
 * ("08078a88….png") or a two-letter code ("PK.pdf") — a name that says
 * nothing about what the file holds. The identification pass
 * (scripts/pharmacie-identify.ts, selection "generic") supplies the real
 * format and title; this plan turns that into a readable name.
 *
 * Photographs are named after the kind of material their folder holds
 * ("Photo d'examen 05.JPG"); documents are named
 * "<folder> - <title>.<ext>". Storage droppings (".DS_Store", one-line
 * text stubs) are marked for deletion instead.
 *
 * Usage: bun run scripts/pharmacie-generic-rename-plan.ts [identified] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  capitalize,
  cleanTitle,
  fileName,
  folderLabel,
  isInformative,
  mediaKind,
} from './lib/naming.js';
import { repairUtf8Mojibake } from './lib/cp437.js';

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

interface PurgePlan {
  renameFiles: Array<{ fileid: number; path: string; toname: string }>;
  deleteFiles: Array<{ fileid: number; path: string }>;
}

const identifiedPath = process.argv[2] ?? '/tmp/pharmacie-identified-generic.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-generic-plan.json';

const identified = JSON.parse(await readFile(identifiedPath, 'utf8')) as Identified[];

/** Sequential numbers for files whose only name is a content hash. */
const hashIndex = new Map<string, Map<string, number>>();

function hashOrderNumber(folder: string, name: string): number {
  let perFolder = hashIndex.get(folder);
  if (!perFolder) {
    perFolder = new Map(
      identified
        .filter((i) => i.path.replace(/\/[^/]+$/, '') === folder)
        .map((i) => i.name)
        .sort()
        .map((n, index) => [n, index + 1] as const)
    );
    hashIndex.set(folder, perFolder);
  }
  return perFolder.get(name) ?? 1;
}

/** A name the author chose that still carries meaning worth keeping. */
function meaningfulStem(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  if (/[A-Za-zÀ-ÿ]{2,}/.test(stem)) return stem;
  return '';
}

/** An index file keeps its order in the name, so a set stays browsable. */
function indexSuffix(name: string): string {
  const match = name.match(/^(\d+)(?:\.[^.]+)?$/);
  if (!match) return '';
  return ` - ${match[1].padStart(2, '0')}`;
}

/** Text files with a handful of bytes and no word in them are placeholders. */
function isPlaceholder(item: Identified): boolean {
  if (item.format !== 'text') return false;
  if (item.size >= 32) return false;
  return !/[A-Za-zÀ-ÿ]{3,}/.test(item.head ?? '');
}

const renameFiles: PurgePlan['renameFiles'] = [];
const deleteFiles: PurgePlan['deleteFiles'] = [];
/** Names already used inside a folder, so two files never collide. */
const usedNames = new Map<string, Set<string>>();

/** Assigns a name in its folder, adding a counter when it is already taken. */
function claimName(folder: string, wanted: string): string {
  const taken = usedNames.get(folder) ?? new Set<string>();
  let name = wanted;
  let n = 2;
  const dot = wanted.lastIndexOf('.');
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
  const ext = dot > 0 ? wanted.slice(dot) : '';
  while (taken.has(name)) {
    name = `${stem} (${n})${ext}`;
    n += 1;
  }
  taken.add(name);
  usedNames.set(folder, taken);
  return name;
}

for (const item of identified) {
  if (item.format === 'dsstore' || isPlaceholder(item)) {
    deleteFiles.push({ fileid: item.fileid, path: item.path });
    continue;
  }

  const segments = item.path.split('/').filter(Boolean);
  const folderSegments = segments.slice(0, -1);
  const folder = '/' + folderSegments.join('/');
  const extension = '.' + item.name.split('.').pop()!;
  let wanted: string;

  if (item.format === 'jpeg' || item.format === 'png') {
    // A photograph is named after what it is a photograph of, keeping its
    // original order so a set stays browsable.
    const index = indexSuffix(item.name);
    const number = index
      ? index.slice(2)
      : String(hashOrderNumber(folder, item.name)).padStart(2, '0');
    wanted = `${mediaKind(folderSegments)} ${number}${extension}`;
  } else if (item.name === 'ED.py') {
    // Verified by reading the source: a document OCR and extraction pipeline.
    wanted = 'Pipeline OCR - extraction et analyse documentaire.py';
  } else {
    const label = folderLabel(folderSegments);
    const title = cleanTitle(repairUtf8Mojibake(item.title));
    const index = indexSuffix(item.name);
    let descriptor: string;
    if (isInformative(title)) {
      // The original index keeps the set in order.
      descriptor = index ? `${title} - ${index.slice(2)}` : title;
    } else {
      const stem = meaningfulStem(item.name);
      descriptor = stem || `Partie ${String(hashOrderNumber(folder, item.name)).padStart(2, '0')}`;
    }
    const parts =
      label && !descriptor.toLowerCase().startsWith(label.toLowerCase())
        ? [label, descriptor]
        : [descriptor];
    wanted = fileName(capitalize(parts.join(' - ')), extension);
  }

  if (wanted === item.name) continue;
  renameFiles.push({
    fileid: item.fileid,
    path: item.path,
    toname: claimName(folder, wanted),
  });
}

const plan: PurgePlan = { renameFiles, deleteFiles };
await writeFile(outJson, JSON.stringify(plan, null, 1));
process.stderr.write(`Wrote ${outJson}\n`);
process.stderr.write(`  rename: ${renameFiles.length}\n`);
process.stderr.write(`  delete: ${deleteFiles.length}\n`);
for (const f of renameFiles) {
  process.stderr.write(`    REN ${f.path.replace('/Pharmacie/', '')} -> ${f.toname}\n`);
}
