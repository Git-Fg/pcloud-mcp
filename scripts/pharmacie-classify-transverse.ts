/**
 * Classifies the remaining transverse Pharmacie files using path context.
 *
 * The legacy tree encodes the teaching unit in the folder names above the
 * file. This script reads those path signals (deepest first) and maps them
 * to the canonical 12-unit codebook, then emits a move plan.
 *
 * Usage: bun run scripts/pharmacie-classify-transverse.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { detectYear, detectSemester, type Unit } from '/Users/felix/Documents/pcloud_mcp/scripts/lib/classify.js';

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

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-12.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-transverse-plan.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];

const dirs: InvNode[] = [];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) {
      dirs.push(node);
      walk(node.children ?? []);
    } else {
      files.push(node);
    }
  }
})(roots);

const allIds = new Map<string, number>();
for (const dir of dirs) allIds.set(dir.path, dir.folderid!);

const CANONICAL_UNIT = /^\/Pharmacie\/(3A|4A|5A)(\/(S1|S2))?\/UE-[0-9]{2}-[A-Z-]+/;
const CANONICAL_CSP = /^\/Pharmacie\/(3A|4A|5A)\/CSP\//;
const isCanonical = (path: string): boolean => CANONICAL_UNIT.test(path) || CANONICAL_CSP.test(path);

/** Every file not already in the canonical tree. */
const unclassified = files.filter((f) => !isCanonical(f.path));

/** Context signals from a path segment. Deepest segment wins. */
function signalFromSegment(seg: string, year: string | null): Unit | null {
  const s = seg.trim().toLowerCase();

  // 1) Explicit UE number (already handled by detectUnit in classify.ts but reimplement for context)
  const ueNum = s.match(/^ue[\s\-.]*0?(\d{1,2})$/);
  if (ueNum && year) {
    const num = Number(ueNum[1]);
    const map: Record<string, Record<number, Unit>> = {
      '3A': { 1: 'UE-02-PAM', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-01-OMS', 5: 'UE-05-SNC', 6: 'UE-05-SNC', 7: 'UE-07-CV', 8: 'UE-02-PAM', 9: 'UE-09-MICROBIO', 10: 'UE-09-MICROBIO', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
      '4A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' },
      '5A': { 1: 'UE-01-OMS', 2: 'UE-02-PAM', 3: 'UE-03-VEMA', 4: 'UE-04-PI', 5: 'UE-05-SNC', 6: 'UE-06-VIGILANCE', 7: 'UE-07-CV', 8: 'UE-08-PA', 9: 'UE-09-MICROBIO', 10: 'UE-10-BOTANIQUE', 11: 'UE-11-TUBE-DIG', 12: 'UE-12-SANTE-PUB' }
    };
    return map[year]?.[num] ?? null;
  }

  // 2) POP officine / UE O*
  if (/^ue\s*o1\b|o1\s*[-–]\s*dialogue/.test(s)) return 'UE-08-PA';
  if (/^ue\s*o2\b|o2\s*[-–]\s*phyto/.test(s)) return 'UE-10-BOTANIQUE';
  if (/^ue\s*o3\b|o3\s*[-–]\s*environnement/.test(s)) return 'UE-12-SANTE-PUB';
  if (/^ue\s*o4\b|o4\s*[-–]\s*activit/.test(s)) return 'UE-08-PA';
  if (/^ue\s*o6\b|o6\s*[-–]\s*suivi/.test(s)) return 'UE-08-PA';
  if (/^ue\s*o7\b|o7\s*[-–]\s*environnement|mycologie\s*officinale/.test(s)) return 'UE-08-PA';
  if (/^ue\s*o10\b|o10\s*[-–]\s*gestion/.test(s)) return 'UE-08-PA';
  if (/pop\s*officine|dialogue\s*sur\s*ordo/.test(s)) return 'UE-08-PA';

  // 3) POP industrie & recherche
  if (/^ue\s*ir3\b|ir3/.test(s)) return 'UE-08-PA';
  if (/^ue\s*ir4\b|ir4/.test(s)) return 'UE-08-PA';
  if (/^ue\s*ir5\b|ir5/.test(s)) return 'UE-08-PA';
  if (/^ue\s*ir6\b|ir6/.test(s)) return 'UE-08-PA';
  if (/^ue\s*i1\b|^i1\b/.test(s)) return 'UE-08-PA';
  if (/^ue\s*i2\b|^i2\b/.test(s)) return 'UE-08-PA';
  if (/^ue\s*i3\b|^i3\b/.test(s)) return 'UE-08-PA';
  if (/^ue\s*i4\b|^i4\b/.test(s)) return 'UE-08-PA';
  if (/industrie/.test(s)) return 'UE-08-PA';

  // 4) 3A / 4A / 5A named segments
  if (/^cv$|^cardio$|rein\b|h[ée]mostase|s[eé]mio\s*cv/.test(s)) return 'UE-07-CV';
  if (/^pam\b|pharmacognosie|gal[eé]nique|chimie\s*th[eé]rapeut/.test(s)) return 'UE-02-PAM';
  if (/micro\b|viro\b|microbiolog|bact[eé]riolog|parasito|myco\b/.test(s)) return 'UE-09-MICROBIO';
  if (/h[eé]mato\b|oncolog|leuc[eé]mi|lymphom|pharmacie\s*clinique/.test(s)) return 'UE-01-OMS';
  if (/toxico|toxicolog/.test(s)) return 'UE-03-VEMA';
  if (/pk\b|pharmacocin|variabilit|stp\b/.test(s)) return 'UE-03-VEMA';
  if (/snc\b|neuro|pnedi|douleur|inflammat|endocrino|diab[eé]te|epileps|migraine|alzheimer|parkinson|psychiatrie/.test(s)) return 'UE-05-SNC';
  if (/vea\b|vigilance/.test(s)) return 'UE-06-VIGILANCE';
  if (/infecti|bact[eé]rio|virolog|antibioti/.test(s)) return 'UE-04-PI';
  if (/pir\b|economie|[ée]co\s*droit|droit\s*pharm/.test(s)) return 'UE-12-SANTE-PUB';
  if (/indus\b|^i1\b/.test(s)) return 'UE-08-PA';
  if (/botaniqu|phyto|plantes|hom[eé]opath/.test(s)) return 'UE-10-BOTANIQUE';
  if (/digestif|h[eé]pat|gastro|ent[eé]ro|nutrition|mici\b/.test(s)) return 'UE-11-TUBE-DIG';
  if (/sant[eé]\s*publique|[eé]pid[eé]mi|assuranc/.test(s)) return 'UE-12-SANTE-PUB';
  if (/uelc\b/.test(s)) return null; // depends on topic

  // 5) ED/Annales/Fiches/Cours/Rattrapages/Stage — doc type, not unit
  return null;
}

