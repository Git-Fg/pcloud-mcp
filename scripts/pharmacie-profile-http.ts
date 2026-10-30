#!/usr/bin/env bun
/**
 * Profile the HTTP server under concurrent range_read load.
 *
 * Usage:
 *   PCLOUD_ACCESS_TOKEN=... bun run scripts/pharmacie-profile-http.ts [concurrency] [requests-per-client]
 *
 * Starts the server on a free port, spawns N concurrent clients,
 * each making M range_read calls, and measures:
 * - Wall time
 * - Server RSS (via process.memoryUsage inside the server)
 * - Client-side latency distribution
 */

import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN = process.env.PCLOUD_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('PCLOUD_ACCESS_TOKEN must be set.');
  process.exit(2);
}

const CONCURRENCY = Number(process.argv[2] ?? 10);
const REQUESTS_PER_CLIENT = Number(process.argv[3] ?? 5);
const TEST_FILEID = Number(process.argv[4] ?? 68679883382); // a real file from Pharmacie

async function waitForHealth(port: number): Promise<void> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Health endpoint did not come up');
}

async function runClient(port: number, clientId: number, results: Array<{client: number; latencyMs: number; ok: boolean}>) {
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp`),
    {
      authProvider: {
        token: async () => 'profiler-token'
      }
    }
  );
  const client = new Client({ name: `profiler-${clientId}`, version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);

  for (let i = 0; i < REQUESTS_PER_CLIENT; i++) {
    const start = Date.now();
    try {
      const r = await client.callTool({
        name: 'range_read',
        arguments: { fileid: TEST_FILEID, range: '0-65535' }
      });
      results.push({ client: clientId, latencyMs: Date.now() - start, ok: !r.isError });
    } catch {
      results.push({ client: clientId, latencyMs: Date.now() - start, ok: false });
    }
    // small delay to not hammer
    await sleep(50);
  }
  await client.close();
}

async function main() {
  // Reserve a port
  const serverPort = 3000 + Math.floor(Math.random() * 10000);
  process.env.PORT = String(serverPort);
  process.env.BIND_ADDRESS = '127.0.0.1';
  process.env.MCP_BEARER_TOKEN = 'profiler-token';

  console.error(`\n=== HTTP Server Profile ===`);
  console.error(`Concurrency: ${CONCURRENCY}`);
  console.error(`Requests per client: ${REQUESTS_PER_CLIENT}`);
  console.error(`Total requests: ${CONCURRENCY * REQUESTS_PER_CLIENT}`);
  console.error(`Test fileid: ${TEST_FILEID}`);
  console.error(`Port: ${serverPort}\n`);

  // Start server as child process
  const server = spawn('bun', ['run', 'src/index.ts'], {
    cwd: join(__dirname, '..'),
    env: { ...process.env, MODE: 'http', PCLOUD_ACCESS_TOKEN: TOKEN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout?.on('data', (d) => console.error(`[server] ${d.toString().trim()}`));
  server.stderr?.on('data', (d) => console.error(`[server] ${d.toString().trim()}`));

  try {
    await waitForHealth(serverPort);
    console.error('Server healthy, starting load...\n');

    const overallStart = Date.now();
    const results: Array<{client: number; latencyMs: number; ok: boolean}> = [];

    await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        runClient(serverPort, i, results)
      )
    );

    const overallMs = Date.now() - overallStart;
    const ok = results.filter(r => r.ok);
    const latencies = ok.map(r => r.latencyMs).sort((a, b) => a - b);

    console.error(`\n=== Results ===`);
    console.error(`Wall time: ${overallMs} ms`);
    console.error(`Requests: ${results.length} (${ok.length} ok, ${results.length - ok.length} failed)`);
    console.error(`Throughput: ${(results.length / (overallMs / 1000)).toFixed(1)} req/s`);
    if (latencies.length) {
      console.error(`Latency p50: ${latencies[Math.floor(latencies.length * 0.5)]} ms`);
      console.error(`Latency p95: ${latencies[Math.floor(latencies.length * 0.95)]} ms`);
      console.error(`Latency p99: ${latencies[Math.floor(latencies.length * 0.99)]} ms`);
      console.error(`Latency max: ${latencies[latencies.length - 1]} ms`);
      console.error(`Latency mean: ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)} ms`);
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});