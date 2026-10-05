import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { appEnvironment } from "@/lib/env";

/**
 * A strip across the top of every dashboard screen saying this is not the live
 * dashboard — coral on staging, blue on development, nothing on production.
 *
 * The three deployments are the same app pointed at three databases, and look
 * identical. Somebody with staging in one tab and production in the next has
 * only the address bar to tell them apart, and a price changed in the wrong one
 * is a price a customer pays. The sign-in page is coloured too
 * (`components/auth-frame.tsx`), but that is seen once; this is on screen the
 * whole time.
 *
 * Above the rail and the content rather than inside either, so no screen can
 * scroll it away or cover it with a panel. Production renders nothing — the
 * live dashboard is the one that looks normal.
 */
export function EnvBanner() {
  const environment = appEnvironment();
  if (environment === "production") return null;

  return (
    <div
      role="status"
      className={cx(
        "flex shrink-0 items-center justify-center gap-sm px-lg py-[6px] text-[13px] text-on-env",
        environment === "staging" ? "bg-env-staging" : "bg-env-development",
      )}
    >
      <span className="font-bold uppercase tracking-[0.12em]">
        {t(`environment.${environment}`)}
      </span>
      <span className="hidden sm:inline">
        {t(`environment.${environment}Note`)}
      </span>
    </div>
  );
}
