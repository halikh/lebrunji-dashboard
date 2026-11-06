"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, FormError, FormNotice, Input } from "@/components/ui";
import { t } from "@/i18n/translations";
import { validatePassword } from "@/lib/validation";

const linkClass =
  "mt-5 block text-center text-[13.5px] font-medium text-accent hover:text-accent-hover";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

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
      <>
        <FormNotice>{t("resetPassword.done")}</FormNotice>
        <Link href="/login" className={linkClass}>
          {t("forgotPassword.backToLogin")}
        </Link>
      </>
    );
  }

  if (expired) {
    return (
      <>
        <FormError>{t("resetPassword.expired")}</FormError>
        <Link href="/forgot-password" className={linkClass}>
          {t("forgotPassword.title")}
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError>{error}</FormError>
      <Field label={t("resetPassword.password")} hint={t("resetPassword.hint")}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Field label={t("resetPassword.confirm")}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        pending={pending}
        className="w-full"
      >
        {t("resetPassword.submit")}
      </Button>
    </form>
  );
}
