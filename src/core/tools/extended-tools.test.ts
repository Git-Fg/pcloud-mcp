import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

// Live-shaped pCloud fixtures. isfolder is a real boolean, timestamps are
// RFC-822, and listfolder nests contents inside metadata (per the live API).

const CANNED: Record<string, unknown> = {
  stat: {
    result: 0,
    metadata: {
      name: 'doc.md',
      path: '/docs/doc.md',
      isfolder: false,
      fileid: 1,
      size: 12,
      created: 'Sun, 18 Oct 2026 19:00:00 +0000',
      modified: 'Sun, 18 Oct 2026 19:00:00 +0000',
    },
  },
  getfilelink: {
    result: 0,
    hosts: ['edef6.pcloud.com'],
    path: '/DLfake/token',
  },
  listrevisions: {
    result: 0,
    metadata: { name: 'doc.md', fileid: 1, isfolder: false },
    revisions: [
      { revisionid: 2, size: 12, hash: 'abc', created: 'Sun, 18 Oct 2026 19:00:00 +0000' },
      { revisionid: 1, size: 10, hash: 'def', created: 'Sat, 17 Oct 2026 18:00:00 +0000' },
    ],
  },
  renamefile: {
    result: 0,
    metadata: { name: 'moved.txt', path: '/moved.txt', fileid: 9, isfolder: false },
  },
  renamefolder: {
    result: 0,
    metadata: { name: 'renamed', path: '/renamed', folderid: 5, isfolder: true },
  },
  deletefolderrecursive: {
    result: 0,
    deletedfiles: 3,
    deletedfolders: 1,
  },
};

