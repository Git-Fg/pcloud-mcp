/**
 * Rebuilds the exploded Apple iWork bundles in the pCloud Pharmacie tree.
 *
 * A ".pages" document is a ZIP archive. Three partial copies of the same
 * document were uploaded with the archive expanded into its parts
 * ("Index.zip", "Data/", "Metadata/", "preview*.jpg"), which leaves the
 * document unusable. This script downloads the parts of the complete copy,
 * rebuilds the archive, uploads it as a single ".pages" file, and removes
 * every exploded folder that held a part of it.
 *
 * Usage: bun run scripts/pharmacie-repack-pages.ts [inventory] [out] [--apply]
 */
import { readFile, writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

const exec = promisify(execFile);

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface BundlePlan {
  /** The complete bundle to rebuild. */
  folderid: number;
  path: string;
  parentid: number;
  parentPath: string;
  filename: string;
  parts: Array<{ fileid: number; name: string; path: string }>;
  /** Every exploded folder that held a part of this document. */
  exploded: Array<{ folderid: number; path: string }>;
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-5.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-repack-pages.json';
const apply = process.argv[4] === '--apply';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const client = new PcloudHttpClient();

const nodes: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    nodes.push(node);
    if (node.isfolder) walk(node.children ?? []);
  }
})(roots);

const bundles = nodes.filter((n) => n.isfolder && n.path.endsWith('.pages'));

/** Every file inside a bundle, flattened with its path relative to it. */
function bundleParts(folder: InvNode): Array<{ fileid: number; name: string; path: string }> {
  const parts: Array<{ fileid: number; name: string; path: string }> = [];
  const walk = (node: InvNode, prefix: string): void => {
    for (const child of node.children ?? []) {
      const relative = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.isfolder) walk(child, relative);
      else parts.push({ fileid: child.fileid!, name: child.name, path: relative });
    }
  };
  walk(folder, '');
  return parts;
}

/** The parent of a folder, found by its path prefix. */
function parentOf(folder: InvNode): InvNode {
  const parentPath = folder.path.replace(/\/[^/]+$/, '');
  const parent = nodes.find((n) => n.isfolder && n.path === parentPath);
  if (!parent) throw new Error(`no parent for ${folder.path}`);
  return parent;
}

/**
 * The document name a bundle carries, without the leading index the course
 * material was numbered with: "(10) Thalassémies.pages" becomes
 * "Thalassémies.pages".
 */
function documentName(folderName: string): string {
  const base = folderName.replace(/\.pages$/i, '').replace(/^\(\d+\)\s*/, '').trim();
  return `${base}.pages`;
}

/**
 * Groups the exploded folders that hold parts of the same document.
 *
 * Each location keeps its own copy of the document, but an upload split it
 * across folders: the document index may sit in one place and the metadata
 * in another. The parts are matched by their file name so every copy can be
 * rebuilt whole.
 */
function partIndex(): Map<string, { fileid: number; name: string; path: string }> {
  const index = new Map<string, { fileid: number; name: string; path: string }>();
  for (const bundle of bundles) {
    for (const part of bundleParts(bundle)) {
      // The same file was uploaded with its name in two normalisations, so
      // the key is folded; the first copy found wins.
      const key = part.path.normalize('NFC');
      if (!index.has(key)) index.set(key, { ...part, path: key });
    }
  }
  return index;
}

const allParts = partIndex();

/** Every part a complete document needs, taken from wherever it was left. */
function completeParts(): Array<{ fileid: number; name: string; path: string }> {
  const names = new Set<string>();
  for (const part of allParts.values()) names.add(part.path);
  return [...names].sort().map((path) => allParts.get(path)!);
}

const plans: BundlePlan[] = [];
for (const bundle of bundles) {
  const parent = parentOf(bundle);
  plans.push({
    folderid: bundle.folderid!,
    path: bundle.path,
    parentid: parent.folderid!,
    parentPath: parent.path,
    filename: documentName(bundle.name),
    parts: completeParts(),
    exploded: [{ folderid: bundle.folderid!, path: bundle.path }],
  });
}

await writeFile(outJson, JSON.stringify(plans, null, 1));
process.stderr.write(`Wrote ${outJson}: ${plans.length} document(s) to rebuild\n`);
for (const plan of plans) {
  process.stderr.write(`  ${plan.path.replace('/Pharmacie/', '')} -> ${plan.filename}\n`);
  for (const part of plan.parts) process.stderr.write(`      ${part.path}\n`);
  for (const exploded of plan.exploded) {
    process.stderr.write(`    exploded folder: ${exploded.path.replace('/Pharmacie/', '')}\n`);
  }
}

if (!apply) process.exit(0);

const work = await mkdtemp(join(tmpdir(), 'pharmacie-pages-'));

// Every part is downloaded before anything is deleted: a later document may
// be missing parts that only the folder of an earlier one still holds.
const staged: Array<{ plan: BundlePlan; archive: string }> = [];
for (const plan of plans) {
  const staging = join(work, `bundle-${plan.folderid}`);
  await mkdir(staging, { recursive: true });
  for (const part of plan.parts) {
    const destination = join(staging, part.path);
    await mkdir(join(destination, '..'), { recursive: true });
    const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid: part.fileid });
    const url = (link.hosts[0].startsWith('http') ? link.hosts[0] : `https://${link.hosts[0]}`) + link.path;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed for ${part.path}: ${res.status}`);
    await writeFile(destination, Buffer.from(await res.arrayBuffer()));
  }

  // The parts are already the contents of the archive, so zipping the
  // staging folder rebuilds the original document.
  const archive = join(work, plan.filename);
  await exec('zip', ['-r', '-X', archive, '.'], { cwd: staging });
  staged.push({ plan, archive });
}

for (const { plan, archive } of staged) {
  await client.upload(
    'uploadfile',
    { folderid: plan.parentid },
    { blob: new Blob([await Bun.file(archive).arrayBuffer()]), filename: plan.filename }
  );
  process.stderr.write(`  uploaded ${plan.filename}\n`);

  for (const exploded of plan.exploded) {
    await client.json('deletefolderrecursive', { folderid: exploded.folderid });
  }
  process.stderr.write(`  removed ${plan.exploded.length} exploded folder(s)\n`);
}

await rm(work, { recursive: true, force: true });
process.stderr.write('Done\n');
