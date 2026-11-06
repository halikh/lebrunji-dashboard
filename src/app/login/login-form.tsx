"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button, Checkbox, Field, FormError, Input } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n/translations";
import { safeNextPath } from "@/lib/auth/next-path";
import { unlock } from "@/lib/chime";
import { forgetAccessToken } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });
    } catch {
      setError(t("login.offline"));
      setPending(false);
      return;
    }

    if (!response.ok) {
      setError(t(messageFor(response.status)));
      setPending(false);
      return;
    }

    // A token cached from a previous account must not outlive this sign-in.
    forgetAccessToken();
    // The click is the user gesture browsers want before they allow sound, so
    // the new-order chime can play later.
    unlock();

    router.replace(safeNextPath(params.get("next"), window.location.origin));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError>{error}</FormError>

      <Field label={t("login.email")}>
        {(props) => (
          <Input
            {...props}
            type="email"
            name="email"
            placeholder={t("login.emailPlaceholder")}
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>

      <Field
        label={
          <span className="flex w-full items-baseline justify-between">
            {t("login.password")}
            <Link
              href="/forgot-password"
              className="text-[13px] font-medium text-accent hover:text-accent-hover"
            >
              {t("login.forgot")}
            </Link>
          </span>
        }
      >
        {(props) => (
          <Input
            {...props}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t(
                  showPassword ? "login.hidePassword" : "login.showPassword",
                )}
                className="flex size-7 items-center justify-center rounded text-ink-4 hover:text-ink"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
          />
        )}
      </Field>

      <Checkbox
        checked={remember}
        onCheckedChange={setRemember}
        label={t("login.rememberMe")}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        pending={pending}
        className="w-full"
      >
        {t("login.submit")}
      </Button>
    </form>
  );
}

function messageFor(status: number): TranslationKey {
  return status === 429 ? "login.tooManyAttempts" : "login.failed";
}
