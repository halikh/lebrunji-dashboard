/**
 * Creates an operator. Run from your own machine.
 *
 *     npm run create-admin you@example.com
 *
 * Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from a gitignored
 * `.env.local`, and prompts for a password rather than taking it as an
 * argument — an argument would be in the shell history and in the process list.
 *
 * ## Why this is a script and not a screen
 *
 * Adding an operator is the one act that cannot be done by an operator.
 *
 * `operators` has a select policy and no insert, update or delete policy, so
 * nothing holding the anon key can write to it — including the dashboard,
 * signed in as the admin. That is deliberate: the account that can do
 * everything should not be able to create another account that can do
 * everything. Making a second one means running this again, from a machine
 * with the service-role key on it.
 *
 * ## The one place the service-role key is used
 *
 * It bypasses RLS completely, which is exactly why it lives here and nowhere
 * else — not in `.env`, not on Vercel, not in any file the app reads.
 * `.env.local` is gitignored. If this key is ever pasted into the dashboard's
 * environment, every policy in migrations 0062–0068 becomes decorative.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { createClient } from '@supabase/supabase-js';

import { loadLocalEnv } from './load-env';

/**
 * The only role that exists.
 *
 * `operator_role` is an enum with one value, and adding another is a migration
 * rather than a row — because a role also needs the policies that mean
 * something by it, and one inserted without them would grant nothing while
 * looking configured. When a second role exists, this becomes an argument.
 */
const ROLE = 'admin';

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes('@')) {
    console.error('Usage: npm run create-admin you@example.com');
    process.exit(2);
  }

  const source = loadLocalEnv();

  // The project URL is the same string the app already has, and there is no
  // reason to write it down twice. `SUPABASE_URL` still wins if it is set, so
  // a script can be pointed at a different project without touching the app's
  // configuration — but nobody has to set it to run this.
  //
  // The *key* is not like this. See below.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error(
      'No project URL.\n\n' +
        (source === 'file'
          ? 'Read .env.local, but it sets neither NEXT_PUBLIC_SUPABASE_URL nor SUPABASE_URL.\n\n'
          : 'There is no .env.local to read.\n\n') +
        '  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co',
    );
    process.exit(2);
  }

  if (!serviceRoleKey) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY is not set.\n\n' +
        (source === 'file' ? 'Read .env.local, but it does not set it.\n\n' : '') +
        'This is a different key from the anon key, not the same one under\n' +
        'another name. The anon key cannot do either half of this job:\n\n' +
        '  - creating an auth user is an admin API call, which it is refused, and\n' +
        '  - `operators` has a select policy and no insert policy, so nothing\n' +
        '    holding the anon key can write to it — deliberately, because the\n' +
        '    account that can do everything must not be able to mint another.\n\n' +
        'Supabase dashboard → Project Settings → API → service_role.\n\n' +
        'It carries no NEXT_PUBLIC_ prefix on purpose: that prefix means\n' +
        '"inlined into the browser bundle and readable by anyone with the URL".\n' +
        'This key bypasses RLS entirely. Local only. Never on Vercel.',
    );
    process.exit(2);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question(`Password for ${email}: `);
  rl.close();

  if (password.length < 12) {
    console.error('\nUse at least 12 characters. This account can do everything.');
    process.exit(2);
  }

  const supabase = createClient(url as string, serviceRoleKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // `email_confirm: true` because nobody is going to click a link for an
  // account created by hand, and an unconfirmed account cannot sign in.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error(`\nCould not create the auth user: ${error?.message ?? 'no user returned'}`);
    process.exit(1);
  }

  // The auth user exists now. Without this row they are an ordinary signed-in
  // account with no permissions at all — `is_admin()` is what grants
  // everything, and it reads this table.
  //
  // `role` is stated rather than defaulted. Migration 0068 drops the column
  // default on purpose, so that every insert has to answer the question out
  // loud instead of quietly becoming an admin.
  const { error: operatorError } = await supabase
    .from('operators')
    .insert({ id: data.user.id, email, role: ROLE });

  if (operatorError) {
    console.error(
      `\nThe auth user was created (${data.user.id}) but the operators row was not: ` +
        `${operatorError.message}\n\n` +
        'Nothing is granted until that row exists. Insert it by hand, or delete the\n' +
        'auth user in the Supabase dashboard and run this again.',
    );
    process.exit(1);
  }

  console.log(`\n${email} is now an operator with the ${ROLE} role (${data.user.id}).`);
  console.log('Migration 0062 means they get no customer profile — they are staff, not a customer.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
