import { config } from '../config.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Actionable hints for known pCloud result codes.
 * The base message is preserved; the hint is appended on a new line so an
 * agent can see both the raw pCloud text and a recommendation.
 *
 * The 4000 lockout is per-IP and has no published duration; the safe move
 * is to stop the current call sequence and retry after a short backoff.
 */
const RESULT_HINTS: Record<number, string> = {
  1000: 'Authentication required / no session. Known pattern: pCloud rejects OAuth access_token on the trash family (trash_list/trash_restore) and requires a legacy /getauth session token (pCloud API limitation, unfixed since 2020). listrevisions/createuploadlink/revertrevision show the same 1000 but the cause for those three is not yet isolated (see references/pcloud-unresolved-notes.md). A file with no revision history also returns 1000 from listrevisions.',
  1002: 'No full text file id match. The referenced file/folder may not exist at the given path.',
  1004: 'deletefile needs fileid or path; use deletefolder for folders (must be empty) or deletefolderrecursive for non-empty folders.',
  1016: 'copyfile/copyfolder missing destination. Provide --topath or --tofolderid (+ --toname) for the destination.',
  1017: 'Invalid folderid. Verify the folder exists with stat, or use resolve to get the current id.',
  1018: 'Invalid fileid. Verify the file exists with stat, or use resolve to get the current id.',
  1035: 'createuploadlink missing required comment. Provide a non-empty comment describing the upload link.',
  2002: 'A parent directory in the path does not exist. Verify the path or create the parent folder first.',
  2004: 'Destination already exists (or noover conflict on copy). Choose a different name or drop noover.',
  2005: 'Directory does not exist. Create it with createfolder or verify the path with resolve.',
  2009: 'File not found. Verify the fileid with stat, or the path is correct.',
  2022: 'A folder with this name already exists in the parent. Use a different name or createfolderifnotexists.',
  2027: 'Invalid or already-deleted public link id. Check the linkid with listpublinks before deleting.',
  2041: 'Free space exceeded. The account quota is full; delete or move files before retrying.',
  2094: 'Invalid access token. The PCLOUD_ACCESS_TOKEN is malformed, revoked, or expired.',
  4000: 'Too many login tries from this IP. Stop the current call sequence, wait, then retry — the lockout is per-IP with no published duration.',
  5000: 'pCloud internal error. Retry with exponential backoff; the service is temporarily unavailable.',
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

    // Read package version once at construction time to avoid requireEnv crash
    try {
      const moduleDir = dirname(fileURLToPath(import.meta.url));
      const pkgPath = join(moduleDir, '..', '..', '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      this.packageVersion = pkg.version ?? 'unknown';
    } catch {
      this.packageVersion = 'unknown';
  }
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
   * Multipart upload (used by uploadfile). The text fields must come before
   * the file fields; file field names are ignored by pCloud.
   */
  async upload(
    endpoint: string,
    fields: Record<string, string | number>,
    file: { blob: Blob; filename: string }
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (config.accessToken) {
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