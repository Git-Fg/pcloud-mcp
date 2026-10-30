import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

const TREE: Record<number, Array<Record<string, unknown>>> = {
  0: [
    { name: 'a.txt', isfolder: false, fileid: 1, size: 10, hash: 111, contenttype: 'text/plain', modified: 'Sun, 18 Oct 2026 19:00:00 +0000' },
    { name: 'docs', isfolder: true, folderid: 2 },
  ],
  2: [
    { name: 'b.txt', isfolder: false, fileid: 3, size: 20, hash: 222, contenttype: 'text/plain' },
    { name: 'deep', isfolder: true, folderid: 4 },
  ],
  4: [{ name: 'c.txt', isfolder: false, fileid: 5, size: 10, hash: 111 }],
};

let originalFetch: typeof globalThis.fetch;
let requestedUrls: string[];
let rangeHeaders: Array<string | null>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  requestedUrls = [];
  rangeHeaders = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requestedUrls.push(url.pathname + url.search);

    if (url.pathname.endsWith('/listfolder')) {
      const folderid = Number(url.searchParams.get('folderid') ?? '0');
      return new Response(
        JSON.stringify({
          result: 0,
          metadata: { path: '/', name: '/', isfolder: true, folderid, contents: TREE[folderid] ?? [] },
        }),
        { status: 200 }
      );
    }

    if (url.pathname.endsWith('/getfilelink')) {
      return new Response(
        JSON.stringify({ result: 0, hosts: ['host.pcloud.com'], path: '/download/file' }),
        { status: 200 }
      );
    }

    if (url.pathname.endsWith('/checksumfile')) {
      const fileid = Number(url.searchParams.get('fileid'));
      const sha1 = fileid === 1 || fileid === 5 ? 'aaaa' : 'bbbb';
      return new Response(JSON.stringify({ result: 0, sha1 }), { status: 200 });
    }

    if (url.pathname.endsWith('/stat')) {
      const fileid = Number(url.searchParams.get('fileid'));
      return new Response(
        JSON.stringify({ result: 0, metadata: { fileid, hash: 111, size: 10 } }),
        { status: 200 }
      );
    }

    // The content server: serves the bytes of the file.
    const headers = new Headers(init?.headers);
    rangeHeaders.push(headers.get('range'));
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    return new Response(body, {
      status: 206,
      headers: {
        'content-type': 'application/pdf',
        'content-range': `bytes 0-4/${body.length}`,
      },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('list_recursive', () => {
  it('walks the subtree and returns the compact curation fields', async () => {
    const { listRecursiveHandler } = await import('./list-recursive.js');
    const r = await listRecursiveHandler({ folderid: 0, maxdepth: 5, limit: 100 }, undefined);
    const body = r.structuredContent as {
      files: Array<{ fileid: number; path: string; size?: number; hash?: number; contenttype?: string }>;
      page: { total: number };
    };

    expect(body.page.total).toBe(3);
    expect(body.files.map((f) => f.path)).toEqual(['/a.txt', '/docs/b.txt', '/docs/deep/c.txt']);
    expect(body.files[0]).toMatchObject({
      fileid: 1,
      size: 10,
      hash: 111,
      contenttype: 'text/plain',
    });
  });

  it('never sends the server-side recursive flag, which pCloud rejects with 1101', async () => {
    const { listRecursiveHandler } = await import('./list-recursive.js');
    await listRecursiveHandler({ folderid: 0, maxdepth: 3 }, undefined);
    expect(requestedUrls.every((u) => !u.includes('recursive='))).toBe(true);
  });

  it('returns folders only when asked', async () => {
    const { listRecursiveHandler } = await import('./list-recursive.js');
    const without = await listRecursiveHandler({ folderid: 0, maxdepth: 5 }, undefined);
    expect((without.structuredContent as { folders?: unknown[] }).folders).toBeUndefined();

    const with_ = await listRecursiveHandler({ folderid: 0, maxdepth: 5, includeFolders: true }, undefined);
    const folders = (with_.structuredContent as { folders: Array<{ folderid: number }> }).folders;
    expect(folders.map((f) => f.folderid)).toEqual([2, 4]);
  });
});

describe('range_read', () => {
  it('sends a Range header and returns the bytes base64-encoded', async () => {
    const { rangeReadHandler } = await import('./range-read.js');
    const r = await rangeReadHandler({ fileid: 1, range: '0-65535' }, undefined);
    const body = r.structuredContent as {
      bytes: number;
      base64: string;
      contentType: string;
      totalSize?: number;
    };

    expect(rangeHeaders[0]).toBe('bytes=0-65535');
    expect(body.bytes).toBe(5);
    expect(body.contentType).toBe('application/pdf');
    expect(body.totalSize).toBe(5);
    expect(Buffer.from(body.base64, 'base64')).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('never returns the signed download URL', async () => {
    const { rangeReadHandler } = await import('./range-read.js');
    const r = await rangeReadHandler({ fileid: 1 }, undefined);
    const serialised = JSON.stringify(r.structuredContent);
    expect(serialised).not.toContain('host.pcloud.com');
  });

  it('stops at maxBytes even when the server sends more', async () => {
    const { rangeReadHandler } = await import('./range-read.js');
    const r = await rangeReadHandler({ fileid: 1, maxBytes: 2 }, undefined);
    const body = r.structuredContent as { bytes: number; truncated: boolean };
    expect(body.bytes).toBe(2);
    expect(body.truncated).toBe(true);
  });
});

describe('checksum_group', () => {
  it('groups by hash and size, and asks checksumfile once per group', async () => {
    const { checksumGroupHandler } = await import('./checksum-group.js');
    const r = await checksumGroupHandler(
      {
        files: [
          { fileid: 1, size: 10, hash: 111 },
          { fileid: 5, size: 10, hash: 111 },
          { fileid: 3, size: 20, hash: 222 },
        ],
      },
      undefined
    );
    const body = r.structuredContent as {
      digests: Record<string, string>;
      duplicates: Array<{ sha1: string; fileids: number[]; count: number }>;
      stats: { apiCalls: number; redundantCopies: number };
    };

    // Two candidate groups, but only the one holding several files is worth
    // a call: one call for the pair, none for the file that stands alone.
    expect(body.stats.apiCalls).toBe(1);
    expect(body.digests['1']).toBe('aaaa');
    expect(body.digests['5']).toBe('aaaa');
    expect(body.digests['3']).toBeUndefined();
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0].fileids.sort()).toEqual([1, 5]);
    expect(body.stats.redundantCopies).toBe(1);
  });

  it('leaves a singleton unchecksummed unless asked', async () => {
    const { checksumGroupHandler } = await import('./checksum-group.js');
    const r = await checksumGroupHandler(
      { files: [{ fileid: 3, size: 20, hash: 222 }] },
      undefined
    );
    const body = r.structuredContent as { digests: Record<string, string>; stats: { apiCalls: number } };
    expect(body.stats.apiCalls).toBe(0);
    expect(body.digests['3']).toBeUndefined();
  });

  it('checksums a singleton when asked to', async () => {
    const { checksumGroupHandler } = await import('./checksum-group.js');
    const r = await checksumGroupHandler(
      { files: [{ fileid: 3, size: 20, hash: 222 }], includeSingletons: true },
      undefined
    );
    const body = r.structuredContent as { digests: Record<string, string> };
    expect(body.digests['3']).toBe('bbbb');
  });

  it('fetches the hash of a file that was given without one', async () => {
    const { checksumGroupHandler } = await import('./checksum-group.js');
    const r = await checksumGroupHandler({ files: [{ fileid: 1 }, { fileid: 5 }] }, undefined);
    const body = r.structuredContent as { digests: Record<string, string>; stats: { apiCalls: number } };
    // Both stat calls put them in the same group, so one checksumfile call.
    expect(body.digests['1']).toBe('aaaa');
    expect(body.digests['5']).toBe('aaaa');
  });
});
