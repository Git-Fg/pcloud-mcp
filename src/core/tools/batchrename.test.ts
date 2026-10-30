import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

let originalFetch: typeof globalThis.fetch;
let requests: string[] = [];
let failingFileids: Set<number>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  requests = [];
  failingFileids = new Set();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const params = new URL(url).searchParams;
    const fileid = Number(params.get('fileid'));
    if (failingFileids.has(fileid)) {
      return new Response(JSON.stringify({ result: 2009, error: 'File not found.' }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ result: 0, metadata: { fileid, name: params.get('toname'), isfolder: false } }),
      { status: 200 }
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('batchrename (mocked pCloud)', () => {
  it('applies every operation and reports the new fileids', async () => {
    const { batchrenameHandler } = await import('./batchrename.js');
    const r = await batchrenameHandler(
      {
        operations: [
          { fileid: 11, toname: 'UE-01-OMS - Cours.pdf', tofolderid: 42 },
          { fileid: 12, tofolderid: 43 },
        ],
      },
      undefined
    );
    const body = r.structuredContent as {
      result: number;
      applied: number;
      failed: number;
      results: Array<{ fileid: number; ok: boolean; newfileid?: number }>;
    };
    expect(body.result).toBe(0);
    expect(body.applied).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results[0].newfileid).toBe(11);
    expect(body.results[1].newfileid).toBe(12);
    expect(r.content[0].text).toContain('Applied 2');
  });

  it('dryrun issues no HTTP call and applies nothing', async () => {
    const { batchrenameHandler } = await import('./batchrename.js');
    const r = await batchrenameHandler(
      { operations: [{ fileid: 11, toname: 'x.pdf' }], dryrun: true },
      undefined
    );
    const body = r.structuredContent as { applied: number; failed: number };
    expect(body.applied).toBe(1);
    expect(body.failed).toBe(0);
    expect(requests).toHaveLength(0);
    expect(r.content[0].text).toContain('Dry run');
  });

  it('keeps going after a failure and reports it', async () => {
    const { batchrenameHandler } = await import('./batchrename.js');
    failingFileids = new Set([12]);
    const r = await batchrenameHandler(
      { operations: [{ fileid: 11 }, { fileid: 12 }, { fileid: 13 }] },
      undefined
    );
    const body = r.structuredContent as {
      applied: number;
      failed: number;
      results: Array<{ fileid: number; ok: boolean; error?: string }>;
    };
    expect(body.applied).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.results[1].ok).toBe(false);
    expect(body.results[1].error).toContain('2009');
  });

  it('sends toname and tofolderid as renamefile parameters', async () => {
    const { batchrenameHandler } = await import('./batchrename.js');
    await batchrenameHandler(
      { operations: [{ fileid: 11, toname: 'new.pdf', tofolderid: 42 }] },
      undefined
    );
    const sent = new URL(requests[0]).searchParams;
    expect(sent.get('fileid')).toBe('11');
    expect(sent.get('toname')).toBe('new.pdf');
    expect(sent.get('tofolderid')).toBe('42');
    expect(sent.get('access_token')).toBe('unit-test-token');
  });

  it('rejects an empty operations array', async () => {
    const { batchrenameHandler } = await import('./batchrename.js');
    await expect(batchrenameHandler({ operations: [] }, undefined)).rejects.toThrow();
  });
});
