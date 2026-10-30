/**
 * Repairs the teaching-unit folders whose content does not match their name.
 *
 * The numbering of the units changed between the third and the fourth year:
 * a third-year folder numbered like a fourth-year one holds the wrong
 * material. The audit in scripts/pharmacie-audit-units.ts found these by
 * looking at what the files are about.
 *
 * Each repair merges a unit folder into the unit its content belongs to,
 * and every kind of material keeps its place inside the target unit.
 *
 * Usage: bun run scripts/pharmacie-fix-units.ts [inventory] [out]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface InvNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InvNode[];
}

interface FixOp {
  kind: 'folder' | 'file';
  id: number;
  from: string;
  toPath: string;
  toname: string;
}

interface FixPlan {
  ops: FixOp[];
}

/**
 * The unit folders whose content is about another unit, and where it
 * belongs. Each pair was read before being written down.
 */
const REPAIRS: Array<{ from: string; to: string; why: string }> = [
  {
    from: '/Pharmacie/3A/UE-08-PA',
    to: '/Pharmacie/3A/UE-02-PAM',
    why: 'third-year UE8 is pharmacognosie and therapeutic chemistry, not applied pharmacy',
  },
  {
    from: '/Pharmacie/3A/UE-01-OMS',
    to: '/Pharmacie/3A/UE-05-SNC',
    why: 'receptors, synapses and opioids are the nervous system',
  },
  {
    from: '/Pharmacie/3A/UE-10-BOTANIQUE',
    to: '/Pharmacie/3A/UE-09-MICROBIO',
    why: 'mycology and parasitology belong with microbiology',
  },
  {
    from: '/Pharmacie/3A/UE-04-PI',
    to: '/Pharmacie/3A/UE-01-OMS',
    why: 'immunology and immune checkpoints belong with oncology and clinical pharmacy',
  },
];

const inventoryPath = process.argv[2] ?? '/tmp/pharmacie-inventory-8.json';
const outJson = process.argv[3] ?? '/tmp/pharmacie-fix-units.json';

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

const byPath = new Map<string, InvNode>();
for (const dir of dirs) byPath.set(dir.path, dir);

const ops: FixOp[] = [];

for (const repair of REPAIRS) {
  const source = byPath.get(repair.from);
  const target = byPath.get(repair.to);
  if (!source || !target) {
    process.stderr.write(`Skipping ${repair.from}: source or target is missing\n`);
    continue;
  }

  // The kinds of material the target already holds, so nothing is overwritten.
  const targetChildren = new Set((target.children ?? []).map((c) => c.name));

  for (const child of source.children ?? []) {
    if (!child.isfolder) {
      const name = child.name;
      let candidate = name;
      let n = 2;
      while (targetChildren.has(candidate)) {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const extension = dot > 0 ? name.slice(dot) : '';
        candidate = `${stem} (${n++})${extension}`;
      }
      targetChildren.add(candidate);
      ops.push({
        kind: 'file',
        id: child.fileid!,
        from: child.path,
        toPath: repair.to,
        toname: candidate,
      });
      continue;
    }

    // A kind of material the target already holds is merged into it.
    if (targetChildren.has(child.name)) {
      const destination = (target.children ?? []).find((c) => c.name === child.name)!;
      for (const grandchild of child.children ?? []) {
        const name = grandchild.name;
        let candidate = name;
        let n = 2;
        while (targetChildren.has(candidate)) {
          const dot = name.lastIndexOf('.');
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const extension = dot > 0 ? name.slice(dot) : '';
          candidate = `${stem} (${n++})${extension}`;
        }
        targetChildren.add(candidate);
        ops.push({
          kind: grandchild.isfolder ? 'folder' : 'file',
          id: grandchild.isfolder ? grandchild.folderid! : grandchild.fileid!,
          from: grandchild.path,
          toPath: `${repair.to}/${destination.name}`,
          toname: candidate,
        });
      }
      continue;
    }

    targetChildren.add(child.name);
    ops.push({
      kind: 'folder',
      id: child.folderid!,
      from: child.path,
      toPath: repair.to,
      toname: child.name,
    });
  }
  process.stderr.write(`${repair.from} -> ${repair.to}: ${ops.length} operation(s) so far (${repair.why})\n`);
}

const plan: FixPlan = { ops };
await writeFile(outJson, JSON.stringify(plan, null, 1));
process.stderr.write(`Wrote ${outJson}: ${ops.length} operation(s)\n`);

if (process.argv[4] !== '--apply') process.exit(0);

const client = new PcloudHttpClient();
let applied = 0;
let failed = 0;
for (const op of ops) {
  const destination = byPath.get(op.toPath);
  if (!destination) {
    failed += 1;
    process.stderr.write(`  FAIL no destination ${op.toPath}\n`);
    continue;
  }
  try {
    await client.json(op.kind === 'folder' ? 'renamefolder' : 'renamefile', {
      ...(op.kind === 'folder' ? { folderid: op.id } : { fileid: op.id }),
      tofolderid: destination.folderid,
      toname: op.toname,
    });
    applied += 1;
  } catch (err) {
    failed += 1;
    process.stderr.write(`  FAIL ${op.id} ${op.from}: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
}
process.stderr.write(`Applied ${applied}, failed ${failed}\n`);