let originalFetch: typeof globalThis.fetch;
let calls: string[] = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const endpoint = new URL(url).pathname.replace(/^\//, '');
    calls.push(endpoint);
    if (endpoint.startsWith('DL')) {
      return new Response('hello readfile', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    if (endpoint === 'deletefolderrecursive') {
      return new Response(JSON.stringify(CANNED.deletefolderrecursive), { status: 200 });
    }
    if (endpoint === 'gettextfile' || endpoint === 'getfilelink') {
      // readfile calls getfilelink first then fetches the URL.
      if (endpoint === 'getfilelink') {
        return new Response(JSON.stringify(CANNED.getfilelink), { status: 200 });
      }
      return new Response('hello readfile', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    if (endpoint === 'listrevisions') {
      return new Response(JSON.stringify(CANNED.listrevisions), { status: 200 });
    }
    if (endpoint === 'stat') {
      return new Response(JSON.stringify(CANNED.stat), { status: 200 });
    }
    if (endpoint === 'renamefile') {
      return new Response(JSON.stringify(CANNED.renamefile), { status: 200 });
    }
    if (endpoint === 'renamefolder') {
      return new Response(JSON.stringify(CANNED.renamefolder), { status: 200 });
    }
    if (endpoint === 'uploadfile') {
      return new Response(
        JSON.stringify({
          result: 0,
          fileids: [12345],
          metadata: [{ name: 'up.txt', fileid: 12345, isfolder: false, size: 6 }],
        }),
        { status: 200 }
      );
    }
    if (endpoint === 'uploadtolink') {
      return new Response(
        JSON.stringify({
          result: 0,
          fileids: [12345],
          metadata: [{ name: 'up.txt', fileid: 12345, isfolder: false, size: 6 }],
        }),
        { status: 200 }
      );
    }
    if (endpoint === 'deletefile' || endpoint === 'deletefolder') {
      return new Response(JSON.stringify({ result: 0, metadata: {} }), { status: 200 });
    }
    const body = CANNED[endpoint] ?? { result: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('extended tools (mocked pCloud)', () => {
  it('stat by fileid returns metadata', async () => {
    const { statHandler } = await import('./stat.js');
    const r = await statHandler({ fileid: 1 }, undefined);
    const body = r.structuredContent as { result: number; metadata: { name: string; isfolder: boolean } };
    expect(body.result).toBe(0);
    expect(body.metadata.name).toBe('doc.md');
    expect(body.metadata.isfolder).toBe(false);
  });

  it('stat rejects when both fileid and path are given', async () => {
    const { statHandler } = await import('./stat.js');
    await expect(statHandler({ fileid: 1, path: '/x' }, undefined)).rejects.toThrow();
  });

  it('readfile does getfilelink then fetches the content URL', async () => {
    const { readfileHandler } = await import('./readfile.js');
    const r = await readfileHandler({ fileid: 1, maxBytes: 100 }, undefined);
    const body = r.structuredContent as { bytes: number; content: string; truncated: boolean };
    expect(body.bytes).toBe('hello readfile'.length);
    expect(body.content).toBe('hello readfile');
    expect(body.truncated).toBe(false);
    expect('url' in body).toBe(false);
    expect(calls).toContain('getfilelink');
  });

  it('readfile truncates at maxBytes and stops downloading', async () => {
    const { readfileHandler } = await import('./readfile.js');
    const r = await readfileHandler({ fileid: 1, maxBytes: 5 }, undefined);
    const body = r.structuredContent as { bytes: number; content: string; truncated: boolean };
    expect(body.bytes).toBe(5);
    expect(body.content).toBe('hello');
    expect(body.truncated).toBe(true);
  });

  it('listrevisions returns the revisions array', async () => {
    const { listrevisionsHandler } = await import('./listrevisions.js');
    const r = await listrevisionsHandler({ fileid: 1 }, undefined);
    const body = r.structuredContent as { result: number; revisions: Array<{ revisionid: number }> };
    expect(body.result).toBe(0);
    expect(body.revisions.length).toBe(2);
    expect(body.revisions[0].revisionid).toBe(2);
  });

  it('renamefile with tofolderid+toname succeeds', async () => {
    const { renamefileHandler } = await import('./renamefile.js');
    const r = await renamefileHandler(
      { fileid: 9, tofolderid: 0, toname: 'moved.txt' },
      undefined
    );
    const body = r.structuredContent as { result: number; metadata: { name: string } };
    expect(body.result).toBe(0);
    expect(body.metadata.name).toBe('moved.txt');
  });

  it('renamefile rejects without a destination', async () => {
    const { renamefileHandler } = await import('./renamefile.js');
    await expect(renamefileHandler({ fileid: 9 }, undefined)).rejects.toThrow(/destination/i);
  });

  it('renamefile rejects with two source identifiers', async () => {
    const { renamefileHandler } = await import('./renamefile.js');
    await expect(
      renamefileHandler({ fileid: 9, path: '/x', tofolderid: 0, toname: 'y' }, undefined)
    ).rejects.toThrow(/fileid or path/i);
  });

  it('renamefolder with toname succeeds', async () => {
    const { renamefolderHandler } = await import('./renamefolder.js');
    const r = await renamefolderHandler({ folderid: 5, toname: 'renamed' }, undefined);
    const body = r.structuredContent as { result: number; metadata: { name: string; isfolder: boolean } };
    expect(body.result).toBe(0);
    expect(body.metadata.name).toBe('renamed');
    expect(body.metadata.isfolder).toBe(true);
  });

  it('uploadfile streams a multipart POST and returns the new fileids', async () => {
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'pcloud-test-'));
    const filePath = join(dir, 'up.txt');
    writeFileSync(filePath, 'hello\n');
    const { uploadfileHandler } = await import('./uploadfile.js');
    const r = await uploadfileHandler({ filePath, folderid: 0 }, undefined);
    const body = r.structuredContent as { result: number; fileids?: number[] };
    expect(body.result).toBe(0);
    expect(body.fileids?.[0]).toBe(12345);
    expect(calls).toContain('uploadfile');
  });

  it('deletefolderrecursive reports deleted files and folders', async () => {
    const { deletefolderrecursiveHandler } = await import('./deletefolderrecursive.js');
    const r = await deletefolderrecursiveHandler({ folderid: 5 }, undefined);
    const body = r.structuredContent as { result: number; deletedfiles: number; deletedfolders: number };
    expect(body.result).toBe(0);
    expect(body.deletedfiles).toBe(3);
    expect(body.deletedfolders).toBe(1);
  });

  it('PcloudError carries an actionable hint for known codes', async () => {
    const { PcloudError } = await import('../http/pcloudClient.js');
    const e = new PcloudError(4000, 'Too many login tries from this IP address.');
    expect(e.result).toBe(4000);
    expect(e.hint).toMatch(/per-IP/i);
    expect(e.message).toContain('Hint:');
  });
});
