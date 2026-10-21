import { describe, it, expect, afterEach } from 'bun:test';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

type Res = { status: number; body: string; headers: http.IncomingHttpHeaders };

/** Raw node:http request so the `Host` header can be spoofed (fetch forbids it). */
function request(port: number, path: string, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Reserves a port before the app is built, because the host allowlist is
 *  derived from PORT at createHttpApp() time, not per-request. */
function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

const servers: http.Server[] = [];

async function start(): Promise<number> {
  const port = await reservePort();
  process.env.PORT = String(port);
  const { createHttpApp } = await import('./http.js');
  const app = createHttpApp();
  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  servers.push(server);
  return port;
}

afterEach(async () => {
  delete process.env.PORT;
  delete process.env.MCP_BEARER_TOKEN;
  delete process.env.BIND_ADDRESS;
  delete process.env.ALLOWED_HOSTS;
  delete process.env.ALLOWED_ORIGINS;
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
  );
});

describe('http transport security', () => {
  it('serves /health without auth and sets no CORS header by default', async () => {
    const port = await start();
    const res = await request(port, '/health', { host: `127.0.0.1:${port}` });
    expect(res.status).toBe(200);
    expect(res.body).toContain('pcloud-mcp');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts localhost:<port> as a Host', async () => {
    const port = await start();
    const res = await request(port, '/health', { host: `localhost:${port}` });
    expect(res.status).toBe(200);
  });

  it('accepts a portless Host entry', async () => {
    const port = await start();
    const res = await request(port, '/health', { host: '127.0.0.1' });
    expect(res.status).toBe(200);
  });

  it('rejects a foreign Host header with 421 (DNS rebinding defence)', async () => {
    const port = await start();
    const allowed = await request(port, '/health', { host: `127.0.0.1:${port}` });
    const res = await request(port, '/health', { host: 'evil.example.com' });
    expect(allowed.status).toBe(200);
    expect(res.status).toBe(421);
    expect(res.body).toContain('Host not allowed');
  });

  it('honours an explicit ALLOWED_HOSTS override', async () => {
    process.env.ALLOWED_HOSTS = 'custom.example.com';
    const port = await start();
    const allowed = await request(port, '/health', { host: 'custom.example.com' });
    const rejected = await request(port, '/health', { host: `127.0.0.1:${port}` });
    expect(allowed.status).toBe(200);
    expect(rejected.status).toBe(421);
  });

  it('trims whitespace in ALLOWED_HOSTS entries', async () => {
    process.env.ALLOWED_HOSTS = '  custom.example.com  ,  other.example.com ';
    const port = await start();
    const allowed = await request(port, '/health', { host: 'custom.example.com' });
    const alsoAllowed = await request(port, '/health', { host: 'other.example.com' });
    expect(allowed.status).toBe(200);
    expect(alsoAllowed.status).toBe(200);
  });

  it('filters empty ALLOWED_HOSTS segments so a hostless request cannot bypass the gate', async () => {
    process.env.ALLOWED_HOSTS = ',';
    const port = await start();
    const hostless = await request(port, '/health', {});
    const emptyHost = await request(port, '/health', { host: '' });
    const validHost = await request(port, '/health', { host: `127.0.0.1:${port}` });
    expect(hostless.status).toBe(421);
    expect(emptyHost.status).toBe(421);
    expect(validHost.status).toBe(421);
  });

  it('accepts case-insensitive Host header per RFC 7230', async () => {
    const port = await start();
    const res = await request(port, '/health', { host: `LOCALHOST:${port}` });
    expect(res.status).toBe(200);
  });

  it('rejects a disallowed CORS origin with 403', async () => {
    const port = await start();
    const res = await request(port, '/health', {
      host: `127.0.0.1:${port}`,
      origin: 'https://evil.example.com',
    });
    expect(res.status).toBe(403);
    expect(res.body).toContain('CORS origin not allowed');
  });

  it('echoes an explicitly allowed CORS origin', async () => {
    process.env.ALLOWED_ORIGINS = 'https://ok.example.com';
    const port = await start();
    const res = await request(port, '/health', {
      host: `127.0.0.1:${port}`,
      origin: 'https://ok.example.com',
    });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://ok.example.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows a null Origin only when explicitly opted in', async () => {
    process.env.ALLOWED_ORIGINS = 'null';
    const port = await start();
    const res = await request(port, '/health', { host: `127.0.0.1:${port}`, origin: 'null' });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('null');
  });

  it('filters empty ALLOWED_ORIGINS segments', async () => {
    process.env.ALLOWED_ORIGINS = ',https://ok.example.com,';
    const port = await start();
    const allowed = await request(port, '/health', {
      host: `127.0.0.1:${port}`,
      origin: 'https://ok.example.com',
    });
    const emptyOrigin = await request(port, '/health', {
      host: `127.0.0.1:${port}`,
      origin: '',
    });
    expect(allowed.status).toBe(200);
    expect(emptyOrigin.status).toBe(200);
  });

  it('rejects a null Origin by default', async () => {
    const port = await start();
    const res = await request(port, '/health', { host: `127.0.0.1:${port}`, origin: 'null' });
    expect(res.status).toBe(403);
  });

  it('requires the bearer token on /mcp when MCP_BEARER_TOKEN is set', async () => {
    process.env.MCP_BEARER_TOKEN = 'secret-token';
    const port = await start();
    const res = await request(port, '/mcp', { host: `127.0.0.1:${port}` });
    expect(res.status).toBe(401);
    expect(res.body).toContain('Unauthorized');
  });

  it('rejects a wrong bearer token on /mcp', async () => {
    process.env.MCP_BEARER_TOKEN = 'secret-token';
    const port = await start();
    const res = await request(port, '/mcp', {
      host: `127.0.0.1:${port}`,
      authorization: 'Bearer wrong',
    });
    expect(res.status).toBe(401);
  });

  it('opens the gate for a correct bearer token', async () => {
    process.env.MCP_BEARER_TOKEN = 'secret-token';
    const port = await start();
    const res = await request(port, '/mcp', {
      host: `127.0.0.1:${port}`,
      authorization: 'Bearer secret-token',
    });
    expect(res.status).not.toBe(401);
  });

  it('passes /mcp through to the SDK when the bearer gate is off (loopback, no token)', async () => {
    const port = await start();
    const res = await request(port, '/mcp', { host: `127.0.0.1:${port}` });
    expect(res.status).not.toBe(401);
  });

  it('treats ::1 as loopback: no throw and no warning', async () => {
    process.env.BIND_ADDRESS = '::1';
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };
    try {
      const { createHttpApp } = await import('./http.js');
      expect(() => createHttpApp()).not.toThrow();
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(0);
  });

  it('refuses to build a non-loopback app without MCP_BEARER_TOKEN', async () => {
    process.env.BIND_ADDRESS = '0.0.0.0';
    const { createHttpApp } = await import('./http.js');
    expect(() => createHttpApp()).toThrow(/MCP_BEARER_TOKEN/);
  });

  it('allows a non-loopback bind when MCP_BEARER_TOKEN is set, and warns', async () => {
    process.env.BIND_ADDRESS = '0.0.0.0';
    process.env.MCP_BEARER_TOKEN = 'secret-token';
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    };
    try {
      const { createHttpApp } = await import('./http.js');
      expect(() => createHttpApp()).not.toThrow();
    } finally {
      console.error = original;
    }
    expect(errors.some((e) => e.includes('WARNING: Binding to 0.0.0.0'))).toBe(true);
  });
});
