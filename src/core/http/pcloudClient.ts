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
  1000: 'Log in required. Known pattern: pCloud rejects OAuth access_token on the trash family (trash_list/trash_restore) and requires a legacy /getauth session token (pCloud API limitation, unfixed since 2020). listrevisions/createuploadlink/revertrevision show the same 1000 but the cause for those three is not yet isolated (see references/pcloud-unresolved-notes.md).',
  1001: 'No full path or name/folderid provided (createfolder/createfolderifnotexists).',
  1002: 'No full path or folderid provided.',
  1004: 'No fileid or path provided.',
  1005: 'Unknown content-type requested.',
  1013: 'Date/time format not understood.',
  1014: 'Thumb can not be created from this file type (getthumblink).',
  1015: 'Invalid thumb size (getthumblink): width and height must be divisible by 4 or 5 and between 16 and 2048 (1024 for height).',
  1016: 'No full topath or toname/tofolderid provided (copyfile/copyfolder destination missing).',
  1017: "Invalid 'folderid' provided.",
  1018: "Invalid 'fileid' provided.",
  1023: "Please provide 'mail' to share folder with (sharefolder).",
  1024: "Please provide 'permissions' for the share (sharefolder).",
  1035: "Please provide 'comment' (createuploadlink).",
  1036: "Please provide 'uploadlinkid' (showuploadlink).",
  1037: "Please provide at least one of 'topath', 'tofolderid' or 'toname'.",
  1040: "Please provide 'url' (downloadfile).",
  1030: "Please provide 'linkid' (deletepublink).",
  2000: 'Log in failed.',
  2001: 'Invalid file/folder name.',
  2002: 'A component of parent directory does not exist. Verify the path or create the parent folder first.',
  2003: 'Access denied. You do not have permissions to perform this operation.',
  2004: 'File or folder already exists (copyfolder with noover also returns this). Choose a different name or drop noover.',
  2005: 'Directory does not exist. Create it with createfolder or verify the path with resolve.',
  2006: 'Folder is not empty. Use deletefolderrecursive if you actually want to delete the contents (destructive).',
  2007: 'Cannot delete the root folder.',
  2008: 'User is over quota. Free space (delete files, empty trash) before uploading or copying.',
  2009: 'File not found. Verify the fileid with stat, or the path is correct.',
  2010: 'Invalid path. Verify each component with resolve or stat.',
  2014: 'Please verify your email address to perform this action (sendverificationemail exists for this).',
  2015: 'Can not share root folder.',
  2026: 'You can only share your own files or folders. Copy the file to a folder you own if you need to share it.',
  2027: 'Invalid or already deleted link (deletepublink). Check the linkid with listpublinks before deleting.',
  2039: 'You have to own the folder for upload (createuploadlink).',
  2040: "Given 'uploadlinkid' not found (showuploadlink).",
  2041: 'Connection broken.',
  2042: 'Cannot rename the root folder (renamefolder).',
  2043: 'Cannot move a folder to a subfolder of itself (renamefolder).',
  2044: 'Video links can only be generated for videos (getvideolink/getaudiolink).',
  2059: 'Unsupported archive format (extractarchive).',
  3001: 'Could not create thumb from the given file (getthumblink).',
  3006: 'Extracting of the archive failed (extractarchive).',
  4000: 'Too many login tries from this IP address. Stop the current call sequence, wait, then retry — the lockout is per-IP with no published duration.',
  5000: 'Internal error. Try again later.',
  5001: 'Internal upload error.',
  5002: 'Internal error, no servers available. Try again later.',
  7002: 'This link is deleted by the owner (uploadtolink).',
  7004: 'This link has expired (uploadtolink).',
  7007: 'This link has reached its space limit (uploadtolink).',
  7008: 'This link has reached its file limit (uploadtolink).',
  7009: 'Archive is password protected, please supply password (extractarchive).',
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