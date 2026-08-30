'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { t } from '@/i18n/translations';
import { getClient } from '@/lib/supabase/client';

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
 * ## Why the remember-me preference survives
 *
 * `lebrunji-remember` is not cleared. It records how this person wants to be
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

    const { error } = await getClient().auth.signOut({ scope: 'local' });

    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }

    router.replace('/login');
    // The session is read on the server too, so the cached render has to go
    // with it — otherwise the back button shows the signed-in page.
    router.refresh();
  }

  return (
    <div className="flex items-center gap-md">
      {failed && (
        <span role="alert" className="text-[13px] font-medium text-danger">
          {t('common.somethingWentWrong')}
        </span>
      )}
      <Button variant={variant} pending={pending} onClick={signOut}>
        {t('common.signOut')}
      </Button>
    </div>
  );
}
