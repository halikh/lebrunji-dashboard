import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password — Lebrunji" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-xxl">
      <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
        <div className="flex flex-col items-center gap-lg">
          <Logo width={96} priority />
        </div>
        {/* The form reads `?error=expired`, which Next requires a boundary
            for during static rendering. */}
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
