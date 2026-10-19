import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

const CANNED: Record<string, unknown> = {
  createfolderifnotexists: {
    result: 0,
    created: true,
    metadata: { folderid: 42, name: 'probe', path: '/probe', isfolder: true },
  },
  downloadfile: {
    result: 0,
    metadata: [{ name: 'from-web.txt', fileid: 777, isfolder: false }],
  },
  checksumfile: {
    result: 0,
    sha1: 'abc123',
    sha256: 'def456',
    metadata: { name: 'doc.md', fileid: 1, isfolder: false },
  },
  getthumblink: {
    result: 0,
    hosts: ['cthumb.pcloud.com'],
    path: '/thumb/fake',
    size: '32x32',
  },
  getvideolink: {
    result: 0,
    hosts: ['c11.pcloud.com'],
    path: '/hash/video',
  },
  getaudiolink: {
    result: 0,
    hosts: ['c53.pcloud.com'],
    path: '/hash/audio',
  },
  getapiserver: {
    result: 0,
    api: ['api-ams1.pcloud.com'],
    binapi: ['binapi-ams1.pcloud.com'],
  },
  currentserver: {
    result: 0,
    hostname: 'api7.pcloud.com',
    ip: '204.155.155.21',
    ipbin: '204.155.155.60',
    ipv6: '::1',
  },
  extractarchive: {
    result: 0,
    finished: false,
    progresshash: 'KooPMKmcEBp',
    lines: 10,
    output: ['archive.zip: Zip', '  a.txt (10 B)... OK.'],
    hostname: 'api5.pcloud.com',
    ip: '204.155.151.23',
  },
};

