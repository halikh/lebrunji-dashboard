'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Card, Field, FormError, FormNotice, Input } from '@/components/ui';
import { t } from '@/i18n/translations';
import { getClient } from '@/lib/supabase/client';

/**
 * Sets a new password from a recovery link.
 *
 * ## How the link becomes a session
 *
 * Supabase's recovery link lands here carrying a token, and the client exchanges
 * it for a short-lived session in which `updateUser` is allowed. That exchange
 * happens inside `@supabase/ssr` on load, and it fires `PASSWORD_RECOVERY` when
 * it succeeds — so the form waits for that event rather than assuming the link
 * was good. A link that has expired or already been used produces no session,
 * and the operator gets a sentence instead of a form that fails on submit.
 */
export function ResetPasswordForm() {
  const router = useRouter();

  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getClient();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });

    // The event may already have fired before this effect ran, so the current
    // session is checked too — otherwise a fast exchange leaves the form
    // permanently in its loading state.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setReady((current) => current ?? session !== null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError(t('resetPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'));
      return;
    }

    setPending(true);
    const { error: updateError } = await getClient().auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <Card>
        <div className="flex flex-col gap-lg">
          <FormNotice>{t('resetPassword.done')}</FormNotice>
          <Link
            href="/login"
            className="text-center text-[14px] font-medium text-primary hover:underline"
          >
            {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      </Card>
    );
  }

  if (ready === false) {
    return (
      <Card>
        <div className="flex flex-col gap-lg">
          <FormError>{t('resetPassword.expired')}</FormError>
          <Link
            href="/forgot-password"
            className="text-center text-[14px] font-medium text-primary hover:underline"
          >
            {t('forgotPassword.title')}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-lg">
        <h1 className="text-[22px]">{t('resetPassword.title')}</h1>

        <FormError>{error}</FormError>

        <Field id="password" label={t('resetPassword.password')}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field id="confirm" label={t('resetPassword.confirm')}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <Button type="submit" pending={pending || ready === null}>
          {t('resetPassword.submit')}
        </Button>
      </form>
    </Card>
  );
}
