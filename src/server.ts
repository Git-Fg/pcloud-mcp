import { McpServer } from '@modelcontextprotocol/server';
import { registerPcloudTools } from './core/tools/index.js';
import { validateConfig } from './core/config.js';
import { readPkgFromHere } from './core/pkg.js';

export function createServer(): McpServer {
  validateConfig();
  const pkg = readPkgFromHere();
  const server = new McpServer(
    { name: pkg.name ?? 'pcloud-mcp', version: pkg.version ?? '1.0.0' },
    { instructions: pkg.description ?? 'pCloud MCP server' }
  );
  registerPcloudTools(server);
  return server;
}
