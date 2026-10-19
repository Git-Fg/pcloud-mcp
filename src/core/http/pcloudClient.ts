import { config } from '../config.js';
import { readPkgFromHere } from '../pkg.js';

/**
 * Actionable hints for known pCloud result codes.
 * The base message is preserved; the hint is appended on a new line so an
 * agent can see both the raw pCloud text and a recommendation.
 *
 * The 4000 lockout is per-IP and has no published duration; the safe move
 * is to stop the current call sequence and retry after a short backoff.
 */
const RESULT_HINTS: Record<number, string> = {
  1000: 'Authentication required / no session. Known pattern: pCloud rejects OAuth access_token on the trash family (trash_list/trash_restore) and requires a legacy /getauth session token (pCloud API limitation, unfixed since 2020). listrevisions/createuploadlink/revertrevision show the same 1000 but the cause for those three is not yet isolated (see references/pcloud-unresolved-notes.md). A file with no revision history may also return 1000 from listrevisions (unconfirmed).',
  1001: 'Invalid login (username/password mismatch on /getauth).',
  1002: 'No full text file id match. The referenced file/folder may not exist at the given path.',
  1003: 'No full text folder id match.',
  1004: 'deletefile needs fileid or path; use deletefolder for folders (must be empty) or deletefolderrecursive for non-empty folders.',
  1005: 'Username is too short or invalid.',
  1006: 'No files in the requested folder (with nofiles=1) or no folders when files were requested.',
  1007: 'Upload link not found or expired.',
  1008: 'Upload link is closed (the owner revoked it).',
  1009: 'Invalid file/folder name (length, characters, or reserved name).',
  1010: 'Operation not allowed on a shared item from this account.',
  1011: 'The remote file/folder does not exist.',
  1012: 'Not enough space on the remote destination (upload link or remote folder).',
  1013: 'Authentication required (used by methods that need a logged-in user, distinct from 1000).',
  1014: 'The folder is not empty (e.g. deletefolder was called on a non-empty folder).',
  1015: 'Invalid path (format / encoding).',
  1016: 'copyfile/copyfolder missing destination. Provide --topath or --tofolderid (+ --toname) for the destination.',
  1017: 'Invalid folderid. Verify the folder exists with stat, or use resolve to get the current id.',
  1018: 'Invalid fileid. Verify the file exists with stat, or use resolve to get the current id.',
  1019: 'The file is locked or in a transitional state (uploading, processing, etc.).',
  1020: 'File too large for this account tier (max file size limit).',
  1021: 'Cannot copy/move a folder into itself or a descendant.',
  1022: 'Cannot perform the operation on the root folder.',
  1023: 'Operation not allowed on a public link.',
  1024: 'Invalid public link id.',
  1025: 'Cannot modify a read-only share.',
  1035: 'createuploadlink missing required comment. Provide a non-empty comment describing the upload link.',
  1036: 'Share with this user already exists or user has no space.',
  1037: 'Cannot share with the owner of the folder.',
  1040: 'Invalid revision id (listrevisions returned no such revision).',
  2000: 'Generic pCloud internal error (e.g. unknown file id on a write).',
  2001: 'A required parameter is missing.',
  2002: 'A parent directory in the path does not exist. Verify the path or create the parent folder first.',
  2003: 'Local file I/O error (upload: cannot read the local file).',
  2004: 'Destination already exists (or noover conflict on copy). Choose a different name or drop noover.',
  2005: 'Directory does not exist. Create it with createfolder or verify the path with resolve.',
  2009: 'File not found. Verify the fileid with stat, or the path is correct.',
  2022: 'A folder with this name already exists in the parent. Use a different name or createfolderifnotexists.',
  2027: 'Invalid or already-deleted public link id. Check the linkid with listpublinks before deleting.',
  2041: 'Free space exceeded. The account quota is full; delete or move files before retrying.',
  2042: 'File checksum mismatch (verify the upload completed cleanly and retry).',
  2043: 'Upload was cancelled by the user.',
  2044: 'Invalid upload offset / range (used by partial uploads).',
  2094: 'Invalid access token. The PCLOUD_ACCESS_TOKEN is malformed, revoked, or expired.',
  4000: 'Too many login tries from this IP. Stop the current call sequence, wait, then retry — the lockout is per-IP with no published duration.',
  5000: 'pCloud internal error. Retry with exponential backoff; the service is temporarily unavailable.',
  5001: 'pCloud backend temporarily unavailable (maintenance). Retry with backoff.',
  5002: 'pCloud backend overloaded. Retry with backoff.',
  7004: 'Crypto / signature error. The server could not verify the request — regenerate the access token or check the time skew on the host.',
  7007: 'Invalid OAuth client (the access token was issued to a different app).',
  7008: 'OAuth client is not authorized for this endpoint.',
};

function hintFor(result: number): string {
  return RESULT_HINTS[result] ?? 'See https://docs.pcloud.com/errors/ for the full error table.';
}

