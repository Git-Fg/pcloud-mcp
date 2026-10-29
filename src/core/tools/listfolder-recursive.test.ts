import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

const TREE: Record<number, Array<Record<string, unknown>>> = {
  0: [
    { name: 'a.txt', isfolder: false, fileid: 1, size: 10 },
    { name: 'docs', isfolder: true, folderid: 2 },
  ],
  2: [
    { name: 'b.txt', isfolder: false, fileid: 3, size: 20 },
    { name: 'deep', isfolder: true, folderid: 4 },
  ],
  4: [{ name: 'c.txt', isfolder: false, fileid: 5, size: 30 }],
};

let originalFetch: typeof globalThis.fetch;
let requested: string[] = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  requested = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const folderid = Number(url.searchParams.get('folderid') ?? '0');
    requested.push(url.searchParams.toString());
    return new Response(
      JSON.stringify({
        result: 0,
        metadata: { path: '/', name: '/', isfolder: true, folderid, contents: TREE[folderid] ?? [] },
      }),
      { status: 200 }
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('listfolder recursive', () => {
  it('walks the subtree client-side and tags each entry with its full path', async () => {
    const { listfolderHandler } = await import('./listfolder.js');
    const r = await listfolderHandler({ folderid: 0, recursive: true, maxdepth: 5, limit: 100 }, undefined);
    const body = r.structuredContent as {
      contents: Array<{ name: string; path?: string }>;
      page: { total: number };
    };
    const paths = body.contents.map((c) => c.path);
    expect(paths).toEqual(['/a.txt', '/docs', '/docs/b.txt', '/docs/deep', '/docs/deep/c.txt']);
    expect(body.page.total).toBe(5);
  });

  it('never sends the server-side recursive flag, which pCloud rejects with 1101', async () => {
    const { listfolderHandler } = await import('./listfolder.js');
    await listfolderHandler({ folderid: 0, recursive: true, maxdepth: 2 }, undefined);
    expect(requested.every((q) => !q.includes('recursive='))).toBe(true);
  });

  it('stops descending at maxdepth', async () => {
    const { listfolderHandler } = await import('./listfolder.js');
    const r = await listfolderHandler({ folderid: 0, recursive: true, maxdepth: 1, limit: 100 }, undefined);
    const body = r.structuredContent as { contents: Array<{ path?: string }> };
    expect(body.contents.map((c) => c.path)).toEqual(['/a.txt', '/docs', '/docs/b.txt', '/docs/deep']);
  });

  it('leaves the non-recursive listing untouched', async () => {
    const { listfolderHandler } = await import('./listfolder.js');
    const r = await listfolderHandler({ folderid: 0 }, undefined);
    const body = r.structuredContent as { contents: Array<{ name: string }>; page: { total: number } };
    expect(body.contents).toHaveLength(2);
    expect(body.page.total).toBe(2);
  });
});
