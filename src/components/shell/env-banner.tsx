import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { appEnvironment } from "@/lib/env";

/** A thin strip on staging and development, so test data is never mistaken for live. */
export function EnvBanner() {
  const environment = appEnvironment();
  if (environment === "production") return null;

  return (
    <div
      role="status"
      className={cx(
        "flex h-7 shrink-0 items-center justify-center gap-2 text-[12.5px] text-white",
        environment === "staging" ? "bg-[#b45309]" : "bg-[#6d28d9]",
      )}
    >
      <span className="font-semibold">{t(`environment.${environment}`)}</span>
      <span className="hidden opacity-85 sm:inline">
        {t(`environment.${environment}Note`)}
      </span>
    </div>
  );
}
