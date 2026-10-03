import { Logo } from "@/components/brand/logo";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password — Lebrunji" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-xxl">
      <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
        <div className="flex flex-col items-center gap-lg">
          <Logo variant="wide" width={200} priority />
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
