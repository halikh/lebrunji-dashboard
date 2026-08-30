'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button, Card, Field, FormNotice, Input } from '@/components/ui';
import { t } from '@/i18n/translations';

/**
 * Asks Supabase Auth to email a recovery link.
 *
 * ## Nothing here mints a token
 *
 * The link, its expiry and its single-use property are all Supabase's. The mail
 * goes out over the SMTP configured on the project — Resend. There is no token
 * table in this app, no edge function, and no service-role key: a password reset
 * is the classic place to invent all three and get one of them subtly wrong.
 *
 * The link points at `/auth/confirm`, a route handler rather than a page,
 * because the exchange it performs produces a refresh token — and that has to
 * be written as an `HttpOnly` cookie by something the browser cannot see.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);

    // A route handler, not the browser client: `supabase.auth.*` throws when
    // the client is built with `accessToken`, which is how this design keeps
    // every auth call on the server where the tokens live.
    try {
      await fetch('/auth/reset-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Even a network failure lands on the same screen. The alternative is a
      // form whose error messages differ by case, which is the thing being
      // avoided below.
    }

    // The result is deliberately ignored, and the endpoint deliberately does
    // not report one. "No account with that address" would turn this form into
    // a way of asking which address is the operator's, and this page is
    // reachable signed out by anyone. The only difference between the two cases
    // is whether an email arrives.
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <Card>
        <div className="flex flex-col gap-lg">
          <FormNotice>{t('forgotPassword.sent')}</FormNotice>
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

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-lg">
        <h1 className="text-[22px]">{t('forgotPassword.title')}</h1>
        <p className="text-[14px] text-text-soft">{t('forgotPassword.subtitle')}</p>

        <Field id="email" label={t('login.email')}>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Button type="submit" pending={pending}>
          {t('forgotPassword.submit')}
        </Button>

        <Link
          href="/login"
          className="text-center text-[14px] font-medium text-primary hover:underline"
        >
          {t('forgotPassword.backToLogin')}
        </Link>
      </form>
    </Card>
  );
}
