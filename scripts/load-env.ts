/**
 * Loads `.env.local` for the scripts that are not Next.
 *
 * Next reads `.env.local` on its own, which is easy to forget is *Next* doing
 * it rather than Node. A plain `tsx scripts/…` run gets none of it, so a script
 * that reads `process.env` finds nothing and reports a missing variable that is
 * sitting in the file right in front of you.
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

export function loadLocalEnv(path = '.env.local'): EnvSource {
  if (!existsSync(path)) return 'environment';

  try {
    process.loadEnvFile(path);
    return 'file';
  } catch {
    return 'environment';
  }
}
