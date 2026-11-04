/**
 * Loads `.env.local` and `.env.scripts` for the scripts that are not Next.
 *
 * Next reads `.env.local` on its own, which is easy to forget is *Next* doing
 * it rather than Node. A plain `tsx scripts/…` run gets none of it, so a script
 * that reads `process.env` finds nothing and reports a missing variable that is
 * sitting in the file right in front of you.
 *
 * `.env.scripts` is the half Next must never see — the service-role key and the
 * database URL. `scripts/use-env.mjs` writes both files from the same
 * `.env.dev` / `.env.staging` / `.env.prod`, so they always name one project.
 *
 * `process.loadEnvFile` is built into Node, so this needs no dependency.
 *
 * Missing or unreadable is **not** an error here: the variables may be exported
 * in the shell, or set by CI, and both are legitimate. Whether they are
 * actually present is the caller's question, and the caller asks it with a
 * message that names what it needs.
 */

import { existsSync } from 'node:fs';

/** Where the value came from, so an error message can say. */
export type EnvSource = 'file' | 'environment';

export const ENV_FILES = ['.env.local', '.env.scripts'];

export function loadLocalEnv(paths = ENV_FILES): EnvSource {
  let source: EnvSource = 'environment';

  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
      source = 'file';
    } catch {
      // As above: absent is the caller's question, not this function's.
    }
  }

  return source;
}
