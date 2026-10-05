import type { ReactNode } from "react";

import { t } from "@/i18n/translations";
import { appEnvironment } from "@/lib/env";

/**
 * The page around the sign-in, forgot-password and reset-password forms —
 * coloured by which deployment it is, so nobody signs in to the wrong one.
 *
 * - **production** — exactly as it always was: the form on the page.
 * - **staging** — a coral page.
 * - **development** — a blue page.
 *
 * Both colours are the palette's own, through the `env-*` roles in
 * `theme.css` rather than new values. On them the
 * column sits on a white card, because the logo is drawn in coral and would
 * vanish on the coral page, and the form's soft greys are written for a light
 * ground. A label above the card names the environment in words, since a
 * colour alone means nothing to somebody who has not been told what it means.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const environment = appEnvironment();

  if (environment === "production") {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-xxl">
        <div className="flex w-full max-w-[380px] flex-col gap-xxxl">
          {children}
        </div>
      </main>
    );
  }

  return (
    <main
      className={
        "flex min-h-full flex-1 flex-col items-center justify-center gap-lg p-xxl " +
        (environment === "staging" ? "bg-env-staging" : "bg-env-development")
      }
    >
      <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-on-env">
        {t(`environment.${environment}`)}
      </p>
      <div className="flex w-full max-w-[428px] flex-col gap-xxxl rounded-lg bg-surface p-xxl">
        {children}
      </div>
    </main>
  );
}
