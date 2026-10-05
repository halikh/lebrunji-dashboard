import { AuthFrame } from "@/components/auth-frame";
import { Logo } from "@/components/brand/logo";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password — Lebrunji" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-lg">
        <Logo variant="wide" width={200} priority />
      </div>
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
