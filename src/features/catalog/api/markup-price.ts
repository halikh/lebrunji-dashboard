/**
 * A price on markup, as staff type it: what the shop charges us, and what we
 * add on top (user, 2026-11-08).
 *
 * Nothing new is stored. The app price stays where it always was
 * (`menu_items.price`, `item_options.price`, `branch_item_prices.price`,
 * `branch_option_prices.price`) and the shop's price is the store price
 * (`item_store_prices` / `option_store_prices`, `0262`). The markup is never
 * a column: it is always app price − store price, worked out here on the way
 * to the screen and added back on the way to the database.
 *
 * All in integer minor units of one currency — cents, or lira with no
 * decimals — so the sum is exact and there is nothing to round.
 */

/** The two boxes, null while empty. */
export type MarkupEntry = { shopPrice: number | null; markup: number | null };

/**
 * A saved price as the two boxes. With no store price there is no split to
 * show: both start empty, and the app price stands on its own.
 */
export function splitPrice(
  price: number | null,
  storePrice: number | null,
): MarkupEntry {
  if (price === null) return { shopPrice: null, markup: null };
  // No price from the shop yet: today the shop is paid the whole price, which
  // is a markup of nothing — so that is what the two boxes say.
  if (storePrice === null) return { shopPrice: price, markup: 0 };
  return { shopPrice: storePrice, markup: price - storePrice };
}

export type Combined =
  /** Both empty: a plain price, and no store price row. */
  | { kind: "plain" }
  /** Both filled: what to write. */
  | { kind: "split"; price: number; storePrice: number }
  /** Refused, with the key of the sentence that says why. */
  | {
      kind: "invalid";
      problem: "earnings.bothNeeded" | "earnings.markupNegative";
    };

/** The two boxes as the app price and the store price, or why not. */
export function combinePrice(entry: MarkupEntry): Combined {
  const { shopPrice, markup } = entry;
  // On markup the two boxes are the price: both are needed.
  if (shopPrice === null || markup === null) {
    return { kind: "invalid", problem: "earnings.bothNeeded" };
  }
  // Below zero we would sell at a loss on every one.
  if (markup < 0)
    return { kind: "invalid", problem: "earnings.markupNegative" };
  return { kind: "split", price: shopPrice + markup, storePrice: shopPrice };
}

/**
 * What the shop now charges, keeping what we keep — for a box that edits the
 * shop's price alone (a branch's row). With a store price already there the
 * markup is kept and the app price moves; giving one for the first time keeps
 * the app price, and the markup is whatever is left. Null when that would be
 * below zero.
 */
export function withShopPrice(
  shopPrice: number,
  current: { price: number; storePrice: number | null },
): { price: number; markup: number } | null {
  const markup =
    current.storePrice === null
      ? current.price - shopPrice
      : current.price - current.storePrice;
  if (markup < 0) return null;
  return { price: shopPrice + markup, markup };
}

/**
 * A branch's two boxes in a form that saves (the bundle editor's branch
 * list), where an empty box means "the shop's" — as on the branch Menu tab.
 *
 * - Both empty: the branch follows the shop for this item (`follow`): its own
 *   app price and its own price from the shop are both removed.
 * - Otherwise the empty one is the shop's: the shop's price from the shop, or
 *   the shop's markup (its app price less its price from the shop). Neither to
 *   fall back on, and both are needed.
 *
 * `storePrice` is the branch's own row: null when its box was left empty, so
 * the row is removed and the shop's applies.
 */
export type BranchResolved =
  | { kind: "follow" }
  | { kind: "split"; price: number; storePrice: number | null }
  | {
      kind: "invalid";
      problem: "earnings.bothNeeded" | "earnings.markupNegative";
    };

export function resolveBranchEntry(
  entry: MarkupEntry,
  shop: { price: number | null; storePrice: number | null },
): BranchResolved {
  if (entry.shopPrice === null && entry.markup === null) {
    return { kind: "follow" };
  }
  const shopPrice = entry.shopPrice ?? shop.storePrice;
  const markup =
    entry.markup ??
    (shop.price !== null && shop.storePrice !== null
      ? shop.price - shop.storePrice
      : null);
  if (shopPrice === null || markup === null) {
    return { kind: "invalid", problem: "earnings.bothNeeded" };
  }
  if (markup < 0)
    return { kind: "invalid", problem: "earnings.markupNegative" };
  return {
    kind: "split",
    price: shopPrice + markup,
    storePrice: entry.shopPrice,
  };
}
