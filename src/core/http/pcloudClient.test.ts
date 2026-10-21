import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PcloudHttpClient, PcloudError } from './pcloudClient.js';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

let originalFetch: typeof globalThis.fetch;
let calls: { url: string; status: number; body: string; contentType?: string }[] = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  calls = [];
  globalThis.fetch = (async (_input: RequestInfo | URL) => {
    if (calls.length === 0) {
      // No scripted response: synthesize a default, helpful when assertions
      // about "exactly one fetch" are needed.
      return new Response(JSON.stringify({ result: 0 }), { status: 200 });
    }
    const next = calls[0];
    calls = calls.slice(1);
    if (next.body === 'NETWORK_ERROR') {
      throw new TypeError('fetch failed');
    }
    return new Response(next.body, {
      status: next.status,
      headers: next.contentType ? { 'Content-Type': next.contentType } : undefined,
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('PcloudHttpClient error handling', () => {
  it('throws PcloudError with hint on non-zero result code', async () => {
    const errBody = JSON.stringify({ result: 2004, error: 'already exists' });
    calls.push({ url: 'x', status: 200, body: errBody });
    calls.push({ url: 'x', status: 200, body: errBody });
    const client = new PcloudHttpClient();
    expect(client.json('createfolder', {})).rejects.toThrow(PcloudError);
    try {
      await client.json('createfolder', {});
      expect().fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PcloudError);
      const err = e as PcloudError;
      expect(err.result).toBe(2004);
      expect(err.error).toBe('already exists');
      expect(err.hint).toContain('already exists');
      expect(err.message).toContain('Hint');
    }
  });

  it('attaches the catalogued hint for trash_token_provenance (code 1000)', async () => {
    calls.push({
      url: 'x',
      status: 200,
      body: JSON.stringify({ result: 1000, error: 'Log in required' }),
    });
    const client = new PcloudHttpClient();
    try {
      await client.json('trash_list', {});
      expect().fail('expected throw');
    } catch (e) {
      expect((e as PcloudError).hint).toContain('OAuth');
    }
  });

  it('returns the data on the happy path', async () => {
    calls.push({
      url: 'x',
      status: 200,
      body: JSON.stringify({ result: 0, metadata: { name: 'a', isfolder: false } }),
    });
    const client = new PcloudHttpClient();
    const out = (await client.json('stat', {})) as {
      result: number;
      metadata: { name: string };
    };
    expect(out.result).toBe(0);
    expect(out.metadata.name).toBe('a');
  });

  it('throws on permanent 4xx without retrying', async () => {
    calls.push({ url: 'x', status: 400, body: 'bad request' });
    const client = new PcloudHttpClient();
    await expect(client.json('stat', {})).rejects.toThrow(/400/);
    // exactly one fetch, no retry consumed from the queue
    expect(calls).toHaveLength(0);
  });

  it('retries 429 then throws after maxRetries', async () => {
    calls = [
      { url: 'x', status: 429, body: 'rate limited' },
      { url: 'x', status: 429, body: 'rate limited' },
      { url: 'x', status: 429, body: 'rate limited' },
      { url: 'x', status: 429, body: 'rate limited' },
    ];
    const client = new PcloudHttpClient();
    await expect(client.json('listfolder', {})).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('retries 5xx then throws after maxRetries', async () => {
    calls = [
      { url: 'x', status: 503, body: 'service unavailable' },
      { url: 'x', status: 503, body: 'service unavailable' },
      { url: 'x', status: 503, body: 'service unavailable' },
      { url: 'x', status: 503, body: 'service unavailable' },
    ];
    const client = new PcloudHttpClient();
    await expect(client.json('listfolder', {})).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('retries on network failure and eventually throws if all attempts fail', async () => {
    calls = Array(4).fill({
      url: 'x',
      status: 200,
      body: 'NETWORK_ERROR',
    });
    const client = new PcloudHttpClient();
    await expect(client.json('listfolder', {})).rejects.toThrow();
  });
});

describe('PcloudError class', () => {
  it('exposes name, result, error, hint and extends Error', () => {
    const e = new PcloudError(2004, 'already exists');
    expect(e.name).toBe('PcloudError');
    expect(e.result).toBe(2004);
    expect(e.error).toBe('already exists');
    expect(e.hint).toBeTruthy();
    expect(e instanceof Error).toBe(true);
    expect(e instanceof PcloudError).toBe(true);
  });
});
