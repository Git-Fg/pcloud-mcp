/**
 * Tells apart a redundant re-save from a real second revision.
 *
 * Two files that share a base name differ by a handful of bytes when the same
 * document was saved twice: Word rewrites its internal bookmark ids and its
 * table of contents on every save, and it drops in a stray space or two. The
 * content hash sees all of that and calls the pair different, so the pair is
 * compared by the text a reader would actually see.
 *
 * A pair whose text matches once the whitespace and the anchors are taken out
 * is the same document twice, and one of the two copies can go. A pair that
 * still differs is two genuine revisions, and both are kept: the one that
 * carries the copy suffix is renamed as the revision it is.
 *
 * Usage: bun run scripts/pharmacie-compare-versions.ts [inventory] [report]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { writeFileSync, unlinkSync } from 'node:fs';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory.json';
const reportPath = process.argv[3] ?? '/tmp/pharmacie-version-pairs.json';

const roots = JSON.parse(await readFile(inventoryPath, 'utf8')) as InvNode[];
const files: InvNode[] = [];
(function walk(list: InvNode[]): void {
  for (const node of list) {
    if (node.isfolder) walk(node.children ?? []);
    else files.push(node);
  }
})(roots);

const client = new PcloudHttpClient();

async function download(fileid: number): Promise<Buffer> {
  const link = await client.json<{ hosts: string[]; path: string }>('getfilelink', { fileid });
  const response = await fetch(`https://${link.hosts[0]}${link.path}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The text a reader would see, whatever the container. */
function textOf(name: string, bytes: Buffer): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext !== 'docx' && ext !== 'pptx') {
    return bytes.toString('utf8').replace(/\s+/g, ' ').trim();
  }
  const temp = `/private/tmp/pharmacie-compare-${process.pid}-${Math.random().toString(36).slice(2)}.${ext}`;
  writeFileSync(temp, bytes);
  try {
    const pattern = ext === 'docx' ? 'word/document.xml' : 'ppt/slides/slide*.xml';
    const run = Bun.spawnSync(['unzip', '-p', temp, pattern], { stdout: 'pipe', stderr: 'ignore' });
    return run.stdout
      .toString('utf8')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } finally {
    unlinkSync(temp);
  }
}

/**
 * The anchors and the field codes are what Word rewrites on every save. They
 * are what no reader ever sees, so they are taken out before the comparison.
 */
function withoutAnchors(text: string): string {
  return text
    .replace(/_(?:Toc|Ref|GoBack|Hlk)\d+/g, '_')
    .replace(/\\o\s+"[^"]*"|\\h|\\z|\\u/g, ' ')
    .replace(/\s+/g, '');
}

/**
 * pCloud's copy counter is a small number. A four-digit number in the same
 * place is a year the name carries on purpose.
 */
function isCopyCounter(text: string): boolean {
  if (text.length === 4 && Number(text) >= 1900 && Number(text) <= 2099) return false;
  return true;
}

const byFolder = new Map<string, InvNode[]>();
for (const file of files) {
  const dir = file.path.slice(0, file.path.lastIndexOf('/'));
  if (!byFolder.has(dir)) byFolder.set(dir, []);
  byFolder.get(dir)!.push(file);
}

interface Pair {
  suffixed: InvNode;
  plain: InvNode;
}

const pairs: Pair[] = [];
for (const group of byFolder.values()) {
  const byName = new Map(group.map((file) => [file.name, file]));
  for (const file of group) {
    const match = file.name.match(/^(.*) \((\d+)\)(\.[A-Za-z0-9]+)$/);
    if (!match || !isCopyCounter(match[2])) continue;
    const plain = byName.get(match[1] + match[2]);
    if (plain) pairs.push({ suffixed: file, plain });
  }
}

const identical: Array<{ drop: string; keep: string; fileid: number; path: string }> = [];
const different: Array<{ fileid: number; path: string; toname: string }> = [];

for (const pair of pairs) {
  const [suffixed, plain] = await Promise.all([
    download(pair.suffixed.fileid!),
    download(pair.plain.fileid!),
  ]);
  const textA = textOf(pair.suffixed.name, suffixed);
  const textB = textOf(pair.plain.name, plain);
  if (withoutAnchors(textA) === withoutAnchors(textB)) {
    // The copy without the suffix is the one that keeps the plain name.
    identical.push({
      drop: pair.suffixed.path,
      keep: pair.plain.path,
      fileid: pair.suffixed.fileid!,
      path: pair.suffixed.path,
    });
    continue;
  }
  const name = pair.suffixed.name;
  const match = name.match(/^(.*) \((\d+)\)(\.[A-Za-z0-9]+)$/);
  different.push({
    fileid: pair.suffixed.fileid!,
    path: pair.suffixed.path,
    toname: `${match![1]} - version ${match![2]}${match![3]}`,
  });
}

await writeFile(
  reportPath,
  JSON.stringify(
    {
      identical,
      different,
      plan: {
        deleteDirs: [],
        deleteFiles: identical.map((entry) => ({ fileid: entry.fileid, path: entry.path })),
        renameDirs: [],
        renameFiles: different,
      },
    },
    null,
    1,
  ),
);

process.stderr.write(`${pairs.length} pair(s) compared\n`);
process.stderr.write(`  same document saved twice: ${identical.length}\n`);
process.stderr.write(`  genuine second revision: ${different.length}\n`);
process.stderr.write(`report: ${reportPath}\n`);
