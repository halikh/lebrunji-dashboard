/**
 * Regenerates `src/lib/database.types.ts` from the live database.
 *
 *     npm run db:types
 *
 * ## Why this is a script rather than one CLI call
 *
 * `supabase gen types --linked` needs the CLI to be logged in, which needs a
 * personal access token minted in the dashboard and stored on the machine.
 * `--db-url` needs one connection string, which is already in `.env.local` for
 * `check:limits`. Same output, one less credential to create and keep.
 *
 * It prefers `--linked` when the CLI *is* logged in, so this does not fight
 * anyone's existing setup — it only removes the requirement.
 *
 * ## Read-only, and the types describe what is deployed
 *
 * This reads the live schema. Nothing checks that the migrations in the app repo
 * were all applied — `supabase/verify.sql` is what does that, and a migration
 * that half-applied produces types that look perfectly fine. Run it first.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { loadLocalEnv } from './load-env';

const OUT = 'src/lib/database.types.ts';

function generate(args: string[]): string {
  return execFileSync('npx', ['--yes', 'supabase', 'gen', 'types', 'typescript', ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    // `npx` is a shell script on Windows; without this it is not found.
    shell: true,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function main() {
  loadLocalEnv();

  const dbUrl = process.env.SUPABASE_DB_URL;
  let types: string;

  try {
    types = dbUrl ? generate(['--db-url', dbUrl]) : generate(['--linked']);
  } catch {
    console.error(
      dbUrl
        ? '\nCould not read the schema over SUPABASE_DB_URL.\n\n' +
            'Check the string still works — a rotated database password invalidates it.'
        : '\nNo SUPABASE_DB_URL, and the Supabase CLI is not logged in.\n\n' +
            'Add the connection string to .env.local (gitignored):\n\n' +
            '  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres\n\n' +
            'Supabase dashboard → Project Settings → Database → Connection string → URI.\n' +
            'The same string `npm run check:limits` uses.',
    );
    process.exit(1);
  }

  // A failed generation can exit 0 with an error document on stdout, which would
  // otherwise be written over the types as a file that does not compile.
  if (!types.includes('export type Database')) {
    console.error('\nThe generator returned something that is not a schema:\n');
    console.error(types.slice(0, 400));
    process.exit(1);
  }

  writeFileSync(OUT, types, 'utf8');

  const tables = types.match(/^ {6}\w+: \{$/gm)?.length ?? 0;
  console.log(`${OUT} — ${tables} relations, ${types.split('\n').length} lines.`);
  console.log('Run `npm run typecheck`: a renamed column is a build error from here on.');
}

main();
