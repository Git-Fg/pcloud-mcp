import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from '../server.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

/**
 * Creates the HTTP app using SDK v2's createMcpHandler + toNodeHandler.
 * The SDK handles all the Streamable HTTP protocol details internally.
 */
export function createHttpApp(): express.Application {
  const app = express();

  // Security: bind to loopback by default
  const BIND_ADDRESS = process.env.BIND_ADDRESS || '127.0.0.1';
  const PORT = parseInt(process.env.PORT || '3000', 10);
  
  // Host header allowlist (DNS rebinding defense)
  const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
    ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim())
    : [
        `localhost:${PORT}`,
        `127.0.0.1:${PORT}`,
        `[::1]:${PORT}`,
        'localhost',
        '127.0.0.1',
        '[::1]',
      ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.get('host') || '';
    if (!ALLOWED_HOSTS.some(allowed => allowed === host)) {
      res.status(421).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Host not allowed' },
        id: null
      });
      return;
    }
    next();
  });

  // CORS: deny by default, explicit opt-in
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
      return;
    } else if (ALLOWED_ORIGINS.includes('null') && origin === 'null') {
      res.setHeader('Access-Control-Allow-Origin', 'null');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
      return;
    } else if (origin) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'CORS origin not allowed' },
        id: null
      });
      return;
    }
    next();
  });

  // Health endpoint (before body parser, no body needed)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'pcloud-mcp' });
  });

  // The HTTP transport holds the account's static token; require either a
  // loopback bind or an explicit bearer token before serving MCP traffic.
  if (BIND_ADDRESS !== '127.0.0.1' && BIND_ADDRESS !== 'localhost' && BIND_ADDRESS !== '::1') {
    if (!process.env.MCP_BEARER_TOKEN) {
      throw new Error(
        `Refusing to bind ${BIND_ADDRESS} without MCP_BEARER_TOKEN. ` +
        `Either set BIND_ADDRESS=127.0.0.1 (loopback) or set MCP_BEARER_TOKEN.`
      );
    }
  }

  const mcpHandler = createMcpHandler(() => createServer());
  const nodeHandler = toNodeHandler(mcpHandler);
  const requiredBearer = process.env.MCP_BEARER_TOKEN;

  app.all('/mcp', (req, res, next) => {
    if (requiredBearer) {
      const auth = req.get('authorization') ?? '';
      if (auth !== `Bearer ${requiredBearer}`) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Unauthorized' },
          id: null,
        });
        return;
      }
    }
    nodeHandler(req, res, next);
  });

  if (BIND_ADDRESS !== '127.0.0.1' && BIND_ADDRESS !== 'localhost') {
    console.error(
      `WARNING: Binding to ${BIND_ADDRESS} exposes the server to network. ` +
      `MCP_BEARER_TOKEN is required when BIND_ADDRESS is not loopback.`
    );
  }

  return app;
}

/**
 * Main entry point for HTTP mode.
 */
export async function main(): Promise<void> {
  const app = createHttpApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.BIND_ADDRESS || '127.0.0.1';

  app.listen(PORT, HOST, () => {
    console.error(`pCloud MCP Server running on http://${HOST}:${PORT}/mcp`);
    console.error(`Health check: http://${HOST}:${PORT}/health`);
  });
}

// Run if executed directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('http.js');

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error in HTTP server:', error);
    process.exit(1);
  });
}