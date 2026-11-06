import { Suspense } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { t } from "@/i18n/translations";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame title={t("login.title")} subtitle={t("login.subtitle")}>
      {/* The form reads `?next=`, which needs a boundary when prerendered. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
