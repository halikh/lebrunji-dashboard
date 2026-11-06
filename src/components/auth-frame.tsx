import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { EnvBanner } from "@/components/shell/env-banner";

/** The sign-in pages: a single centred card on the canvas. */
export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnvBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Logo variant="wide" width={200} priority />
            <div className="flex flex-col gap-1">
              <h1 className="text-[22px] font-semibold tracking-tight text-ink">
                {title}
              </h1>
              {subtitle && <p className="text-[14px] text-ink-3">{subtitle}</p>}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
