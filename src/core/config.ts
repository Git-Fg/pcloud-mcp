import { getEnv } from './env.js';

/**
 * Known pCloud API endpoints (allowlist for PCLOUD_API_SERVER).
 * Prevents SSRF via env var override.
 */
const ALLOWED_API_SERVERS = [
  'eapi.pcloud.com',       // EU region (default)
  'api.pcloud.com',        // Global/US
  'api.europe.pcloud.com', // Explicit EU
  'api.us.pcloud.com',     // Explicit US
] as const;

type AllowedApiServer = (typeof ALLOWED_API_SERVERS)[number];

/**
 * pCloud API configuration.
 */
export const config = {
  apiServer: validateApiServer(getEnv('PCLOUD_API_SERVER')),
  accessToken: getEnv('PCLOUD_ACCESS_TOKEN'),
};

function validateApiServer(input: string | undefined): string {
  if (!input) {
    return 'eapi.pcloud.com';
  }
  if (!ALLOWED_API_SERVERS.includes(input as AllowedApiServer)) {
    throw new Error(
      `PCLOUD_API_SERVER must be one of: ${ALLOWED_API_SERVERS.join(', ')}. ` +
      `Got: ${input}`
    );
  }
  return input;
}

/**
 * pCloud OAuth requires user interaction (authorization code flow) and is not
 * automated by this server. A static access token is the only supported mode.
 */
export function validateConfig(): void {
  if (!config.accessToken) {
    throw new Error(
      'PCLOUD_ACCESS_TOKEN must be set. The server runs in non-OAuth mode and ' +
      'expects a pre-provisioned access token (see .env.example or rclone).'
    );
  }
}
