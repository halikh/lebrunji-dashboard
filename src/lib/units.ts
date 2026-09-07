/**
 * What quantity an item's price buys, and what that comes to per unit.
 *
 * **Copied verbatim between the dashboard and the app**, the same arrangement
 * `lib/money.ts` describes and for the same reason: a shop that quoted one
 * per-kilo figure to the operator and another to the customer would have two
 * numbers that are each right about something different.
 *
 * ## The three columns
 *
 * `menu_items.price_unit` is a key — `kg`, `g`, `l`, `ml`, `piece` — and
 * `unit_quantity` says how many of it one item is. A one-kilo pack is
 * `('kg', 1)`; the same pack described the other way is `('g', 500)` only if it
 * is actually half a kilo. Migration `0095` refuses one without the other,
 * because a unit with no quantity and a quantity with no unit are both
 * unrenderable.
 *
 * `unit_step` — migration `0119` — is how far one press of the customer's `+`
 * or `−` moves. With `('kg', 5, 5)` the stepper starts at 5 kg and walks
 * 5 → 10 → 15, and back down to 5 and no further: `unit_quantity` is both the
 * starting amount and the floor, which is what "we sell from five kilos" means.
 *
 * Null is the old behaviour and the common one: the stepper counts whole items
 * and the unit is a label under the name. See `unitAmount`, which is the only
 * place the arithmetic lives.
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
  return typeof value === "string" &&
    (PRICE_UNITS as readonly string[]).includes(value)
    ? (value as PriceUnit)
    : null;
}

/** Where the unit's word lives in the translation bundle. */
export function unitKey(unit: PriceUnit): `units.${PriceUnit}` {
  return `units.${unit}`;
}

export type ItemUnit = {
  unit: PriceUnit;
  /**
   * How many of `unit` one item is — and, when there is a `step`, the amount
   * the stepper opens on and will not go below.
   *
   * Always positive — `0095` refuses zero.
   */
  quantity: number;
  /**
   * How much one press of `+` or `−` moves, in `unit`.
   *
   * Null for the plain whole-item stepper, which is most of the menu. A screen
   * reads this to decide *what to draw* — an amount, or a count — while
   * `unitAmount` handles both without being asked which it is.
   *
   * Positive when set: `0119` refuses zero, which would be a stepper that
   * cannot move.
   */
  step: number | null;
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
  /** Absent on a build older than `0119`, which reads as the plain stepper. */
  unitStep?: number | null;
}): ItemUnit | null {
  const unit = row.priceUnit;
  const quantity = row.unitQuantity;
  const step = row.unitStep;

  if (!unit || quantity == null) return null;
  if (!(quantity > 0)) return null;
  if (!(unit in SCALE)) return null;

  return {
    unit: unit as PriceUnit,
    quantity,
    // A non-positive step is dropped rather than carried: `0119`'s CHECK means
    // it cannot arrive from the database, but an item can also be built by
    // hand here — and a zero that reached the stepper would be a `+` that
    // does nothing rather than a visible failure.
    step: step != null && step > 0 ? step : null,
  };
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
  /**
   * The two columns this reads, rather than the whole `ItemUnit`.
   *
   * A per-unit price is a fact about what one line *is*, and the step is a fact
   * about how the customer walks through them — `$12.00/kg` is the same figure
   * whether the buttons move by a kilo or by five. Narrowed so the signature
   * says which of the three it depends on.
   */
  unit: Pick<ItemUnit, "unit" | "quantity">,
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

/**
 * How much of the unit the customer has asked for, at a given press count.
 *
 * The cart still counts in whole lines — `cart_lines.quantity` is an integer
 * and the money is `price × quantity`, unchanged by `0119`. This is the
 * translation from that count into what the screen says: the amount.
 *
 * ## Why the null step falls out rather than being special-cased
 *
 * `quantity + (count − 1) × step` with `step` defaulting to `quantity` is
 * exactly `quantity × count` — three 500 g packs are 1500 g. So an item with
 * no step gets the arithmetically right answer from the same expression, and
 * the only thing the null decides is whether a screen *shows* an amount or a
 * count. That is a rendering question and it stays on the screen.
 *
 * ## The rounding
 *
 * `numeric(10, 3)` on both columns, so three decimals is the whole precision
 * either number has. Binary floating point cannot hold 0.1, and a stepper left
 * to accumulate would reach `0.30000000000000004 kg` after two presses — a
 * number that is right to within a picogram and reads as a bug. Rounded once,
 * at the end, for the reason `pricePerUnit` gives.
 */
export function unitAmount(unit: ItemUnit, count: number): number {
  // The stepper's own floor is 1 press. A caller that has somehow reached zero
  // gets the starting amount rather than a negative one.
  const presses = Math.max(1, Math.trunc(count));
  const step = unit.step ?? unit.quantity;
  return Math.round((unit.quantity + (presses - 1) * step) * 1000) / 1000;
}