/** Resolve unit from a file's path by scanning segments deepest first. */
function resolveUnit(filePath: string): Unit | null {
  const year = detectYear(filePath);
  const segs = filePath.split('/').filter(Boolean);
  for (let i = segs.length - 1; i >= 1; i -= 1) {
    const u = signalFromSegment(segs[i], year);
    if (u) return u;
  }
  return null;
}

/** Build the move plan. */
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

let classified = 0;
for (const file of unclassified) {
  const unit = resolveUnit(file.path);
  const docType = detectDocType(file.name) ?? 'Cours';
  if (!unit) continue;

  const year = detectYear(file.path) ?? '4A';
  const semester = detectSemester(file.path);
  const base = `/Pharmacie/${year}${semester ? `/${semester}` : ''}/${unit}`;
  const target = `${base}/${docType}`;
  const targetId = ensureFolder(target);
  if (targetId === null) continue;

  moves.push({
    kind: 'file',
    id: file.fileid!,
    from: file.path,
    toPath: target,
    toFolderid: targetId,
    toname: freeName(target, file.name),
    reason: `${unit}/${docType} from ${file.path}`,
  });
  classified += 1;
}

console.log(`Classified ${classified}/${unclassified.length} files`);
console.log(`Folders to create: ${foldersToCreate.size}`);

const byUnit = new Map<string, number>();
for (const m of moves) { const u = m.reason.split('/')[0]; byUnit.set(u, (byUnit.get(u)??0)+1); }
for (const [k,v] of [...byUnit].sort((a,b)=>b[1]-a[1])) console.log(String(v).padStart(5), k);

await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()] }, null, 1));
console.log(`Written ${outJson}`);