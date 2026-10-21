import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createServer } from '../server.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

/**
 * Creates the HTTP app using SDK v2's createMcpHandler + toNodeHandler.
 * The SDK handles all the Streamable HTTP protocol details internally.
 */
const LOOPBACK_ADDRESSES = ['127.0.0.1', 'localhost', '::1'] as const;

const isLoopback = (address: string): boolean =>
  (LOOPBACK_ADDRESSES as readonly string[]).includes(address);

function normalizeHost(host: string): string {
  // RFC 7230 §5.4: Host header is case-insensitive
  return host.toLowerCase();
}

function getAllowedHosts(): string[] {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  return process.env.ALLOWED_HOSTS
    ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
    : [
        `localhost:${PORT}`,
        `127.0.0.1:${PORT}`,
        `[::1]:${PORT}`,
        'localhost',
        '127.0.0.1',
        '[::1]',
      ];
}

// Simple in-memory rate limiter (per IP, sliding window)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 req/min per IP
const HEALTH_RATE_LIMIT_MAX_REQUESTS = 60; // 60 req/min per IP
const rateLimitStore = new Map<string, number[]>();

function rateLimit(ip: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const requests = rateLimitStore.get(ip) || [];
  const recent = requests.filter(ts => ts > windowStart);
  if (recent.length >= maxRequests) {
    return false;
  }
  recent.push(now);
  rateLimitStore.set(ip, recent);
  return true;
}

export function createHttpApp(): express.Application {
  const app = express();

  // Security: bind to loopback by default
  const BIND_ADDRESS = process.env.BIND_ADDRESS || '127.0.0.1';

  // Host header allowlist (DNS rebinding defense) - computed per-request
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = normalizeHost(req.get('host') || '');
    const allowedHosts = getAllowedHosts().map(normalizeHost);
    if (!allowedHosts.some(allowed => allowed === host)) {
      res.status(421).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Host not allowed' },
        id: null
      });
      return;
    }
    next();
  });

  // Rate limiting middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const isHealth = req.path === '/health';
    const maxRequests = isHealth ? HEALTH_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS;
    if (!rateLimit(ip, maxRequests)) {
      res.status(429).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Too many requests' },
        id: null
      });
      return;
    }
    next();
  });

  // CORS: deny by default, explicit opt-in
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
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

  // CORS preflight: when the request Origin is on the allowlist, answer
  // OPTIONS with the same CORS headers the GET/POST middleware would set,
  // plus the methods/headers a browser needs to know are permitted.
  app.options('/mcp', (req: Request, res: Response) => {
    const origin = req.get('origin');
    const allowedOrigin =
      origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS.includes('null') && origin === 'null'
          ? 'null'
          : null;
    if (allowedOrigin === null) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'CORS origin not allowed' },
        id: null,
      });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  // The HTTP transport holds the account's static token; require either a
  // loopback bind or an explicit bearer token before serving MCP traffic.
  if (!isLoopback(BIND_ADDRESS)) {
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

  if (!isLoopback(BIND_ADDRESS)) {
    console.error(
      `WARNING: Binding to ${BIND_ADDRESS} exposes the server to the network. ` +
      `MCP_BEARER_TOKEN is enforced for /mcp; /health stays unauthenticated.`
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
