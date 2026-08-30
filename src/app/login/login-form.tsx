'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button, Card, Field, FormError, Input } from '@/components/ui';
import { t, type TranslationKey } from '@/i18n/translations';
import { getClient } from '@/lib/supabase/client';
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from '@/lib/supabase/cookies';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Recorded *before* signing in, because Supabase writes its auth cookies
    // from inside `signInWithPassword` and the cookie writer reads this to
    // decide whether to give them a lifetime. Written after the fact it would
    // be a request too late. See `lib/supabase/cookies.ts`.
    writeRememberPreference(remember);

    const { error: signInError } = await getClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(t(messageFor(signInError)));
      setPending(false);
      return;
    }

    // The chime on a new order is Web Audio, and a browser will not let a page
    // make a sound until it has been interacted with. This click is the first
    // interaction there is, so it is where the context gets unlocked — do it
    // any later and the first order of the day arrives silently.
    unlockAudio();

    const next = params.get('next');
    // Only a path, never an absolute URL: `?next=https://elsewhere` on a login
    // page is an open redirect, and this one is reachable signed out.
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-lg">
        <h1 className="text-[22px]">{t('login.title')}</h1>

        <FormError>{error}</FormError>

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

        <Field id="password" label={t('login.password')}>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-sm text-[14px] text-text-soft">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-[16px] accent-[var(--color-active)]"
          />
          {t('login.rememberMe')}
        </label>

        <Button type="submit" pending={pending}>
          {t('login.submit')}
        </Button>

        <Link
          href="/forgot-password"
          className="text-center text-[14px] font-medium text-primary hover:underline"
        >
          {t('login.forgot')}
        </Link>
      </form>
    </Card>
  );
}

/**
 * Which sentence to show for a failed sign-in.
 *
 * The line this draws is about what each message *reveals*:
 *
 * - **Anything to do with the credentials collapses into one message.**
 *   "No such account" and "wrong password" as separate answers turn this form
 *   into a way of asking which email addresses are staff, and it is reachable
 *   signed out by anyone. "Email not confirmed" is in here for the same reason
 *   — it confirms the account exists.
 * - **Rate limiting is said plainly.** It reveals nothing about the account,
 *   and collapsing it was actively harmful: someone who has been throttled was
 *   told their password was wrong, so they retried, which extended the
 *   throttle. The one case where the operator needs to know exactly what
 *   happened is the one case where telling them is free.
 * - **A network failure is said plainly**, because "your password is wrong" is
 *   simply untrue when the request never arrived, and it sends the operator to
 *   reset a password that was fine.
 */
function messageFor(error: { status?: number; code?: string; message?: string }): TranslationKey {
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return 'login.tooManyAttempts';
  }
  // supabase-js surfaces a failed fetch with no status at all.
  if (error.status === undefined && error.code === undefined) return 'login.offline';
  return 'login.failed';
}

/**
 * A preference, not a credential — knowing it grants nothing, which is why it
 * is an ordinary readable cookie rather than anything more careful.
 *
 * It outlives the session deliberately: cleared, the next sign-in on this
 * machine should still default to not being remembered.
 */
function writeRememberPreference(remember: boolean) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${REMEMBER_COOKIE}=${remember ? '1' : '0'}; Path=/; Max-Age=${REMEMBER_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Wakes the audio context on the first real click.
 *
 * Browsers block audio until a page has been interacted with, and the whole
 * point of the queue's chime is that it fires when nobody is looking at the
 * screen. Failing quietly is correct: a dashboard that would not load because
 * a sound would not play is a worse dashboard.
 */
function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    void new Ctor().resume();
  } catch {
    // No audio. The toast and the badge still work.
  }
}
