import { Suspense } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { Logo } from "@/components/brand/logo";
import { t } from "@/i18n/translations";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Lebrunji" };

export default function LoginPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-lg">
        <Logo variant="wide" width={200} priority />
        <p className="text-[14px] text-text-soft">{t("login.subtitle")}</p>
      </div>
      {/* `useSearchParams` in the form reads `?next=`, which Next requires a
            boundary for during static rendering. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
