import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { t } from "@/i18n/translations";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Lebrunji" };

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-xxl">
      <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
        <div className="flex flex-col items-center gap-lg">
          <Wordmark scale={0.9} />
          <p className="text-[14px] text-text-soft">{t("login.subtitle")}</p>
        </div>
        {/* `useSearchParams` in the form reads `?next=`, which Next requires a
            boundary for during static rendering. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
