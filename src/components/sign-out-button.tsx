'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { Icon } from '@/components/shell/icons';
import { t } from '@/i18n/translations';
import { forgetAccessToken } from '@/lib/supabase/client';

/**
 * Signs the operator out of **this browser**.
 *
 * ## Why `scope: 'local'`
 *
 * Supabase defaults to `global`, which revokes every refresh token the account
 * has anywhere. That is the right behaviour for "someone has my password" and
 * the wrong behaviour for a sign-out button: pressing it on a shop's counter
 * machine would also sign the owner out on their phone, which is not what
 * anybody means by "sign out". So this ends the session here and leaves other
 * devices alone.
 *
 * A "sign out everywhere" action is a different button, and it belongs next to
 * the password change rather than in the shell.
 *
 * ## Why the cookies are cleared even when revocation fails
 *
 * `/auth/sign-out` clears them regardless of whether Supabase accepted the
 * revoke — the network may be down, or the token already spent. Neither is a
 * reason to leave somebody signed in on a machine where they asked not to be.
 *
 * ## Why the remember-me preference survives
 *
 * `lb-remember` is not cleared. It records how this person wants to be
 * treated on this machine, not whether they are currently signed in — someone
 * who cleared the box on a shared computer should still find it cleared at the
 * next sign-in, and clearing it here would silently reset that to the default.
 *
 * ## A failed sign-out is not a sign-out
 *
 * If the call fails the component says so and stays put. Navigating to `/login`
 * anyway would be the worst outcome available: the session cookie would still
 * be valid, so the operator would believe they had signed out of a machine they
 * had not.
 */
export function SignOutButton({ variant = 'quiet' }: { variant?: 'quiet' | 'secondary' }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);

    // A route handler, because the refresh token it has to revoke is in an
    // `HttpOnly` cookie this code cannot read. `supabase.auth.*` would throw
    // here anyway — the browser client is built with `accessToken`, which turns
    // the auth namespace off.
    let response: Response;
    try {
      response = await fetch('/auth/sign-out', { method: 'POST' });
    } catch {
      setFailed(true);
      setPending(false);
      return;
    }

    if (!response.ok) {
      setFailed(true);
      setPending(false);
      return;
    }

    // The in-memory access token outlives the cookies otherwise, and a
    // component querying on its way out would use one that was just revoked.
    forgetAccessToken();

    router.replace('/login');
    // The session is read on the server too, so the cached render has to go
    // with it — otherwise the back button shows the signed-in page.
    router.refresh();
  }

  return (
    // The button is one line — icon beside label, never wrapping. It sits in a
    // 92px rail, where "Sign out" breaking across two lines would make the
    // control taller than the section links above it and read as a heading.
    //
    // The failure goes *underneath* rather than beside, for the same reason:
    // there is no room beside it, and an alert that pushes the button around is
    // worse than one that appears below it.
    <div className="flex flex-col items-center gap-xs">
      <Button
        variant={variant}
        pending={pending}
        onClick={signOut}
        className="w-full whitespace-nowrap px-sm py-sm text-[12px]"
      >
        {!pending && <Icon name="sign-out" size={16} />}
        {t('common.signOut')}
      </Button>
      {failed && (
        <span role="alert" className="text-center text-[11px] font-medium text-danger">
          {t('common.somethingWentWrong')}
        </span>
      )}
    </div>
  );
}
