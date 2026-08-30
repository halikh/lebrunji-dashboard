"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Button,
  Card,
  Field,
  FormError,
  FormNotice,
  Input,
} from "@/components/ui";
import { t } from "@/i18n/translations";
import { validatePassword } from "@/lib/validation";

/**
 * Sets a new password.
 *
 * ## By the time this renders, the link has already been used
 *
 * The recovery mail does not point here — it points at `/auth/confirm`, which
 * exchanges the token and redirects. That is not indirection for its own sake:
 * the exchange produces a **refresh token**, and a refresh token must never
 * reach JavaScript. A route handler can write an `HttpOnly` cookie; a client
 * component cannot.
 *
 * So this screen has no token to inspect and no session to wait for. It knows
 * only what the redirect told it: either it arrived clean, or with
 * `?error=expired`. Everything else is the server's.
 *
 * ## The rule runs on both sides
 *
 * `validatePassword` here explains before a round trip. The copy in
 * `/auth/update-password` is the one that counts, because a POST does not have
 * to come from this form. Neither is the last word — the project's password
 * policy is.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  // A used or expired link is an ordinary thing to hit — they are single-use
  // and time-limited by design — so it is a sentence and an offer of another,
  // not an alarm.
  const expired = params.get("error") === "expired";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const strong = validatePassword(password);
    if (!strong.ok) {
      setError(t(strong.key, strong.params));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.mismatch"));
      return;
    }

    setPending(true);

    let response: Response;
    try {
      response = await fetch("/auth/update-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setError(t("login.offline"));
      setPending(false);
      return;
    }

    setPending(false);

    if (!response.ok) {
      // 401 means the recovery session is gone — the link was used or timed
      // out while the form sat open. Anything else carries a reason worth
      // showing, because by this point the operator is authenticated and it is
      // their own account.
      if (response.status === 401) {
        setError(t("resetPassword.expired"));
        return;
      }
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? t("common.somethingWentWrong"));
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <Card>
        <div className="flex flex-col gap-lg">
          <FormNotice>{t("resetPassword.done")}</FormNotice>
          <Link
            href="/login"
            className="text-center text-[14px] font-medium text-primary hover:underline"
          >
            {t("forgotPassword.backToLogin")}
          </Link>
        </div>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card>
        <div className="flex flex-col gap-lg">
          <FormError>{t("resetPassword.expired")}</FormError>
          <Link
            href="/forgot-password"
            className="text-center text-[14px] font-medium text-primary hover:underline"
          >
            {t("forgotPassword.title")}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-lg">
        <h1 className="text-[22px]">{t("resetPassword.title")}</h1>

        <FormError>{error}</FormError>

        <Field
          label={t("resetPassword.password")}
          hint={t("resetPassword.hint")}
        >
          <Input
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label={t("resetPassword.confirm")}>
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <Button type="submit" pending={pending}>
          {t("resetPassword.submit")}
        </Button>
      </form>
    </Card>
  );
}