let originalFetch: typeof globalThis.fetch;
let requests: { url: string; method: string }[] = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  requests = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    const endpoint = new URL(url).pathname.replace(/^\//, '');
    const body = CANNED[endpoint] ?? { result: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('batch-2 tools (mocked pCloud)', () => {
  it('createfolderifnotexists returns created=true with folder metadata', async () => {
    const { createfolderifnotexistsHandler } = await import('./createfolderifnotexists.js');
    const r = await createfolderifnotexistsHandler({ folderid: 0, name: 'probe' }, undefined);
    const body = r.structuredContent as { result: number; created?: boolean; metadata?: { folderid?: number } };
    expect(body.result).toBe(0);
    expect(body.created).toBe(true);
    expect(body.metadata?.folderid).toBe(42);
    expect(r.content[0].text).toContain('created');
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('folderid')).toBe('0');
    expect(sent.get('name')).toBe('probe');
    expect(sent.get('access_token')).toBe('unit-test-token');
  });

  it('createfolderifnotexists sends path instead of folderid+name when path given', async () => {
    const { createfolderifnotexistsHandler } = await import('./createfolderifnotexists.js');
    await createfolderifnotexistsHandler({ path: '/probe' }, undefined);
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('path')).toBe('/probe');
    expect(sent.get('folderid')).toBeNull();
    expect(sent.get('name')).toBeNull();
  });

  it('downloadfile posts url and destination, returns metadata array', async () => {
    const { downloadfileHandler } = await import('./downloadfile.js');
    const r = await downloadfileHandler({ url: 'https://example.com/a.txt', folderid: 0 }, undefined);
    const body = r.structuredContent as { result: number; metadata?: Array<{ fileid: number }> };
    expect(body.result).toBe(0);
    expect(body.metadata?.[0]?.fileid).toBe(777);
    expect(r.content[0].text).toContain('1 file(s)');
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('url')).toBe('https://example.com/a.txt');
    expect(sent.get('folderid')).toBe('0');
  });

  it('downloadfile rejects when both folderid and path are given', async () => {
    const { downloadfileHandler } = await import('./downloadfile.js');
    await expect(
      downloadfileHandler({ url: 'https://example.com', folderid: 0, path: '/x' }, undefined)
    ).rejects.toThrow();
  });

  it('checksumfile returns sha1 and formats the content line', async () => {
    const { checksumfileHandler } = await import('./checksumfile.js');
    const r = await checksumfileHandler({ fileid: 1 }, undefined);
    const body = r.structuredContent as { result?: number; sha1: string; sha256?: string };
    expect(body.sha1).toBe('abc123');
    expect(r.content[0].text).toContain('sha1=abc123');
    expect(r.content[0].text).toContain('sha256=def456');
    expect(r.content[0].text).not.toContain('md5=');
  });

  it('checksumfile sends path when fileid absent', async () => {
    const { checksumfileHandler } = await import('./checksumfile.js');
    await checksumfileHandler({ path: '/doc.md' }, undefined);
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('path')).toBe('/doc.md');
    expect(sent.get('fileid')).toBeNull();
  });

  it('getthumblink sends size and builds the URL from hosts[0]', async () => {
    const { getthumblinkHandler } = await import('./getthumblink.js');
    const r = await getthumblinkHandler({ fileid: 1, size: '32x32' }, undefined);
    expect(r.content[0].text).toContain('https://cthumb.pcloud.com/thumb/fake');
    const body = r.structuredContent as { size: string };
    expect(body.size).toBe('32x32');
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('size')).toBe('32x32');
    expect(sent.has('crop')).toBe(false);
  });

  it('getthumblink forwards crop and type as documented', async () => {
    const { getthumblinkHandler } = await import('./getthumblink.js');
    await getthumblinkHandler({ fileid: 1, size: '64x64', crop: true, type: 'png' }, undefined);
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('crop')).toBe('1');
    expect(sent.get('type')).toBe('png');
  });

  it('getthumblink schema rejects a size that is not WxH', async () => {
    const { GetthumblinkInputSchema } = await import('./getthumblink.js');
    const r = GetthumblinkInputSchema.safeParse({ fileid: 1, size: 'big' });
    expect(r.success).toBe(false);
  });

  it('getthumblink rejects missing size', async () => {
    const { GetthumblinkInputSchema } = await import('./getthumblink.js');
    expect(GetthumblinkInputSchema.safeParse({ fileid: 1 }).success).toBe(false);
  });

  it('getvideolink forwards transcode controls and formats the URL', async () => {
    const { getvideolinkHandler } = await import('./getvideolink.js');
    const r = await getvideolinkHandler(
      { fileid: 5, abitrate: 64, vbitrate: 500, resolution: '640x480', fixedbitrate: true },
      undefined
    );
    expect(r.content[0].text).toContain('https://c11.pcloud.com/hash/video');
    expect(r.content[0].text).toContain('start=');
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('abitrate')).toBe('64');
    expect(sent.get('vbitrate')).toBe('500');
    expect(sent.get('resolution')).toBe('640x480');
    expect(sent.get('fixedbitrate')).toBe('1');
  });

  it('getvideolink schema clamps abitrate to the documented range', async () => {
    const { GetvideolinkInputSchema } = await import('./getvideolink.js');
    expect(GetvideolinkInputSchema.safeParse({ fileid: 1, abitrate: 400 }).success).toBe(false);
    expect(GetvideolinkInputSchema.safeParse({ fileid: 1, abitrate: 320 }).success).toBe(true);
    expect(GetvideolinkInputSchema.safeParse({ fileid: 1, vbitrate: 5000 }).success).toBe(false);
  });

  it('getaudiolink forwards abitrate and defaults are not sent', async () => {
    const { getaudiolinkHandler } = await import('./getaudiolink.js');
    await getaudiolinkHandler({ fileid: 5 }, undefined);
    expect(new URL(requests[0].url).searchParams.has('abitrate')).toBe(false);
    await getaudiolinkHandler({ fileid: 5, abitrate: 128 }, undefined);
    expect(new URL(requests[1].url).searchParams.get('abitrate')).toBe('128');
  });

  it('getapiserver requires no args and returns both api arrays', async () => {
    const { getapiserverHandler } = await import('./getapiserver.js');
    const r = await getapiserverHandler({}, undefined);
    const body = r.structuredContent as { api: string[]; binapi?: string[] };
    expect(body.api[0]).toBe('api-ams1.pcloud.com');
    expect(body.binapi?.[0]).toBe('binapi-ams1.pcloud.com');
    expect(r.content[0].text).toContain('Closest API server: api-ams1.pcloud.com');
    // No method-specific params; access_token is attached uniformly by the client.
    expect([...new URL(requests[0].url).searchParams.keys()].sort()).toEqual(['access_token']);
  });

  it('currentserver requires no args and returns the hostname', async () => {
    const { currentserverHandler } = await import('./currentserver.js');
    const r = await currentserverHandler({}, undefined);
    const body = r.structuredContent as { hostname: string; ip: string };
    expect(body.hostname).toBe('api7.pcloud.com');
    expect(r.content[0].text).toContain('api7.pcloud.com');
    expect([...new URL(requests[0].url).searchParams.keys()].sort()).toEqual(['access_token']);
  });

  it('extractarchive requires a destination', async () => {
    const { ExtractarchiveInputSchema } = await import('./extractarchive.js');
    expect(ExtractarchiveInputSchema.safeParse({ fileid: 1 }).success).toBe(false);
    expect(ExtractarchiveInputSchema.safeParse({ fileid: 1, tofolderid: 0 }).success).toBe(true);
    expect(ExtractarchiveInputSchema.safeParse({ path: '/a.zip', topath: '/out' }).success).toBe(true);
  });

  it('extractarchive requires exactly one of fileid or path', async () => {
    const { ExtractarchiveInputSchema } = await import('./extractarchive.js');
    expect(ExtractarchiveInputSchema.safeParse({ tofolderid: 0 }).success).toBe(false);
    expect(
      ExtractarchiveInputSchema.safeParse({ fileid: 1, path: '/a.zip', tofolderid: 0 }).success
    ).toBe(false);
  });

  it('extractarchive forwards source, destination, password and overwrite', async () => {
    const { extractarchiveHandler } = await import('./extractarchive.js');
    const r = await extractarchiveHandler(
      { fileid: 1, tofolderid: 0, password: 's3cret', overwrite: 'skip' },
      undefined
    );
    const body = r.structuredContent as { finished: boolean; progresshash?: string; hostname?: string };
    expect(body.finished).toBe(false);
    expect(body.progresshash).toBe('KooPMKmcEBp');
    expect(r.content[0].text).toContain('poll extractarchiveprogress');
    expect(r.content[0].text).toContain('api5.pcloud.com');
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get('fileid')).toBe('1');
    expect(sent.get('tofolderid')).toBe('0');
    expect(sent.get('password')).toBe('s3cret');
    expect(sent.get('overwrite')).toBe('skip');
  });
});
