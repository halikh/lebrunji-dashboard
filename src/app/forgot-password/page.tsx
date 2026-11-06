"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { Button, Field, FormNotice, Input } from "@/components/ui";
import { t } from "@/i18n/translations";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await fetch("/auth/reset-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // The same answer either way, so the form cannot reveal which
      // addresses are staff.
    }
    setSent(true);
    setPending(false);
  }

  return (
    <AuthFrame
      title={t("forgotPassword.title")}
      subtitle={t("forgotPassword.subtitle")}
    >
      {sent ? (
        <FormNotice>{t("forgotPassword.sent")}</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label={t("login.email")}>
            {(props) => (
              <Input
                {...props}
                type="email"
                placeholder={t("login.emailPlaceholder")}
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            {t("forgotPassword.submit")}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="mt-5 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("forgotPassword.backToLogin")}
      </Link>
    </AuthFrame>
  );
}
