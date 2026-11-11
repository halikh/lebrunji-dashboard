import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

import type { EarningsModel } from "@/features/catalog/api/earnings";

/**
 * What the platform earned from each shop and branch over a period —
 * `api_v1_admin_earnings` (`0262`).
 *
 * One row per shop, branch, model and currency, for orders placed in
 * `[from, to)`. Cancelled portions are left out by the function. Orders from
 * before `0262` were never charged a commission, and are here at no rate
 * (`0273`).
 *
 * Figures are minor units of `currencyCode`, the order's currency, so a shop
 * whose orders came in two currencies is two rows, and nothing here adds them.
 */
export type EarningsRow = {
  storeId: string;
  storeName: Localized;
  /** Null for a portion written before a branch was recorded. */
  branchId: string | null;
  branchName: Localized | null;
  /** Tells apart two rows with the same name. Null when it could not be read. */
  branchAddress: Localized | null;
  model: EarningsModel;
  currencyCode: string;
  orders: number;
  /** What customers paid for the shop's part, delivery left out. */
  sales: number;
  /** The platform's: commission or markup. */
  earning: number;
  /** What drivers paid the shop at pickup. */
  storeDue: number;
  /**
   * What customers paid for delivery (`0274`). One fee per order, split
   * evenly across its shops' portions, so a currency's rows add up to the
   * fees charged and a two-shop order is not counted twice.
   */
  delivery: number;
};

export async function fetchEarnings(
  from: Date,
  to: Date,
): Promise<EarningsRow[]> {
  const { data, error } = await getClient().rpc("api_v1_admin_earnings", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) throw new Error(`Could not read the earnings: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];
  const addresses = await fetchBranchAddresses(
    rows.flatMap((row) => (row.branch_id as string | null) ?? []),
  );

  return rows.map((row) => ({
    storeId: row.store_id as string,
    storeName: (row.store_name as Localized | null) ?? {},
    branchId: (row.branch_id as string | null) ?? null,
    branchName: (row.branch_name as Localized | null) ?? null,
    branchAddress: addresses.get(row.branch_id as string) ?? null,
    model: row.model === "markup" ? "markup" : "commission",
    currencyCode: row.currency_code as string,
    // `bigint` arrives as a number from PostgREST for values this size.
    orders: Number(row.orders ?? 0),
    sales: Number(row.sales ?? 0),
    earning: Number(row.earning ?? 0),
    storeDue: Number(row.store_due ?? 0),
    delivery: Number(row.delivery ?? 0),
  }));
}

/**
 * Each branch's address. Empty on a failed read rather than an error: the
 * address only tells rows apart, and the figures are right without it.
 */
async function fetchBranchAddresses(
  branchIds: readonly string[],
): Promise<Map<string, Localized>> {
  if (branchIds.length === 0) return new Map();

  const { data, error } = await getClient()
    .from("branches")
    .select("id, address")
    .in("id", [...new Set(branchIds)]);

  if (error) return new Map();

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      (row.address as Localized | null) ?? {},
    ]),
  );
}

export type CurrencyGroup = {
  currencyCode: string;
  rows: EarningsRow[];
  totals: {
    orders: number;
    sales: number;
    earning: number;
    storeDue: number;
    delivery: number;
  };
};

/**
 * The rows split by currency, each with its totals — never one total across
 * currencies, which would add dollars to lira. Within a currency the rows
 * keep the function's order (most earned first); currencies are ordered by
 * how many orders they carry.
 */
export function groupByCurrency(rows: readonly EarningsRow[]): CurrencyGroup[] {
  const groups = new Map<string, CurrencyGroup>();
  for (const row of rows) {
    let group = groups.get(row.currencyCode);
    if (!group) {
      group = {
        currencyCode: row.currencyCode,
        rows: [],
        totals: { orders: 0, sales: 0, earning: 0, storeDue: 0, delivery: 0 },
      };
      groups.set(row.currencyCode, group);
    }
    group.rows.push(row);
    group.totals.orders += row.orders;
    group.totals.sales += row.sales;
    group.totals.earning += row.earning;
    group.totals.storeDue += row.storeDue;
    group.totals.delivery += row.delivery;
  }
  return [...groups.values()].sort((a, b) => b.totals.orders - a.totals.orders);
}
