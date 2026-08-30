import { Wordmark } from '@/components/brand/wordmark';

import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Choose a new password — Lebrunji' };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-xxl">
      <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
        <div className="flex flex-col items-center gap-lg">
          <Wordmark scale={0.9} />
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
