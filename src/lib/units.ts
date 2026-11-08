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
 * ## A step means the price is a rate
 *
 * Migration `0122`. With a step, `price` is the price of `unit_quantity` of the
 * thing and any other amount costs it in proportion — 1 kg at $12.00 makes
 * 1.5 kg $18.00. Without one, the stepper counts things and the price is per
 * thing, which is every item written before `0122` and every item still sold by
 * the pack. `linePrice` is the only place that arithmetic lives.
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
export type PriceUnit = "g" | "kg" | "ml" | "l" | "piece" | "bag" | "pack";

export const PRICE_UNITS: readonly PriceUnit[] = [
  "kg",
  "g",
  "l",
  "ml",
  "piece",
  "bag",
  "pack",
] as const;

/**
 * The units `menu_items_size_unit_known` allows (`0262`): a dish's display-only
 * size, "900 g" under the name of a bag of rice.
 *
 * Not a `PriceUnit` and never used to price or count anything — that is
 * "Sold by" above. A size is information only, so it has no counted units and
 * one length (`cm`) the price units do not.
 */
export type SizeUnit = "g" | "kg" | "ml" | "l" | "cm";

export const SIZE_UNITS: readonly SizeUnit[] = [
  "g",
  "kg",
  "ml",
  "l",
  "cm",
] as const;

/** A database value as a `SizeUnit`, or null — as `asPriceUnit`. */
export function asSizeUnit(value: unknown): SizeUnit | null {
  return typeof value === "string" &&
    (SIZE_UNITS as readonly string[]).includes(value)
    ? (value as SizeUnit)
    : null;
}

/** Where a size unit's word lives in the translation bundle. */
export function sizeUnitKey(unit: SizeUnit): `units.${SizeUnit}` {
  return `units.${unit}`;
}

/**
 * The units that count things rather than measure them — `0258` added bags
 * and packs beside the piece.
 *
 * Each is its own dimension: a bag is not some number of pieces, so a bag is
 * compared only with another bag. They share what a piece always had: no
 * weight cap (`AMOUNT_MAX`), no per-unit figure for a single one, and a word
 * that is a noun and inflects ("2 bags").
 */
export type CountUnit = "piece" | "bag" | "pack";

export function isCountUnit(unit: PriceUnit): unit is CountUnit {
  return unit === "piece" || unit === "bag" || unit === "pack";
}

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
  bag: { canonical: "bag", factor: 1 },
  pack: { canonical: "pack", factor: 1 },
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
  if (isCountUnit(canonical) && canonicalQuantity === 1) return null;

  return {
    amount: Math.round(minorUnits / canonicalQuantity),
    unit: canonical,
  };
}

/**
 * How much of the unit the customer has asked for, at a given press count.
 *
 * The cart still counts in whole lines — `cart_lines.quantity` is an integer —
 * and this is the translation from that count into what the screen says: the
 * amount. What the amount *costs* is `linePrice`, which since `0122` is a
 * proportion of it rather than a multiple of the price.
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

/**
 * The most of one thing a basket line holds by weight or volume (`0182`): 20 kg
 * or 20 L, in whichever of the two units the item is sold by. Null for the
 * counted units — pieces, bags, packs — whose only cap is the press count.
 */
export const AMOUNT_MAX: Record<PriceUnit, number | null> = {
  kg: 20,
  l: 20,
  g: 20_000,
  ml: 20_000,
  piece: null,
  bag: null,
  pack: null,
};

/**
 * How many presses one line may reach: `maxCount` (the 50 of `0173`), and for
 * an item sold by weight or volume no more than `AMOUNT_MAX` of it — the same
 * arithmetic as `unitAmount`, run backwards, and as the database's own check.
 * A fixed pack (no step) counts its own size per press (`0184`): forty 500 g
 * packs are 20 kg, the same as a stepper reaching it.
 */
export function maxPresses(unit: ItemUnit | null, maxCount: number): number {
  if (!unit) return maxCount;
  const max = AMOUNT_MAX[unit.unit];
  if (max == null) return maxCount;
  const step = unit.step ?? unit.quantity;
  // The small epsilon absorbs `0.1`-style steps that land exactly on the cap.
  const presses = Math.floor((max - unit.quantity) / step + 1e-9) + 1;
  return Math.max(1, Math.min(maxCount, presses));
}

/**
 * How many presses one line may reach beside the basket's other lines of the
 * same dish (`0220`): the caps are per dish, so what the others hold comes off
 * both the count and the weight.
 *
 * With nothing beside it this is {@link maxPresses}. Unlike it, this can be
 * zero — the others may already hold the whole cap.
 */
