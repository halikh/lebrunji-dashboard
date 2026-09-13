/**
 * Which rate an order's figures are read at.
 *
 * `0120` let a shop quote its own lira-per-dollar, because two shops on the
 * same street quote different ones. An order is priced and charged in
 * `orders.currency_code` and none of that moves; what moves is the **second**
 * figure the dashboard writes under a total, and reading it at the platform's
 * rate when the shop quotes its own gives an operator a number that shop would
 * not honour at the door.
 *
 * ## The rule, and why it is written once
 *
 * One shop on the order and it is that shop's — the overwhelmingly common
 * order, and the one where the customer has just read a menu at that rate.
 * More than one and it is the platform's: two shops quoting two rates give a
 * cross-shop total no single rate is right for, and picking one of them would
 * be the dashboard deciding whose dollar is the real one.
 *
 * The storefront applies the same rule to a cart and to an order. Three copies
 * of it were one copy too many already: the order panel, the customer's
 * history and the app all show the *same order's total*, and a rule that
 * differed between them would put two different lira figures on one receipt.
 * So the queries each fetch `exchange_rate` for themselves and this decides
 * what to do with it.
 */

/** The shape every caller's embed already has — `select` decides the rest. */
type Portion = Record<string, unknown>;

function firstOf(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  return null;
}

/**
 * The rate an order reads at, from its `order_stores` embed.
 *
 * Each portion must carry `store_id` and an embedded `stores ( exchange_rate )`
 * for this to find anything; a query that did not ask gets null, which is the
 * platform's rate and exactly what every figure did before `0120`.
 *
 * Distinct **shops**, not portions: an order is one portion per shop today, but
 * counting portions would quietly stop being the same question if that changed,
 * and this has to mean "one shop" to be safe.
 *
 * `numeric` arrives from PostgREST as a string — exact there, parsed once here.
 * A non-positive or unparseable value reads as null. `0120`'s CHECK refuses one
 * in the column, so it could only be a shape fault, and the platform's rate is
 * merely the old answer where a conversion through a zero is a confident wrong
 * one.
 */
export function oneShopRate(portions: Portion[]): number | null {
  const shops = new Map<string, unknown>();
  for (const portion of portions) {
    shops.set(
      String(portion.store_id ?? ""),
      firstOf(portion.stores)?.exchange_rate ?? null,
    );
  }
  if (shops.size !== 1) return null;

  const raw = [...shops.values()][0];
  if (raw == null) return null;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
