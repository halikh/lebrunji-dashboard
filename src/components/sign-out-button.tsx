'use client';

import { useRouter } from 'next/navigation';

import { ConfirmButton } from '@/components/ui/confirm-button';
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
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {

    // A route handler, because the refresh token it has to revoke is in an
    // `HttpOnly` cookie this code cannot read. `supabase.auth.*` would throw
    // here anyway — the browser client is built with `accessToken`, which turns
    // the auth namespace off.
    // Throwing rather than returning a flag: `ConfirmButton` catches it, keeps
    // the dialog open and reports there. A failed sign-out that closed the
    // dialog and navigated anyway would be the worst outcome available — the
    // session cookie would still be valid, so the operator would believe they
    // had signed out of a machine they had not.
    const response = await fetch('/auth/sign-out', { method: 'POST' });
    if (!response.ok) throw new Error('sign-out failed');

    // The in-memory access token outlives the cookies otherwise, and a
    // component querying on its way out would use one that was just revoked.
    forgetAccessToken();

    router.replace('/login');
    // The session is read on the server too, so the cached render has to go
    // with it — otherwise the back button shows the signed-in page.
    router.refresh();
  }

  return (
    // One line — icon beside label, never wrapping. In the rail a two-line
    // "Sign out" is taller than the section links above it and starts reading
    // as a heading rather than a control.
    <ConfirmButton
      onConfirm={signOut}
      titleKey="confirm.signOutTitle"
      bodyKey="confirm.signOutBody"
      confirmKey="confirm.signOutConfirm"
      variant="danger"
      // `sm`, not the default: at `md` the icon, the label and the padding come
      // to about 120px, and the rail's usable width is 108. It would not fit,
      // and `whitespace-nowrap` means it would overflow rather than wrap.
      size="sm"
      fullWidth
      className="whitespace-nowrap"
    >
      <Icon name="sign-out" size={18} />
      {t('common.signOut')}
    </ConfirmButton>
  );
}
