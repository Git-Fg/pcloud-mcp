import { McpServer } from '@modelcontextprotocol/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerPcloudTools } from './core/tools/index.js';
import { validateConfig } from './core/config.js';

const PKG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'package.json'
);

function readPkg(): { name?: string; version?: string; description?: string } {
  try {
    return JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  } catch {
    return {};
  }
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