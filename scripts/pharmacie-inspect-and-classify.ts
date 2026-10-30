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

/** Target folders that are mixed and need content inspection. */
const TARGET_DIRS = [
  '/Pharmacie/4A/UE-XX-NON-CLASSE/Autres',
  '/Pharmacie/4A/UE-XX-NON-CLASSE/Fiches',
  '/Pharmacie/4A/UE-XX-NON-CLASSE/Annales',
  '/Pharmacie/4A/UE-XX-NON-CLASSE/Images',
  '/Pharmacie/4A/S2/UE-XX-NON-CLASSE/Annales',
  '/Pharmacie/4A/S1/S1/Drive - Google Drive/Cours/Fiche Mel',
  '/Pharmacie/4A/S1/DFASP1 - 4eme annee/Drive - Google Drive/Fiche Mel',
  '/Pharmacie/4A/S1/DFASP1 - 4eme annee/Drive - Google Drive/Fiche Claudie',
  '/Pharmacie/4A/S1/DFASP1 - 4eme annee/Drive 3 - Google Drive/drive alison/Parcours 13 Rone\u00f3s',
  '/Pharmacie/4A/S1/Mes Fiches Compl\u00e8tes',
  '/Pharmacie/4A/S1/SAV - Serveur Applications Virtuelles/SAV - Serveur Applications Virtuelles/Mes Fiches Compl\u00e8tes',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Perso/Fiche derni\u00e8re minute/Anciennes versions',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Autre/En cours/Fiche autre',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/DFGSP3 2023/VALIDER LA 3A S2/Fiches 3A S2 Lisa',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Fiches ultra condens\u00e9e/Fiches condens\u00e9es UE7',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Rattrapages/Scan',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Rattrapages/annales corrig\u00e9es pdf',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Rattrapages/annales corrig\u00e9es word/Word DOCX',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Derni\u00e8re Minute/Transcription TXT',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Derni\u00e8re Minute',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Autre/En cours/ED Deborah',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Perso/ED',
  '/Pharmacie/3A/DFGSP3 - 3eme annee/Stage 3A',
];

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

