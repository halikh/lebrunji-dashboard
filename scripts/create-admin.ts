/**
 * Creates the one admin account. Run once, from your own machine.
 *
 *     npm run create-admin -- you@example.com
 *
 * Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from a gitignored
 * `.env.local`, and prompts for a password rather than taking it as an
 * argument — an argument would be in the shell history and in the process list.
 *
 * ## Why this is a script and not a screen
 *
 * Adding an admin is the one act that cannot be done by an admin.
 *
 * `admins` has a select policy and no insert, update or delete policy, so
 * nothing holding the anon key can write to it — including the dashboard,
 * signed in as the operator. That is deliberate: the account that can do
 * everything should not be able to create another account that can do
 * everything. Making a second admin means running this again, from a machine
 * with the service-role key on it.
 *
 * ## The one place the service-role key is used
 *
 * It bypasses RLS completely, which is exactly why it lives here and nowhere
 * else — not in `.env`, not on Vercel, not in any file the app reads.
 * `.env.local` is gitignored. If this key is ever pasted into the dashboard's
 * environment, every policy in migrations 0062–0064 becomes decorative.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { createClient } from '@supabase/supabase-js';

import { loadLocalEnv } from './load-env';

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes('@')) {
    console.error('Usage: npm run create-admin you@example.com');
    process.exit(2);
  }

  const source = loadLocalEnv();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !url && 'SUPABASE_URL',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(
      `Missing: ${missing.join(', ')}\n\n` +
        (source === 'file'
          ? 'Read .env.local, but it does not set them.\n\n'
          : 'There is no .env.local to read.\n\n') +
        'Add to .env.local (gitignored, never deployed):\n\n' +
        '  SUPABASE_URL=https://<project-ref>.supabase.co\n' +
        '  SUPABASE_SERVICE_ROLE_KEY=<the service_role key>\n\n' +
        'Supabase dashboard → Project Settings → API. Note these are the plain\n' +
        'names, without the NEXT_PUBLIC_ prefix the app uses — that prefix means\n' +
        '"inlined into the browser bundle", which this key must never be.\n\n' +
        'The service-role key belongs on your machine only. Never on Vercel.',
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
  const { error: adminError } = await supabase
    .from('admins')
    .insert({ id: data.user.id, email });

  if (adminError) {
    console.error(
      `\nThe auth user was created (${data.user.id}) but the admins row was not: ` +
        `${adminError.message}\n\n` +
        'Nothing is granted until that row exists. Insert it by hand, or delete the\n' +
        'auth user in the Supabase dashboard and run this again.',
    );
    process.exit(1);
  }

  console.log(`\n${email} is now an admin (${data.user.id}).`);
  console.log('Migration 0062 means they get no customer profile — they are staff, not a customer.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
