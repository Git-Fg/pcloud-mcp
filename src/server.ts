import { McpServer } from '@modelcontextprotocol/server';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerPcloudTools } from './core/tools/index.js';
import { validateConfig } from './core/config.js';

type Pkg = { name?: string; version?: string; description?: string };

function readPkg(): Pkg {
  // Walk up from this module's directory to the nearest package.json. Robust
  // against any layout (source, dist, tests, future moves) — the previous
  // join(..., '..', '..', 'package.json') silently read the user's home dir
  // when running from src/ and the user's parent dir when running from dist/.
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf-8'));
      } catch {
        return {};
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

export function createServer(): McpServer {
  validateConfig();
  const pkg = readPkg();
  const server = new McpServer(
    { name: pkg.name ?? 'pcloud-mcp', version: pkg.version ?? '1.0.0' },
    { instructions: pkg.description ?? 'pCloud MCP server' }
  );
  registerPcloudTools(server);
  return server;
}