/** Classify by content keywords. */
function classifyByContent(text: string, fileName: string, year: string): Unit | null {
  const t = text.toLowerCase();
  const f = fileName.toLowerCase();

  // UE-01-OMS (Onco/Hémato)
  if (/h[eé]mato|leuc[eé]mie|lymphome|my[eé]lome|oncolog|chimioth[eé]rapie|anticorps|rituximab|bortezomib|lenalidomide|daratumumab|mielome|maladie\s*du\s*sang/.test(t)) return 'UE-01-OMS';

  // UE-02-PAM (Chimie thérapeutique, Pharmacognosie, Galénique)
  if (/pharmacognosie|gal[eé]nique|chimie\s*th[eé]rapeutique|principe\s*actif|p[nn]enilline|[cç]ephalosporine|macrolide|aminoside|alcalo[\"i]de|isoquinol|tropanique|quinine|colchicine|galanthamine|birefringence|polarisation|optique\s*g[eé]om[eé]trique|spectro|uv|visible|ir|rmn|masse|radioactivit[eé]/.test(t)
      && !/bact[eé]rio|virolog|parasito|myco|infectiolog/.test(t)) return 'UE-02-PAM';

  // UE-03-VEMA (PK, Toxico, Variabilité)
  if (/pharmacocin[eé]tique|clairance|volume\s*de\s*distribution|biodisponibilit[eé]|demi[- ]vie|auc|aumc|trm|vss|k[eé]la|toxicolog|surdosage|intoxication|n[eé]phrotoxicit[eé]|h[eé]patotoxicit[eé]|cystatine\s*c|ckd[- ]epi|schwartz|ajustement\s*posolog/.test(t)) return 'UE-03-VEMA';

  // UE-04-PI (Infectieuses)
  if (/infectiolog|bact[eé]riolog|virolog|parasitolog|mycolog\s*invasive|s[eé]psis|choc\s*s[eé]ptique|m[eé]ningite|endocardite|pneumonie|tuberculose|paludisme|antiviral|antir[eé]troviral|vi[rh]i|pr[eé]p|tpe|tas\s*p|inhibiteur\s*d\'int[eé]grase|dolut[eé]gravir|bict[eé]gravir|tenofovir|emtricitabine/.test(t)
      && !/association\s*de\s*tutorat/.test(t)) return 'UE-04-PI';

  // UE-05-SNC (SNC, Douleur, Endocrino)
  if (/snc|syst[eé]me\s*nerveux|neuro|[eé]pilepsie|parkinson|alzheimer|migraine|douleur|antalgique|opio[\"i]de|morphine|fentanyl|tramadol|gabapentine|pr[eé]gabaline|endocrino|diab[eé]te|insuline|thyro[\"i]de|cortico[\"i]de|surr[eé]nale|hypophys[eé]|pnedi|synapse|r[eé]cepteur|canal\s*ionique/.test(t)
      && !/deep\s*learning|apprentissage\s*profond|machine\s*learning|ia|intelligence\s*artificielle/.test(t)) return 'UE-05-SNC';

  // UE-06-VIGILANCE (Vigilances, VEA)
  if (/vigilance|pharmacovigilance|mat[eé]riovigilance|nutrivigilance|h[eé]movigilance|d[eé]claration\s*d[e']effet|signalement|ear\/veg|meddra|rmp|plan\s*de\s*gestion\s*des\s*risque/.test(t)) return 'UE-06-VIGILANCE';

  // UE-07-CV (Cardio/Vasculaire/Rénal)
  if (/cardio|hypertension|insuffisance\s*cardiaque|arythmie|anticoagulant|antiagr[eé]gant|warfarine|acenocoumarol|rivaroxaban|apixaban|dabigatran|heparine|enoxaparine|fibrinolyse|plaquettes|coagulation|h[eé]mostase|rein|n[eé]phro|cr[eé]atinine|dfg|ckd|glomerul|proteinurie|h[eé]modialyse|r[eé]cepteurs\s*membranaires|transporteur/.test(t)) return 'UE-07-CV';

  // UE-08-PA (Pharmacie appliquée, Industrie, POP officine)
  if (/officine|dispensation|conduite\s*\u00e0\s*tenir|analyse\s*d[e']ordonnance|conseil\s*pharmaceutique|pharmacie\s*clinique|industrie\s*pharmaceutique|amm|autorisation\s*de\s*mise\s*sur\s*le\s*march[eé]|g[eé]n[eé]rique|biosimilaire|prix|remboursement|transparence|assurance\s*qualit[eé]|bonnes\s*pratiques|bpf|bpfa|gmp|cycle\s*de\s*vie\s*du\s*m[eé]dicament|affaires\s*r[eé]glementaires|vea|pharmaco[ée]conomie/.test(t)) return 'UE-08-PA';

  // UE-09-MICROBIO (Microbiologie inorganique/chimie analytique)
  if (/chimie\s*inorganique|analytique|titrim[eé]trie|indicateurs\s*color[eé]s|pH|oxydor[eé]duction|complexe|ch[eé]lation|m[eé]tal|ion\s*m[eé]tallique|bioinorganique|eau|oligo[eé]l[eé]ment/.test(t)) return 'UE-09-MICROBIO';

  // UE-10-BOTANIQUE (Botanique, Phytothérapie, Épidémiologie/Santé publique - 5A)
  if (/botanique|phytoth[eé]rapie|plante\s*m[eé]dicinale|hom[eé]opathie|aromath[eé]rapie|huile\s*essentielle|pharmacognosie\s*v[eé]g[eé]tale/.test(t)) return 'UE-10-BOTANIQUE';
  if (/causalit[eé]|risque|biais|m[eé]ta[- ]analyse|essai\s*randomis[eé]|epid[eé]miolog|sant[eé]\s*publique|pr[eé]vention|promotion\s*de\s*la\s*sant[eé]/.test(t) && year === '5A') return 'UE-10-BOTANIQUE';

  // UE-11-TUBE-DIG (Tube digestif)
  if (/digestif|gastro|ent[eé]rite|colite|h[eé]patique|cholestase|cytolyse|insuffisance\s*h[eé]patique|cirrhose|pancr[eé]as|ulc[eé]re|reflux|rgo|h\.?\s*pylori|mici|maladie\s*inflammatoire\s*intestin|rectocolite|crohn|antiem[eé]tique|antiacide|ipp|inhibiteur\s*de\s*pompe/.test(t)) return 'UE-11-TUBE-DIG';

  // UE-12-SANTE-PUB (Santé publique, Éco droit, Économie du médicament)
  if (/sant[eé]\s*publique|[eé]pid[eé]miologie|assurance\s*maladie|s[eé]curit[eé]\s*sociale|haute\s*autorit[eé]\s*de\s*sant[eé]|has|remboursement|[eé]conomie\s*du\s*m[eé]dicament|[eé]valuation\s*m[eé]dico[- ]economique|choix\s*th[eé]rapeutique|acc[eé]s\s*aux\s*soins|droit\s*pharmaceutique|l[eé]gislation/.test(t)) return 'UE-12-SANTE-PUB';

  // Fallback to filename
  if (/ue\s*0?1\b/.test(f)) return 'UE-01-OMS';
  if (/ue\s*0?2\b/.test(f)) return 'UE-02-PAM';
  if (/ue\s*0?3\b/.test(f)) return 'UE-03-VEMA';
  if (/ue\s*0?4\b/.test(f)) return 'UE-04-PI';
  if (/ue\s*0?5\b/.test(f)) return 'UE-05-SNC';
  if (/ue\s*0?6\b/.test(f)) return 'UE-06-VIGILANCE';
  if (/ue\s*0?7\b/.test(f)) return 'UE-07-CV';
  if (/ue\s*0?8\b/.test(f)) return 'UE-08-PA';
  if (/ue\s*0?9\b/.test(f)) return 'UE-09-MICROBIO';
  if (/ue\s*10\b/.test(f)) return 'UE-10-BOTANIQUE';
  if (/ue\s*11\b/.test(f)) return 'UE-11-TUBE-DIG';
  if (/ue\s*12\b/.test(f)) return 'UE-12-SANTE-PUB';

  return null;
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

  // Try to extract text if PDF
  let text = '';
  if (file.name.toLowerCase().endsWith('.pdf')) {
    text = await extractPdfText(file.fileid!);
  }

  // Try docx - use unzip + read word/document.xml (simplified: skip for now, use filename)
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
for (const targetDir of TARGET_DIRS) {
  const targetDirNode = dirs.find(d => d.path === targetDir);
  if (!targetDirNode) continue;

  for (const child of targetDirNode.children ?? []) {
    if (child.isfolder) {
      // Recurse one level
      for (const file of files.filter(f => f.path.startsWith(child.path + '/'))) {
        if (processed >= maxFiles) break;
        await processFile(file);
        processed++;
      }
    } else {
      if (processed >= maxFiles) break;
      await processFile(child);
      processed++;
    }
  }
  if (processed >= maxFiles) break;
}

console.log(`Processed ${processed} files, ${moves.length} classified`);
await writeFile(outJson, JSON.stringify({ moves, foldersToCreate: [...foldersToCreate.values()] }, null, 1));
console.log(`Written ${outJson}`);