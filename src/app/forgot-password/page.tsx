import { Wordmark } from "@/components/brand/wordmark";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password — Lebrunji" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-xxl">
      <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
        <div className="flex flex-col items-center gap-lg">
          <Wordmark scale={0.9} />
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
