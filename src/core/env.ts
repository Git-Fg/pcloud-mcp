/**
 * Environment variable helper - Node only (simple local implementation).
 * Returns the value if set, otherwise throws for required vars.
 *
 * MCP clients interpolate `${VAR}` (and some support `${VAR:-default}`) when
 * launching a server, but not every client does. When interpolation does not
 * happen the raw placeholder leaks through as a truthy string. We treat any
 * value that still looks like an unexpanded `${...}` template as unset so the
 * application-level default (or a clear "required var missing" error) wins
 * instead of a malformed literal landing in a URL.
 */
export function getEnv(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || value === '') return undefined;
  // Treat unexpanded ${VAR} or ${VAR:-default} templates as unset.
  if (/\$\{[^}]+\}/.test(value)) return undefined;
  return value;
}

/**
 * Gets required environment variable, throws with helpful message if missing.
 */
export function requireEnv(key: string): string {
  const value = getEnv(key);
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable ${key}. ` +
      `See .env.example for required variables.`
    );
  }
  return value;
}