import type { BadgeTone } from "@/components/ui";
import { t } from "@/i18n/translations";

import { offSaleItems, type Bundle } from "../api/bundles";
import { scheduleState } from "../promotions/schedule";

/**
 * Where a bundle stands for a customer right now.
 *
 * `notShowing` is the one the schedule alone cannot see (QA-021): a bundle
 * switched on, inside its dates, with a dish in it hidden or archived on the
 * menu is gone from the app — `bundle_is_sellable` refuses it at the reader,
 * the basket and checkout alike. Calling that "Live" would be the list lying,
 * so it outranks the dates: it is what needs fixing.
 */
export type BundleState =
  "live" | "scheduled" | "ended" | "paused" | "notShowing";

export function bundleState(bundle: Bundle, now: number): BundleState {
  const schedule = scheduleState(bundle, now);
  if (schedule === "paused") return "paused";
  if (offSaleItems(bundle).length > 0) return "notShowing";
  return schedule;
}

export const BUNDLE_TONE: Record<BundleState, BadgeTone> = {
  live: "success",
  scheduled: "info",
  ended: "neutral",
  paused: "neutral",
  notShowing: "warning",
};

/** "2× Burger, Fries, Cola". */
export function describeContents(bundle: Pick<Bundle, "items">): string {
  if (bundle.items.length === 0) return t("bundles.empty");
  return bundle.items
    .map((item) =>
      item.quantity > 1
        ? t("bundles.quantityTimes", {
            count: item.quantity,
            name: item.label,
          })
        : item.label,
    )
    .join(", ");
}