/**
 * Error thrown when pCloud API returns a non-zero result code.
 * The SDK rejects promises with the entire response object.
 */
export class PcloudError extends Error {
  readonly result: number;
  readonly error: string;
  readonly hint: string;

  constructor(result: number, error: string) {
    super(`pCloud API error ${result}: ${error}\nHint: ${hintFor(result)}`);
    this.name = 'PcloudError';
    this.result = result;
    this.error = error;
    this.hint = hintFor(result);
  }
}

/**
 * pCloud API JSON envelope. Every method returns this shape:
 * `result: 0` on success with an `error` field absent; on failure a
 * non-zero `result` plus a human-readable `error` string.
 */
interface PcloudApiEnvelope {
  result: number;
  error?: string;
}

/**
 * Simple pCloud HTTP client with timeout and retries.
 * Follows the pcloud-sdk-js patterns:
 *   - access_token as query parameter (not Bearer)
 *   - Rejects on non-zero result codes
 *   - Retries only on transient errors (429, 5xx, network)
 */
export class PcloudHttpClient {
  private readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly packageVersion: string;

  constructor(
    baseUrl: string = `https://${config.apiServer}`,
    timeoutMs: number = 30_000,
    maxRetries: number = 3
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.packageVersion = readPkgFromHere().version ?? 'unknown';
  }

  /**
   * Makes a JSON request to pCloud API with automatic retries on transient errors.
   * @param endpoint - API endpoint (e.g., 'userinfo', 'listfolder')
   * @param params - Record of query parameters (will be stringified)
   * @returns Parsed JSON response
   * @throws PcloudError on API-level errors (result != 0)
   * @throws Error on network/transient errors after retries exhausted
   */
  async json<T = unknown>(
    endpoint: string,
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);

    // Add access_token as query param (OAuth pattern from SDK)
    if (config.accessToken) {
      url.searchParams.append('access_token', config.accessToken);
    }

    // Add other params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': `pcloud-mcp/${this.packageVersion}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          // Permanent 4xx (except 429) are NOT retried — pCloud's contract
          // is deterministic and retrying risks "4000 Too many login tries".
          if (response.status === 429 || response.status >= 500) {
            // Drain the body so the connection can be released back to the
            // pool; otherwise the next retry may stall on socket exhaustion.
            await response.text().catch(() => {});
            if (attempt < this.maxRetries) {
              await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
              continue;
            }
            throw new TransientError(
              `pCloud API error ${response.status}: ${response.statusText}`
            );
          }
          const errorBody = await response
            .text()
            .catch(() => '')
            .then((t) => t.slice(0, 200));
          throw new PermanentError(
            `pCloud API error ${response.status}: ${response.statusText} ${errorBody}`
          );
        }

        const data = (await response.json()) as T & PcloudApiEnvelope;

        if (data.result !== 0) {
          throw new PcloudError(
            data.result,
            typeof data.error === 'string'
              ? data.error
              : `Unknown error (result: ${data.result})`
          );
        }

        return data;
      } catch (err) {
        if (err instanceof PcloudError || err instanceof PermanentError) {
          throw err;
        }
        lastError = err as Error;
        if (attempt >= this.maxRetries) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error('Failed pCloud API request after retries');
  }

  /**
   * Multipart upload (used by uploadfile and uploadtolink). The text fields
   * must come before the file fields; file field names are ignored by pCloud.
   *
   * `auth` controls whether the access token is attached. uploadfile needs
   * it (the request is on behalf of the authenticated user); uploadtolink
   * MUST NOT carry it — pCloud authenticates the request by the link `code`
   * field, and an attached account token would be a credential leak to
   * a request that has no business with it.
   */
  async upload(
    endpoint: string,
    fields: Record<string, string | number>,
    file: { blob: Blob; filename: string },
    options: { auth?: boolean } = {}
  ): Promise<unknown> {
    const useAuth = options.auth !== false;
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (useAuth && config.accessToken) {
      url.searchParams.append('access_token', config.accessToken);
    }
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      form.append(k, String(v));
    }
    form.append('file', file.blob, file.filename);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': `pcloud-mcp/${this.packageVersion}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '').then((t) => t.slice(0, 200));
        throw new Error(`pCloud upload ${endpoint} failed: ${response.status} ${response.statusText} ${body}`);
      }
      const data = (await response.json()) as PcloudApiEnvelope;
      if (data.result !== 0) {
        throw new PcloudError(
          data.result,
          typeof data.error === 'string' ? data.error : `Unknown error (result: ${data.result})`
        );
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Raw text response (used by gettextfile which streams the file body, not JSON).
   */
  async text(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<string> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (config.accessToken) url.searchParams.append('access_token', config.accessToken);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'User-Agent': `pcloud-mcp/${this.packageVersion}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`pCloud ${endpoint} failed: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

class TransientError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'TransientError';
  }
}

class PermanentError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PermanentError';
  }
}