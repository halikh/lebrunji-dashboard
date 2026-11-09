import { t } from "@/i18n/translations";
import { PAGE } from "@/lib/limits";
import { getClient } from "@/lib/supabase/client";

/**
 * What the platform earns from a shop — `0262`.
 *
 * ## Two ways to earn, per shop and per branch
 *
 * `store_earnings` holds one row for the shop (`branch_id` null) and, where a
 * branch differs, one for that branch. A branch row's nulls follow the shop's,
 * the way its prices do (`0101`). No row at all is commission at no rate: the
 * shop is paid everything, which is what every order before `0262` was.
 *
 * - **Commission** — a percentage of the shop's part of the order, delivery
 *   left out.
 * - **Markup** — every app price can have a *store price* beside it: what the
 *   shop is paid. The platform keeps the difference. No store price means no
 *   markup on that thing.
 *
 * ## Staff only, never on the public rows
 *
 * Every table here is `is_admin()` behind RLS. Customers read `menu_items` and
 * `item_options` with the anon key, so a store price in a column there would
 * be a REST call away from every phone. Nothing in this file may move these
 * figures onto a row the app reads.
 */

export type EarningsModel = "commission" | "markup";

export const EARNINGS_MODELS: readonly EarningsModel[] = [
  "commission",
  "markup",
] as const;

/** One `store_earnings` row. Nulls on a branch row follow the shop's. */
export type StoreEarnings = {
  model: EarningsModel | null;
  /** 0–100, two decimals. Null is "no rate" on the shop, "the shop's" on a branch. */
  commissionPercent: number | null;
};

export type ShopEarnings = {
  /** The shop's own row, or null when it has none (commission, no rate). */
  shop: StoreEarnings | null;
  /** Branch id → that branch's row, only where one exists. */
  branches: Map<string, StoreEarnings>;
};

/** What actually applies at one place, every null resolved. */
export type EffectiveEarnings = {
  model: EarningsModel;
  /** Null on markup, and on commission with no rate set anywhere. */
  commissionPercent: number | null;
};

function asModel(value: unknown): EarningsModel | null {
  return value === "commission" || value === "markup" ? value : null;
}

