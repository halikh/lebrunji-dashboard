import { t } from "@/i18n/translations";

import { itemUnit, unitAmount, unitKey } from "./units";

/**
 * How much of a line there is, in words: "1.5 kg", or "2".
 *
 * ## Why this is not in `units.ts`
 *
 * `units.ts` is copied verbatim between this dashboard and the app, and its
 * header says why the *word* is not in it: "kg" is "كغ" in Arabic, so it is
 * chrome and belongs in each app's translation bundle. This is the join —
 * arithmetic from `units.ts`, word from `translations.ts` — and it is
 * dashboard-side for the same reason the bundle is. The app carries its own
 * copy at `src/lib/unit-label.ts`, against its own `t`.
 *
 * ## Why an amount rather than a count
 *
 * Since `0122` a line with a step is priced in proportion to how much of the
 * unit it is, so the press count is no longer a number that explains the money
 * beside it: "×2" against $18.00 says nothing, "1.5 kg" against $18.00 says
 * everything. On a driver's ticket it is worse than uninformative — "2 ×
 * Kafta" sends somebody to fetch two of a thing that is sold by weight.
 */
export function unitLabel(
  line: {
    priceUnit?: string | null;
    unitQuantity?: number | null;
    unitStep?: number | null;
  },
  count: number,
): string {
  const unit = itemUnit(line);

  // No step is the counted stepper, and a count is what it has always said.
  if (!unit || unit.step === null) return String(count);

  return t("units.size", {
    quantity: unitAmount(unit, count),
    unit: t(unitKey(unit.unit)),
  });
}
