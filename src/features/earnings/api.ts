import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

import type { EarningsModel } from "@/features/catalog/api/earnings";

/**
 * What the platform earned from each shop and branch over a period —
 * `api_v1_admin_earnings` (`0262`).
 *
 * One row per shop, branch, model and currency, for orders placed in
 * `[from, to)`. Cancelled portions are left out by the function. Only orders
 * placed from `0262` on have figures at all — the ones before were never
 * charged a commission, and nothing here invents one for them.
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
  model: EarningsModel;
  currencyCode: string;
  orders: number;
  /** What customers paid for the shop's part, delivery left out. */
  sales: number;
  /** The platform's: commission or markup. */
  earning: number;
  /** What drivers paid the shop at pickup. */
  storeDue: number;
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

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    storeId: row.store_id as string,
    storeName: (row.store_name as Localized | null) ?? {},
    branchId: (row.branch_id as string | null) ?? null,
    branchName: (row.branch_name as Localized | null) ?? null,
    model: row.model === "markup" ? "markup" : "commission",
    currencyCode: row.currency_code as string,
    // `bigint` arrives as a number from PostgREST for values this size.
    orders: Number(row.orders ?? 0),
    sales: Number(row.sales ?? 0),
    earning: Number(row.earning ?? 0),
    storeDue: Number(row.store_due ?? 0),
  }));
}

export type CurrencyGroup = {
  currencyCode: string;
  rows: EarningsRow[];
  totals: { orders: number; sales: number; earning: number; storeDue: number };
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
        totals: { orders: 0, sales: 0, earning: 0, storeDue: 0 },
      };
      groups.set(row.currencyCode, group);
    }
    group.rows.push(row);
    group.totals.orders += row.orders;
    group.totals.sales += row.sales;
    group.totals.earning += row.earning;
    group.totals.storeDue += row.storeDue;
  }
  return [...groups.values()].sort((a, b) => b.totals.orders - a.totals.orders);
}
