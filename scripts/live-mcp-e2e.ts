#!/usr/bin/env bun
/**
 * End-to-end live test: spawn the pCloud MCP server over stdio,
 * initialize the protocol, and call every tool. Cleans up after itself.
 *
 *   bun run scripts/live-mcp-e2e.ts
 */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

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
const results: Array<{ tool: string; ok: boolean; result?: unknown; error?: string }> = [];

async function call(tool: string, args: Record<string, unknown>, expectError = false) {
  try {
    const r = await client.callTool({ name: tool, arguments: args });
    const ok = expectError ? Boolean(r.isError) : !r.isError;
    if (ok) pass++; else fail++;
    results.push({ tool, ok, result: r });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tool}`, JSON.stringify(args));
    if (!ok) console.log('  error:', JSON.stringify(r.content).slice(0, 200));
    return r;
  } catch (e) {
    fail++;
    results.push({ tool, ok: false, error: String(e) });
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

  // 4) getfilelink — probe with a known-bad fileid on purpose: the call must
  //    come back as a clean isError result (2009), proving the protocol
  //    round-trips and errors are surfaced, not swallowed.
  await call('getfilelink', { fileid: 999999999 }, true);

  // 5) uploadfile → getfilelink → deletefile on a tiny temp file, then
  //    deletefolderrecursive on the test folder (deletefile rejects folderid;
  //    the folder must go through the folder-deletion tool).
  if (folderId !== undefined) {
    const tmp = `/tmp/mcp-e2e-${Date.now()}.txt`;
    await Bun.write(tmp, 'mcp-e2e');
    await call('uploadfile', { filePath: tmp, folderid: folderId, filename: 'e2e.txt' });
    await call('getfilelink', { path: `/${tag}/e2e.txt` });
    await call('deletefile', { path: `/${tag}/e2e.txt` });
    await call('deletefolderrecursive', { folderid: folderId });
    await Bun.write(tmp, '');
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp).catch(() => {});
  } else {
    console.log('SKIP upload/getfilelink/delete (no folder id)');
  }
} finally {
  await client.close();
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail === 0 ? 0 : 1);
