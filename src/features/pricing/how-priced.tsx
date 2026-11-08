"use client";

import { Section } from "@/components/ui";
import { t } from "@/i18n/translations";

/**
 * The rules `place_order` prices delivery by, in plain words. Read-only, so
 * it sits on the Delivery tab under the ladder it explains rather than on a
 * tab of its own.
 */
export function HowPriced() {
  const rules = [
    t("pricing.howOne"),
    t("pricing.howMany"),
    t("pricing.howCap"),
    t("pricing.howPin"),
  ];

  return (
    <Section title={t("pricing.howTitle")} description={t("pricing.howBody")}>
      <ol className="flex flex-col gap-3">
        {rules.map((rule, index) => (
          <li key={index} className="flex items-start gap-3 text-[13.5px]">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hover text-[12px] font-semibold text-ink-2 tabular-nums"
            >
              {index + 1}
            </span>
            <span className="pt-0.5 text-ink-2">{rule}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
