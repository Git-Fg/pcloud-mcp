import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export type Pkg = { name?: string; version?: string; description?: string };

/**
 * Walks up from this module's directory to the nearest package.json. Robust
 * against any layout (source, dist, tests, future moves). The previous pattern
 * `join(import.meta.dirname, '..', '..', 'package.json')` silently read the
 * user's home dir when running from src/ and the user's parent dir when
 * running from dist/, and the catch swallowed the ENOENT — so the caller
 * never knew it was getting the wrong file.
 */
export function readPkgFromHere(here: string = dirname(fileURLToPath(import.meta.url))): Pkg {
  let dir = here;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf-8')) as Pkg;
      } catch {
        return {};
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}
