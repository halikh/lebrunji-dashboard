import {
  DEFAULT_LOCALE,
  t,
  type Locale,
  type TranslationKey,
} from "@/i18n/translations";

import {
  isCountUnit,
  itemUnit,
  sizeUnitKey,
  unitAmount,
  unitKey,
  type CountUnit,
  type ItemUnit,
  type PriceUnit,
  type SizeUnit,
} from "./units";

/**
 * The words of each counted unit past one, by the form the number takes — the
 * app's `COUNTED` and `countForm`. Arabic reads قطعتان for two (the dual is the
 * number, so no digit), "3 قطع" to ten, then "11 قطعة".
 */
const COUNTED = {
  piece: {
    few: "units.pieces",
    many: "units.piecesMany",
    two: "units.piecesTwo",
  },
  bag: { few: "units.bags", many: "units.bagsMany", two: "units.bagsTwo" },
  pack: { few: "units.packs", many: "units.packsMany", two: "units.packsTwo" },
} as const satisfies Record<CountUnit, Record<string, TranslationKey>>;

function countForm(n: number): "two" | "few" | "many" {
  if (!Number.isInteger(n)) return "many";
  if (n === 2) return "two";
  const lastTwo = Math.abs(n) % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? "few" : "many";
}

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
export function sizeOf(
  unit: ItemUnit,
  count: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  let amount = unitAmount(unit, count);
  let name: PriceUnit = unit.unit;

  if ((name === "kg" || name === "l") && amount < 1) {
    amount = Math.round(amount * 1000);
    name = name === "kg" ? "g" : "ml";
  }

  let word = t(unitKey(name), undefined, locale);
  if (isCountUnit(name) && amount !== 1) {
    const form = countForm(amount);
    if (form === "two") return t(COUNTED[name].two, undefined, locale);
    word = t(COUNTED[name][form], undefined, locale);
  }
  return t("units.size", { quantity: amount, unit: word }, locale);
}

/**
 * A dish's display-only size — "900 g", "30 cm" — or an empty string (`0262`).
 *
 * Said as typed, never rescaled the way `sizeOf` turns 0.5 kg into 500 g: the
 * size is the label on the pack, and "900 g" is what the shop will find
 * printed on the one to fetch.
 */
export function displaySizeOf(
  row: {
    sizeQuantity?: number | null;
    sizeUnit?: SizeUnit | null;
  },
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (row.sizeQuantity == null || !row.sizeUnit) return "";
  if (!(row.sizeQuantity > 0)) return "";
  return t(
    "units.size",
    {
      quantity: row.sizeQuantity,
      unit: t(sizeUnitKey(row.sizeUnit), undefined, locale),
    },
    locale,
  );
}
