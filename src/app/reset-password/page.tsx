import { Suspense } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { t } from "@/i18n/translations";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame title={t("resetPassword.title")}>
      {/* The form reads `?error=expired`. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
