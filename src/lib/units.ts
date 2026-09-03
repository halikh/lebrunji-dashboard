/**
 * What quantity an item's price buys, and what that comes to per unit.
 *
 * **Copied verbatim between the dashboard and the app**, the same arrangement
 * `lib/money.ts` describes and for the same reason: a shop that quoted one
 * per-kilo figure to the operator and another to the customer would have two
 * numbers that are each right about something different.
 *
 * ## The two columns
 *
 * `menu_items.price_unit` is a key — `kg`, `g`, `l`, `ml`, `piece` — and
 * `unit_quantity` says how many of it one item is. A one-kilo pack is
 * `('kg', 1)`; the same pack described the other way is `('g', 500)` only if it
 * is actually half a kilo. Migration `0095` refuses one without the other,
 * because a unit with no quantity and a quantity with no unit are both
 * unrenderable.
 *
 * The **word** is not here. "kg" is "كغ" in Arabic, so it is chrome and lives
 * in each app's translation bundle beside every other piece of user-facing
 * text — see `unitKey`.
 *
 * ## Why grams are quoted per kilo
 *
 * A shelf where one item reads `$0.012/g` and the next reads `$12.00/kg` is a
 * shelf nobody can compare, which is the whole reason a per-unit price exists.
 * So each unit names a dimension and a factor to that dimension's canonical
 * unit, and the figure is always quoted per canonical unit: per kg, per litre,
 * per piece.
 *
 * ## The per-unit price is display only
 *
 * Derived on the way to the screen and never written back — the same rule
 * `convertMoney` states. It is `price / quantity`, which does not divide evenly
 * in general, so it rounds; a rounded figure stored and later multiplied back
 * out would be money that drifts, which is the thing integer minor units exist
 * to prevent.
 */

/** The units `menu_items_price_unit_known` allows. */
export type PriceUnit = "g" | "kg" | "ml" | "l" | "piece";

export const PRICE_UNITS: readonly PriceUnit[] = [
  "kg",
  "g",
  "l",
  "ml",
  "piece",
] as const;

/**
 * What each unit measures, and how much of the canonical one it is.
 *
 * `canonical` is the unit a per-unit price is quoted in for that dimension, so
 * both members of a pair land on the same figure and can be compared.
 */
const SCALE: Record<PriceUnit, { canonical: PriceUnit; factor: number }> = {
  kg: { canonical: "kg", factor: 1 },
  g: { canonical: "kg", factor: 0.001 },
  l: { canonical: "l", factor: 1 },
  ml: { canonical: "l", factor: 0.001 },
  piece: { canonical: "piece", factor: 1 },
};

/**
 * A database value as a `PriceUnit`, or null if it is not one.
 *
 * `menu_items_price_unit_known` already refuses anything else, so this is not a
 * second guard — it is the narrowing that lets the rest of the app hold the
 * union rather than a bare string. A row written before a unit was removed from
 * the vocabulary reads as "no unit" rather than crashing a menu.
 */
export function asPriceUnit(value: unknown): PriceUnit | null {
  return typeof value === "string" && (PRICE_UNITS as readonly string[]).includes(value)
    ? (value as PriceUnit)
    : null;
}

/** Where the unit's word lives in the translation bundle. */
export function unitKey(unit: PriceUnit): `units.${PriceUnit}` {
  return `units.${unit}`;
}

export type ItemUnit = {
  unit: PriceUnit;
  /** How many of `unit` one item is. Always positive — `0095` refuses zero. */
  quantity: number;
};

/**
 * The pair off a row, or `null` when the item is simply sold as itself.
 *
 * One place that decides an item "has a unit", so no screen has to remember
 * that the two columns travel together.
 */
export function itemUnit(row: {
  priceUnit?: string | null;
  unitQuantity?: number | null;
}): ItemUnit | null {
  const unit = row.priceUnit;
  const quantity = row.unitQuantity;

  if (!unit || quantity == null) return null;
  if (!(quantity > 0)) return null;
  if (!(unit in SCALE)) return null;

  return { unit: unit as PriceUnit, quantity };
}

/**
 * What one canonical unit costs, in minor units — `null` when it says nothing.
 *
 * Null for a single piece, deliberately: an item that is one piece priced at
 * $12.00 would echo "$12.00 per piece" beside "$12.00", which is the same
 * number twice and reads as a mistake. The figure is worth drawing exactly when
 * it is *not* the price already on screen.
 *
 * Rounds once, at the end, for the reason `convertMoney` gives: the division is
 * the only float in the expression and rounding it early would compound.
 */
export function pricePerUnit(
  minorUnits: number,
  unit: ItemUnit,
): { amount: number; unit: PriceUnit } | null {
  const { canonical, factor } = SCALE[unit.unit];
  const canonicalQuantity = unit.quantity * factor;

  if (!(canonicalQuantity > 0)) return null;
  // Exactly one of the thing already shown. Nothing to add.
  if (canonical === "piece" && canonicalQuantity === 1) return null;

  return {
    amount: Math.round(minorUnits / canonicalQuantity),
    unit: canonical,
  };
}
