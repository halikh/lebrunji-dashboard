import { t } from "@/i18n/translations";

import {
  isCountUnit,
  itemUnit,
  unitAmount,
  unitKey,
  type CountUnit,
  type ItemUnit,
  type PriceUnit,
} from "./units";

/** The plural word of each counted unit: "6 pieces", "2 bags". */
const PLURAL: Record<CountUnit, "units.pieces" | "units.bags" | "units.packs"> =
  {
    piece: "units.pieces",
    bag: "units.bags",
    pack: "units.packs",
  };

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

  return sizeOf(unit, count);
}

/**
 * The amount alone — "1.5 kg", "250 g", "6 pieces" — at a press count.
 *
 * The dashboard's copy of the app's `sizeOf` (`src/lib/unit-label.ts` there),
 * so the operator, the shop and the customer read one amount the same way:
 *
 * - Under one kilo or litre, the smaller unit: "250 g" reads at a glance
 *   where "0.25 kg" has to be worked out.
 * - Pieces, bags and packs (`0258`) are nouns and inflect — "6 pieces", never
 *   "6 piece". Every other unit is a symbol that does not.
 */
export function sizeOf(unit: ItemUnit, count: number): string {
  let amount = unitAmount(unit, count);
  let name: PriceUnit = unit.unit;

  if ((name === "kg" || name === "l") && amount < 1) {
    amount = Math.round(amount * 1000);
    name = name === "kg" ? "g" : "ml";
  }

  const word =
    isCountUnit(name) && amount !== 1 ? t(PLURAL[name]) : t(unitKey(name));
  return t("units.size", { quantity: amount, unit: word });
}