export function maxPressesBeside(
  unit: ItemUnit | null,
  maxCount: number,
  beside: readonly { unit: ItemUnit | null; quantity: number }[],
): number {
  if (beside.length === 0) return maxPresses(unit, maxCount);
  const count = maxCount - beside.reduce((sum, line) => sum + line.quantity, 0);
  const max = unit ? AMOUNT_MAX[unit.unit] : null;
  if (!unit || max == null) return Math.max(0, count);
  const held = beside.reduce(
    (sum, line) => sum + (line.unit ? unitAmount(line.unit, line.quantity) : 0),
    0,
  );
  const room = max - held;
  const step = unit.step ?? unit.quantity;
  const presses =
    room + 1e-9 < unit.quantity
      ? 0
      : Math.floor((room - unit.quantity) / step + 1e-9) + 1;
  return Math.max(0, Math.min(count, presses));
}

/**
 * What one line costs, in minor units.
 *
 * ## The two cases, and why they are one function
 *
 * An item with no step is a *count* of things: three 500 g packs are three
 * times the price of a pack, and an option chosen on it was chosen on each one.
 * That is `(price + options) × count` — what the cart did before `0122`, and
 * what it still does for every item that has no step.
 *
 * An item *with* a step is sold by amount, and the price is a **rate**: the
 * price of `quantity` of the unit. Any other amount costs it in proportion.
 *
 *     1 kg at $12.00  →  1.5 kg is $18.00,  1.25 kg is $15.00
 *
 * Migration `0119` left this open on purpose and the dashboard carried the
 * refusal to the operator as a warning beside the field. `0122` decided it: a
 * shop quoting per kilo means per kilo.
 *
 * ## Options are not weighed
 *
 * A $1.00 vacuum-pack charge on 2 kg of meat is $1.00 — something done once to
 * the line rather than a property of the weight — so it is added after the
 * proportion rather than scaled inside it.
 *
 * `unitPrice` is the item *plus* its options, which is the number
 * `order_lines.unit_price` has always held, so the item's own share is the
 * subtraction below. The pair is passed rather than the difference because a
 * caller that had to do the subtraction itself is a caller that can get it
 * backwards.
 *
 * ## The rounding
 *
 * Once, at the end, for the reason `pricePerUnit` gives — and on the *amount*
 * before that, inside `unitAmount`, because `numeric(10, 3)` is the whole
 * precision either column has. `line_price` in `0122` is this function in SQL
 * and rounds in both the same places. The two drifting apart is the silent
 * class of bug `supabase/tests/branch-pricing.sql` exists for.
 *
 * ## Another currency is rounded per unit, on purpose
 *
 * A line priced in a currency other than its shop's arrives here already
 * converted, one unit at a time (`priced_cart_lines`, `0134`), and is then
 * multiplied. So three of a 70,000 LBP dish are 3 × 79¢ = 237¢, not the 236¢
 * converting the whole line would give. That is deliberate (user, 2026-11-03):
 * `order_lines.unit_price` is stored in the order's currency and the receipt
 * reads quantity × unit price, so per-unit rounding keeps every line on it
 * adding up. Converting the total instead is a cent closer to the rate and
 * prints a line that does not multiply out. It moves a line by at most half a
 * minor unit per unit, either way.
 */
export function linePrice(
  /** The price of one press: the item plus every option on the line. */
  unitPrice: number,
  /** The options' share of it — the part that is added, never scaled. */
  options: number,
  /** The item's unit, or null when it is simply sold as itself. */
  unit: ItemUnit | null,
  /** The press count. `cart_lines.quantity`, always whole. */
  count: number,
): number {
  const presses = Math.max(1, Math.trunc(count));

  // No step is the counted stepper, and a count is a multiplier. A null unit
  // lands here too — an item sold as itself has nothing to be proportional to —
  // as does a non-positive quantity, which cannot be divided by. `0095` refuses
  // one from the database; this covers an `ItemUnit` built by hand.
  if (!unit || unit.step === null || !(unit.quantity > 0)) {
    return unitPrice * presses;
  }

  return (
    Math.round(
      ((unitPrice - options) * unitAmount(unit, presses)) / unit.quantity,
    ) + options
  );
}

/**
 * A `numeric(10, 3)` column off the wire, as a number — or null.
 *
 * PostgREST sends `numeric` as a **string**: it is arbitrary precision and JSON
 * has no type for that. `unit_quantity` and `unit_step` are the two columns
 * here that are one, and a screen that forgot would add "5" to 5 and get "55",
 * which is why the parse lives beside them rather than at each stepper.
 *
 * Anything unparseable reads as null — "no unit", the state every item without
 * one is already in — rather than as a `NaN` that would spread into money.
 */
export function unitNumber(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
