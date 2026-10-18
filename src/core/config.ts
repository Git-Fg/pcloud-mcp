import { getEnv } from './env.js';

/**
 * pCloud API configuration.
 */
export const config = {
  apiServer: getEnv('PCLOUD_API_SERVER') || 'eapi.pcloud.com',
  accessToken: getEnv('PCLOUD_ACCESS_TOKEN'),
};

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