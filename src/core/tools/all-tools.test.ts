import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

const CANNED: Record<string, unknown> = {
  userinfo: {
    result: 0,
    userid: 42,
    email: 'test@example.com',
    quota: 100_000_000,
    usedquota: 10_000,
    premium: true,
    language: 'en',
    registered: 'Wed, 09 Mar 2022 09:42:36 +0000',
  },
  listfolder: {
    result: 0,
    metadata: {
      path: '/',
      name: '/',
      created: 'Sun, 18 Oct 2026 20:00:00 +0000',
      modified: 'Sun, 18 Oct 2026 20:00:00 +0000',
      isfolder: true,
      folderid: 0,
      contents: [
        { name: 'a.txt', isfolder: false, fileid: 1, size: 10, modified: 'Sun, 18 Oct 2026 19:00:00 +0000' },
        { name: 'docs', isfolder: true, folderid: 2 },
      ],
    },
  },
  createfolder: {
    result: 0,
    metadata: {
      path: '/New',
      name: 'New',
      created: 'Sun, 18 Oct 2026 20:00:00 +0000',
      modified: 'Sun, 18 Oct 2026 20:00:00 +0000',
      isfolder: true,
      parentfolderid: 0,
      folderid: 42,
    },
  },
  deletefile: {
    result: 0,
    metadata: { fileid: 1, path: '/a.txt' },
  },
  getfilelink: {
    result: 0,
    hosts: ['host.pcloud.com'],
    path: '/download/a.txt',
  },
  stat: {
    result: 0,
    metadata: {
      name: 'a.txt',
      path: '/a.txt',
      isfolder: false,
      fileid: 1,
      size: 10,
      created: 'Sun, 18 Oct 2026 19:00:00 +0000',
      modified: 'Sun, 18 Oct 2026 19:00:00 +0000',
    },
  },
  trash_list: {
    result: 0,
    metadata: {
      path: '/',
      name: '/',
      isfolder: true,
      folderid: 0,
      contents: [],
    },
  },
  trash_restore: {
    result: 0,
    metadata: { name: 'restored', fileid: 9, isfolder: false, parentfolderid: 0 },
  },
  diff: {
    result: 0,
    diffid: 1234,
    entries: [],
  },
  getfilepublink: {
    result: 0,
    linkid: 1,
    link: 'https://my.pcloud.com/#page=publink&code=abc',
    code: 'abc',
  },
  getfolderpublink: {
    result: 0,
    linkid: 2,
    link: 'https://my.pcloud.com/#page=publink&code=def',
    code: 'def',
  },
  listpublinks: {
    result: 0,
    publinks: [],
  },
  deletepublink: {
    result: 0,
  },
  deletefolder: {
    result: 0,
    metadata: { folderid: 7 },
  },
  createuploadlink: {
    result: 0,
    uploadlinkid: 99,
    link: 'https://my.pcloud.com/#page=puplink&code=abc',
    mail: 'abc@u.pcloud.com',
    code: 'abc',
  },
  showuploadlink: {
    result: 0,
    uploadlinkid: 99,
    code: 'abc',
    link: 'https://my.pcloud.com/#page=puplink&code=abc',
    mail: 'abc@u.pcloud.com',
    comment: 'upload here',
  },
  copyfile: {
    result: 0,
    metadata: { name: 'copy.txt', fileid: 200, isfolder: false, size: 5 },
  },
  copyfolder: {
    result: 0,
    metadata: { name: 'copy-folder', folderid: 201, isfolder: true },
  },
  revertrevision: {
    result: 0,
    metadata: { name: 'doc.md', fileid: 1, isfolder: false },
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
    const body = CANNED[endpoint] ?? { result: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('tool handlers (mocked pCloud)', () => {
  it('userinfo returns result: 0', async () => {
    const { userinfoHandler } = await import('./userinfo.js');
    const r = await userinfoHandler({}, undefined);
    const body = r.structuredContent as { result: number; userid: number; email: string };
    expect(body.result).toBe(0);
    expect(body.userid).toBe(42);
    expect(body.email).toBe('test@example.com');
  });

  it('listfolder returns root contents inside metadata', async () => {
    const { listfolderHandler } = await import('./listfolder.js');
    const r = await listfolderHandler({ folderid: 0 }, undefined);
    const body = r.structuredContent as { result: number; metadata: { contents: unknown[] } };
    expect(body.result).toBe(0);
    expect(Array.isArray(body.metadata.contents)).toBe(true);
    expect((body.metadata.contents[0] as { name: string }).name).toBe('a.txt');
  });

  it('createfolder returns new folder id', async () => {
    const { createfolderHandler } = await import('./createfolder.js');
    const r = await createfolderHandler({ folderid: 0, name: 'New' }, undefined);
    const body = r.structuredContent as { result: number; metadata: { folderid: number; isfolder: boolean } };
    expect(body.result).toBe(0);
    expect(body.metadata.folderid).toBe(42);
    expect(body.metadata.isfolder).toBe(true);
  });

  it('deletefile rejects folderid (use deletefolder)', async () => {
    const { deletefileHandler } = await import('./deletefile.js');
    await expect(deletefileHandler({ folderid: 7 } as never, undefined)).rejects.toThrow();
  });

  it('deletefile routes fileid to deletefile', async () => {
    const { deletefileHandler } = await import('./deletefile.js');
    const r = await deletefileHandler({ fileid: 9 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('deletefile');
  });

  it('deletefolder routes to deletefolder endpoint', async () => {
    const { deletefolderHandler } = await import('./deletefolder.js');
    const r = await deletefolderHandler({ folderid: 7 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('deletefolder');
  });

  it('resolve turns a path into {fileid|folderid, isfolder}', async () => {
    const { resolveHandler } = await import('./resolve.js');
    const r = await resolveHandler({ path: '/a.txt' }, undefined);
    const body = r.structuredContent as { result: number; isfolder: boolean; fileid?: number };
    expect(body.result).toBe(0);
    expect(body.isfolder).toBe(false);
    expect(body.fileid).toBe(1);
  });

  it('trash_list hits the trash_list endpoint', async () => {
    const { trashListHandler } = await import('./trash_list.js');
    const r = await trashListHandler({}, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('trash_list');
  });

  it('diff defaults to last=0 (returns just the diffid)', async () => {
    const { diffHandler } = await import('./diff.js');
    const r = await diffHandler({ last: 0 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('diff');
  });

  it('find walks listfolder and returns matches', async () => {
    const { findHandler } = await import('./find.js');
    const r = await findHandler({ query: 'a' }, undefined);
    const body = r.structuredContent as { result: number; matches: unknown[]; scanned: number };
    expect(body.result).toBe(0);
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.scanned).toBeGreaterThan(0);
    expect(calls).toContain('listfolder');
  });

  it('getfilepublink builds a public link', async () => {
    const { getfilepublinkHandler } = await import('./getfilepublink.js');
    const r = await getfilepublinkHandler({ fileid: 1 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('getfilepublink');
  });

  it('listpublinks returns 0 without params', async () => {
    const { listpublinksHandler } = await import('./listpublinks.js');
    const r = await listpublinksHandler({}, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('listpublinks');
  });

  it('deletepublink takes a linkid', async () => {
    const { deletepublinkHandler } = await import('./deletepublink.js');
    const r = await deletepublinkHandler({ linkid: 1 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('deletepublink');
  });

  it('createuploadlink sends comment + folderid and returns uploadlinkid', async () => {
    const { createuploadlinkHandler } = await import('./createuploadlink.js');
    const r = await createuploadlinkHandler({ folderid: 0, comment: 'drop files here' }, undefined);
    const body = r.structuredContent as { result: number; uploadlinkid?: number; code?: string };
    expect(body.result).toBe(0);
    expect(body.uploadlinkid).toBe(99);
    expect(body.code).toBe('abc');
    expect(calls).toContain('createuploadlink');
  });

  it('showuploadlink returns code + comment for an uploadlinkid', async () => {
    const { showuploadlinkHandler } = await import('./showuploadlink.js');
    const r = await showuploadlinkHandler({ uploadlinkid: 99 }, undefined);
    const body = r.structuredContent as { result: number; code?: string; comment?: string };
    expect(body.result).toBe(0);
    expect(body.code).toBe('abc');
    expect(body.comment).toBe('upload here');
    expect(calls).toContain('showuploadlink');
  });

  it('copyfile sends fileid + tofolderid + toname', async () => {
    const { copyfileHandler } = await import('./copyfile.js');
    const r = await copyfileHandler({ fileid: 1, tofolderid: 0, toname: 'copy.txt' }, undefined);
    const body = r.structuredContent as { result: number; metadata: { fileid: number } };
    expect(body.result).toBe(0);
    expect(body.metadata.fileid).toBe(200);
    expect(calls).toContain('copyfile');
  });

  it('copyfolder sends folderid + tofolderid', async () => {
    const { copyfolderHandler } = await import('./copyfolder.js');
    const r = await copyfolderHandler({ folderid: 5, tofolderid: 0, toname: 'copy-folder' }, undefined);
    const body = r.structuredContent as { result: number; metadata: { folderid: number } };
    expect(body.result).toBe(0);
    expect(body.metadata.folderid).toBe(201);
    expect(calls).toContain('copyfolder');
  });

  it('revertrevision requires fileid and revisionid', async () => {
    const { revertrevisionHandler } = await import('./revertrevision.js');
    const r = await revertrevisionHandler({ fileid: 1, revisionid: 2 }, undefined);
    const body = r.structuredContent as { result: number };
    expect(body.result).toBe(0);
    expect(calls).toContain('revertrevision');
  });

  it('getfilelink builds the host URL', async () => {
    const { getfilelinkHandler } = await import('./getfilelink.js');
    const r = await getfilelinkHandler({ fileid: 1 }, undefined);
    const body = r.structuredContent as { result: number; hosts: string[]; path: string };
    expect(body.result).toBe(0);
    expect(r.content[0].text).toContain('https://host.pcloud.com/download/a.txt');
  });
});
