import { Suspense } from "react";

import { AuthFrame } from "@/components/auth-frame";
import { Logo } from "@/components/brand/logo";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password — Lebrunji" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-lg">
        <Logo width={96} priority />
      </div>
      {/* The form reads `?error=expired`, which Next requires a boundary
            for during static rendering. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
