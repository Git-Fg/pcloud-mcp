/**
 * Re-verifies the moves the content classifier made.
 *
 * The first version of the classifier matched fragments of common French
 * words, so files landed in the wrong unit. This script reads every move
 * that was applied, downloads the file again, classifies it with the fixed
 * rules, and reports the moves that now disagree — together with the unit
 * the file should sit in. The report is a work list for a human eye, not an
 * answer key: the verdict is a second opinion that still wants checking.
 *
 * Usage: bun run scripts/pharmacie-audit-content-moves.ts [report-out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';
import { detectYear } from './lib/classify.js';
import { classifyByText } from './lib/contentClassify.js';

interface MoveOp {
  kind: string;
  id: number;
  from: string;
  toPath: string;
  toFolderid: number;
  toname: string;
  reason: string;
}

interface AuditEntry {
  id: number;
  name: string;
  sitsIn: string;
  saysItIs: string | null;
  verdict: 'agree' | 'disagree' | 'unreadable';
}

const outJson = process.argv[2] ?? '/tmp/pharmacie-audit-content.json';

const planPaths = [
  '/tmp/pharmacie-inspect-plan-2.json',
  '/tmp/pharmacie-inspect-plan-3.json',
  '/tmp/pharmacie-inspect-plan-4.json',
  '/tmp/pharmacie-inspect-targeted.json',
];

const moves: MoveOp[] = [];
for (const path of planPaths) {
  const plan = JSON.parse(await readFile(path, 'utf8')) as { moves: MoveOp[] };
  moves.push(...plan.moves);
}

// A file that appears in several plans was only moved once.
const unique = new Map<number, MoveOp>();
for (const move of moves) unique.set(move.id, move);

const client = new PcloudHttpClient();

async function textOf(fileid: number, name: string): Promise<string> {
  try {
    const linkRes = await client.json<{ path: string; hosts: string[] }>('getfilelink', {
      fileid,
      forcedownload: true,
      maxspeed: 5000000,
    });
    const link = `https://${linkRes.hosts[0]}${linkRes.path}`;
    const res = await fetch(link);
    if (!res.ok) return '';
    const buf = await res.arrayBuffer();
    const lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) {
      const tmp = `/tmp/audit-${fileid}.pdf`;
      await writeFile(tmp, new Uint8Array(buf));
      const proc = Bun.spawn(['pdftotext', '-l', '3', '-q', tmp, '-'], { stdout: 'pipe', stderr: 'ignore' });
      const text = await new Response(proc.stdout).text();
      try { await Bun.file(tmp).delete(); } catch {}
      return text.slice(0, 8000);
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      const tmp = `/tmp/audit-${fileid}.docx`;
      await writeFile(tmp, new Uint8Array(buf));
      const proc = Bun.spawn(['unzip', '-p', tmp, 'word/document.xml'], { stdout: 'pipe', stderr: 'ignore' });
      const xml = await new Response(proc.stdout).text();
      try { await Bun.file(tmp).delete(); } catch {}
      return xml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .slice(0, 8000);
    }
    if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv') || lower.endsWith('.json')) {
      return (await new Response(buf).text()).slice(0, 8000);
    }
    return '';
  } catch {
    return '';
  }
}

const audit: AuditEntry[] = [];
let index = 0;
for (const move of unique.values()) {
  index += 1;
  const year = detectYear(move.toPath) ?? '4A';
  const sitsIn = move.toPath.match(/UE-[0-9]{2}-[A-Z-]+/)?.[0] ?? '?';
  const text = await textOf(move.id, move.toname);
  const says = text.trim() ? classifyByText(text.toLowerCase(), year) : null;
  if (says === null) {
    audit.push({ id: move.id, name: move.toname, sitsIn, saysItIs: null, verdict: 'unreadable' });
  } else if (says === sitsIn) {
    audit.push({ id: move.id, name: move.toname, sitsIn, saysItIs: says, verdict: 'agree' });
  } else {
    audit.push({ id: move.id, name: move.toname, sitsIn, saysItIs: says, verdict: 'disagree' });
  }
  if (index % 50 === 0) process.stderr.write(`  ${index}/${unique.size}\n`);
}

const verdicts = audit.reduce<Record<string, number>>((acc, entry) => {
  acc[entry.verdict] = (acc[entry.verdict] ?? 0) + 1;
  return acc;
}, {});

await writeFile(outJson, JSON.stringify({ verdicts, entries: audit }, null, 1));
process.stderr.write(`\n${JSON.stringify(verdicts)}\n`);
for (const entry of audit.filter((e) => e.verdict === 'disagree').slice(0, 40)) {
  process.stderr.write(`  ${entry.name.slice(0, 60)}  ${entry.sitsIn} -> ${entry.saysItIs}\n`);
}
process.stderr.write(`Written ${outJson}\n`);
