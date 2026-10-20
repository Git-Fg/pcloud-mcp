#!/usr/bin/env bun
/**
 * End-to-end live test: spawn the pCloud MCP server over stdio,
 * initialize the protocol, and call every tool. Cleans up after itself.
 *
 *   bun run scripts/live-mcp-e2e.ts
 */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = process.env.PCLOUD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('PCLOUD_ACCESS_TOKEN must be set for live E2E.');
  process.exit(2);
}

const transport = new StdioClientTransport({
  command: 'bun',
  args: ['run', 'src/index.ts'],
  env: { ...process.env, PCLOUD_ACCESS_TOKEN: TOKEN },
  cwd: process.cwd(),
});

const client = new Client(
  { name: 'pcloud-mcp-e2e', version: '0.0.1' },
  { capabilities: {} }
);
await client.connect(transport);

let pass = 0;
let fail = 0;
let tmpDir: string | undefined;

async function call(tool: string, args: Record<string, unknown>, expectError = false) {
  try {
    const r = await client.callTool({ name: tool, arguments: args });
    const ok = expectError ? Boolean(r.isError) : !r.isError;
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tool}`, JSON.stringify(args));
    if (!ok) console.log('  error:', JSON.stringify(r.content).slice(0, 200));
    return r;
  } catch (e) {
    fail++;
    console.log(`FAIL ${tool} (exception)`, String(e).slice(0, 200));
    return null;
  }
}

try {
  // 1) userinfo
  const ui = await call('userinfo', {});
  const payload = (ui?.structuredContent ?? {}) as { result?: number; userid?: number; email?: string };
  console.log('  userinfo ->', JSON.stringify({ result: payload.result, userid: payload.userid, email: payload.email }));

  // 2) listfolder (root)
  await call('listfolder', { folderid: 0 });

  // 3) createfolder
  const tag = `mcp-e2e-${Date.now()}`;
  const cr = await call('createfolder', { folderid: 0, name: tag });
  const meta = (cr?.structuredContent as { metadata?: { folderid?: number; path?: string } })?.metadata;
  const folderId = meta?.folderid;
  console.log('  createfolder ->', JSON.stringify({ folderid: folderId, path: meta?.path }));

  // 4) getfilelink, probe with a known-bad fileid on purpose: the call must
  //    come back as a clean isError result (2009), proving the protocol
  //    round-trips and errors are surfaced, not swallowed.
  await call('getfilelink', { fileid: 999999999 }, true);

  // 5) uploadfile → getfilelink → deletefile on a tiny temp file, then
  //    deletefolderrecursive on the test folder (deletefile rejects folderid;
  //    the folder must go through the folder-deletion tool).
  if (folderId !== undefined) {
    tmpDir = mkdtempSync(join(tmpdir(), 'pcloud-mcp-e2e-'));
    const tmp = join(tmpDir, 'e2e.txt');
    await Bun.write(tmp, 'mcp-e2e');
    await call('uploadfile', { filePath: tmp, folderid: folderId, filename: 'e2e.txt' });
    // pCloud's path index propagates a fresh upload lazily: a path lookup in the
    // first seconds can return 2009 even though the file exists (a fileid lookup
    // or a retry seconds later succeeds). Retry the path-based getfilelink
    // instead of asserting on the propagation timing; count only the outcome.
    let linked = false;
    let lastErr = '';
    let linkedAttempt = 0;
    for (let attempt = 1; attempt <= 5 && !linked; attempt++) {
      try {
        const r = await client.callTool({ name: 'getfilelink', arguments: { path: `/${tag}/e2e.txt` } });
        linked = !r.isError;
        if (linked) {
          linkedAttempt = attempt;
        } else {
          lastErr = JSON.stringify(r.content).slice(0, 200);
          console.log(`  attempt ${attempt}/5 failed: ${lastErr}`);
        }
      } catch (e) {
        lastErr = String(e).slice(0, 200);
        console.log(`  attempt ${attempt}/5 threw: ${lastErr}`);
      }
      if (!linked && attempt < 5) await Bun.sleep(1500);
    }
    if (linked) {
      pass++;
      console.log(`PASS getfilelink (by path, ${linkedAttempt}/5 attempt${linkedAttempt === 1 ? '' : 's'})`, JSON.stringify({ path: `/${tag}/e2e.txt` }));
    } else {
      fail++;
      console.log('FAIL getfilelink (by path, after 5 attempts)', lastErr);
    }
    // pCloud's path index propagates a fresh delete lazily too, retry, counting only the outcome.
    let deleted = false;
    let delErr = '';
    let deletedAttempt = 0;
    for (let attempt = 1; attempt <= 5 && !deleted; attempt++) {
      try {
        const r = await client.callTool({ name: 'deletefile', arguments: { path: `/${tag}/e2e.txt` } });
        deleted = !r.isError;
        if (deleted) {
          deletedAttempt = attempt;
        } else {
          delErr = JSON.stringify(r.content).slice(0, 200);
          console.log(`  delete attempt ${attempt}/5 failed: ${delErr}`);
        }
      } catch (e) {
        delErr = String(e).slice(0, 200);
        console.log(`  delete attempt ${attempt}/5 threw: ${delErr}`);
      }
      if (!deleted && attempt < 5) await Bun.sleep(1500);
    }
    if (deleted) {
      pass++;
      console.log(`PASS deletefile (by path, ${deletedAttempt}/5 attempt${deletedAttempt === 1 ? '' : 's'})`, JSON.stringify({ path: `/${tag}/e2e.txt` }));
    } else {
      fail++;
      console.log('FAIL deletefile (by path, after 5 attempts)', delErr);
    }
    await call('deletefolderrecursive', { folderid: folderId });
  } else {
    console.log('SKIP upload/getfilelink/delete (no folder id)');
  }
} finally {
  if (tmpDir !== undefined) await rm(tmpDir, { recursive: true, force: true });
  await client.close();
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