/** `numeric` arrives as a string from PostgREST. */
function asPercent(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The model and rate that apply, the way `order_stores_take_the_rate` resolves
 * them when an order is written: the branch's, else the shop's, else
 * commission. The rate follows the same chain, and only means anything on
 * commission.
 */
export function effectiveEarnings(
  shop: StoreEarnings | null | undefined,
  branch?: StoreEarnings | null,
): EffectiveEarnings {
  const model = branch?.model ?? shop?.model ?? "commission";
  return {
    model,
    commissionPercent:
      model === "commission"
        ? (branch?.commissionPercent ?? shop?.commissionPercent ?? null)
        : null,
  };
}

/** Whether a store price means anything anywhere in this shop. */
export function usesMarkup(earnings: ShopEarnings | undefined): boolean {
  // The shop's own model only (user, 2026-11-08). A branch on markup under a
  // shop on commission is priced on that branch's Menu tab.
  return earnings ? effectiveEarnings(earnings.shop).model === "markup" : false;
}

export async function fetchShopEarnings(
  storeId: string,
): Promise<ShopEarnings> {
  const { data, error } = await getClient()
    .from("store_earnings")
    .select("branch_id, model, commission_percent")
    .eq("store_id", storeId)
    .limit(PAGE.maxRows);

  if (error) throw new Error(`Could not read the earnings: ${error.message}`);

  let shop: StoreEarnings | null = null;
  const branches = new Map<string, StoreEarnings>();
  for (const row of data ?? []) {
    const entry: StoreEarnings = {
      model: asModel(row.model),
      commissionPercent: asPercent(row.commission_percent),
    };
    const branchId = row.branch_id as string | null;
    if (branchId) branches.set(branchId, entry);
    else shop = entry;
  }
  return { shop, branches };
}

/**
 * Writes the shop's row (`branchId` null) or one branch's.
 *
 * A branch with both fields null is a branch that follows the shop, which is
 * what having no row says — so the row is **deleted** rather than kept holding
 * two nulls, the way a cleared branch price is (`api/branch-menu.ts`).
 */
export async function saveStoreEarnings(
  storeId: string,
  branchId: string | null,
  earnings: StoreEarnings,
): Promise<void> {
  const client = getClient();

  if (
    branchId !== null &&
    earnings.model === null &&
    earnings.commissionPercent === null
  ) {
    const { error } = await client
      .from("store_earnings")
      .delete()
      .eq("store_id", storeId)
      .eq("branch_id", branchId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("store_earnings").upsert(
    {
      store_id: storeId,
      branch_id: branchId,
      model: earnings.model,
      commission_percent: earnings.commissionPercent,
    },
    { onConflict: "store_id,branch_id" },
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Store prices, for markup
// ---------------------------------------------------------------------------

/**
 * The shop-wide store prices (`branch_id` null), in the shop's currency.
 *
 * A branch's own are read with its overrides (`fetchBranchOverrides`), beside
 * the branch prices they mirror.
 */
export type ShopStorePrices = {
  /** Menu item id (bundles included) → store price, minor units. */
  items: Map<string, number>;
  /** Item option id → store price, minor units. */
  options: Map<string, number>;
};

/** The server's own cap on one response (`max_rows`): read this much at a time. */
const ROWS_AT_A_TIME = 1000;

/** Reads page after page until one comes back short. */
async function everyRow<Row>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<{ data: Row[]; error: { message: string } | null }> {
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await page(
      rows.length,
      rows.length + ROWS_AT_A_TIME - 1,
    );
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if ((data ?? []).length < ROWS_AT_A_TIME) {
      return { data: rows, error: null };
    }
  }
}

export async function fetchShopStorePrices(
  storeId: string,
): Promise<ShopStorePrices> {
  const client = getClient();

  // Every row. A dish missing from this map reads as "no store price", and
  // saving it would then write the app price over the shop's.
  const [items, options] = await Promise.all([
    everyRow((from, to) =>
      client
        .from("item_store_prices")
        .select("menu_item_id, store_price, menu_items!inner ( store_id )")
        .is("branch_id", null)
        .eq("menu_items.store_id", storeId)
        .order("menu_item_id")
        .range(from, to),
    ),
    everyRow((from, to) =>
      client
        .from("option_store_prices")
        .select(
          "item_option_id, store_price, item_options!inner ( option_groups!inner ( store_id ) )",
        )
        .is("branch_id", null)
        .eq("item_options.option_groups.store_id", storeId)
        .order("item_option_id")
        .range(from, to),
    ),
  ]);

  const failure = [items, options].find((one) => one.error);
  if (failure?.error) {
    throw new Error(
      `Could not read the store prices: ${failure.error.message}`,
    );
  }

  return {
    items: new Map(
      (items.data ?? []).map((row) => [
        row.menu_item_id as string,
        Number(row.store_price),
      ]),
    ),
    options: new Map(
      (options.data ?? []).map((row) => [
        row.item_option_id as string,
        Number(row.store_price),
      ]),
    ),
  };
}

/**
 * What a markup shop is paid for a dish (or a bundle), or nothing.
 *
 * `branchId` null is the shop's price, in the shop's currency; a branch's is
 * in that branch's currency. `null` **deletes the row** — no store price is
 * no markup on that dish — for the reason `setItemPrice` gives for deleting
 * rather than storing a copy.
 */
export async function setItemStorePrice(
  itemId: string,
  branchId: string | null,
  storePrice: number | null,
): Promise<void> {
  const client = getClient();

  if (storePrice === null) {
    const query = client
      .from("item_store_prices")
      .delete()
      .eq("menu_item_id", itemId);
    const { error } = await (branchId === null
      ? query.is("branch_id", null)
      : query.eq("branch_id", branchId));
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("item_store_prices").upsert(
    {
      menu_item_id: itemId,
      branch_id: branchId,
      store_price: storePrice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "menu_item_id,branch_id" },
  );
  if (error) throw new Error(error.message);
}

/** The same, for a choice. */
export async function setOptionStorePrice(
  optionId: string,
  branchId: string | null,
  storePrice: number | null,
): Promise<void> {
  const client = getClient();

  if (storePrice === null) {
    const query = client
      .from("option_store_prices")
      .delete()
      .eq("item_option_id", optionId);
    const { error } = await (branchId === null
      ? query.is("branch_id", null)
      : query.eq("branch_id", branchId));
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("option_store_prices").upsert(
    {
      item_option_id: optionId,
      branch_id: branchId,
      store_price: storePrice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_option_id,branch_id" },
  );
  if (error) throw new Error(error.message);
}

/** A rate as read: "10", "12.5" — the figure before the % sign. */
export function formatPercent(value: number): string {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

/**
 * A commission rate as typed (`0262`): empty is no rate, otherwise 0–100 with
 * at most two decimals — `numeric(5, 2)` and its CHECK, said before Postgres
 * says it.
 */
export function percentProblem(typed: string): string | undefined {
  const text = typed.trim();
  // Required whenever Commission is chosen (user, 2026-11-08): an empty rate
  // is commission at 0%, which pays the shop everything without anyone
  // having decided that.
  if (text === "") return t("earnings.percentRequired");
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return t("earnings.percentRange");
  }
  if (!/^\d*(\.\d{0,2})?$/.test(text)) {
    return t("earnings.percentDecimals");
  }
  return undefined;
}

/**
 * What a new shop is settled by, as its form says (`0262`): markup, or
 * commission at the rate typed. Null while that is not yet a valid answer —
 * commission with no rate, or one `percentProblem` refuses — which is what
 * the new-shop checklist reads.
 */
export function newShopEarnings(
  model: EarningsModel,
  percent: string,
): StoreEarnings | null {
  if (model === "markup") return { model, commissionPercent: null };
  if (percentProblem(percent)) return null;
  return { model, commissionPercent: Number(percent.trim()) };
}

/**
 * One dish's (or bundle's) own price from the shop at each branch — the
 * `item_store_prices` rows with a `branch_id`, each in its branch's currency.
 */
export async function fetchItemBranchStorePrices(
  itemId: string,
): Promise<Record<string, number>> {
  const { data, error } = await getClient()
    .from("item_store_prices")
    .select("branch_id, store_price")
    .eq("menu_item_id", itemId)
    .not("branch_id", "is", null);
  if (error) {
    throw new Error(`Could not read the store prices: ${error.message}`);
  }
  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.branch_id as string,
      Number(row.store_price),
    ]),
  );
}
