"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Card, Field, FormError, Input } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n/translations";
import { forgetAccessToken } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Posted to a route handler rather than called on a browser Supabase
    // client, and that is the whole design: the response sets the refresh token
    // as an `HttpOnly` cookie, so it never exists anywhere this code could read
    // it. The client cannot sign in even by accident — `supabase.auth.*` throws
    // when the `accessToken` option is set.
    let response: Response;
    try {
      response = await fetch("/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
    } catch {
      // The request never left. "Your password is wrong" would be untrue, and
      // would send the operator off to reset a password that was fine.
      setError(t("login.offline"));
      setPending(false);
      return;
    }

    if (!response.ok) {
      setError(t(messageFor(response.status)));
      setPending(false);
      return;
    }

    // The token the page will use lives in memory from here on. Dropping any
    // stale one first, so the first query does not go out with a token from a
    // previous session.
    forgetAccessToken();

    // The chime on a new order is Web Audio, and a browser will not let a page
    // make a sound until it has been interacted with. This click is the first
    // interaction there is, so it is where the context gets unlocked — do it
    // any later and the first order of the day arrives silently.
    unlockAudio();

    const next = params.get("next");
    // Only a path, never an absolute URL: `?next=https://elsewhere` on a login
    // page is an open redirect, and this one is reachable signed out.
    router.replace(
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/",
    );
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-lg">
        <h1 className="text-[22px]">{t("login.title")}</h1>

        <FormError>{error}</FormError>

        <Field id="email" label={t("login.email")}>
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

        <Field id="password" label={t("login.password")}>
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
          {t("login.rememberMe")}
        </label>

        <Button type="submit" pending={pending}>
          {t("login.submit")}
        </Button>

        <Link
          href="/forgot-password"
          className="text-center text-[14px] font-medium text-primary hover:underline"
        >
          {t("login.forgot")}
        </Link>
      </form>
    </Card>
  );
}

/**
 * Which sentence to show for a failed sign-in.
 *
 * There are only two answers here because `/auth/sign-in` only gives two, and
 * that is deliberate — every distinction the endpoint draws is a distinction it
 * discloses to anyone who can reach it, and this page is reachable signed out.
 *
 * - **429 is said plainly.** Rate limiting reveals nothing about whether an
 *   account exists, and collapsing it was actively harmful: someone who had
 *   been throttled was told their password was wrong, so they retried, which
 *   extended the throttle.
 * - **Everything else is one message.** "No such account" and "wrong password"
 *   as separate answers would turn this form into a way of asking which email
 *   address is the operator's. "Email not confirmed" is folded in for the same
 *   reason — it confirms the account exists.
 */
function messageFor(status: number): TranslationKey {
  return status === 429 ? "login.tooManyAttempts" : "login.failed";
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
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    void new Ctor().resume();
  } catch {
    // No audio. The toast and the badge still work.
  }
}
