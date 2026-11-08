import type { EarningsRow } from "./api";

/**
 * What we earned, folded for the Reports page: one figure per currency for
 * the whole range, and the same per shop. `api_v1_admin_earnings` answers per
 * shop, branch, model and currency; Reports asks only "how much", commission
 * and markup together, so the branches and models are added up here — but
 * never across currencies, which would add dollars to lira.
 *
 * Orders placed before `0262` have no rows, so they simply add nothing.
 */
export type Earned = { currencyCode: string; amount: number };

function fold(rows: readonly EarningsRow[]): Earned[] {
  const byCode = new Map<string, number>();
  for (const row of rows) {
    byCode.set(
      row.currencyCode,
      (byCode.get(row.currencyCode) ?? 0) + row.earning,
    );
  }
  // The largest first; a tie by code, so the order is the same every time.
  return [...byCode.entries()]
    .map(([currencyCode, amount]) => ({ currencyCode, amount }))
    .sort(
      (a, b) =>
        b.amount - a.amount || a.currencyCode.localeCompare(b.currencyCode),
    );
}

/** The range's total, one entry per currency. Empty when nothing was earned. */
export function earnedTotals(rows: readonly EarningsRow[]): Earned[] {
  return fold(rows);
}

/** Each shop's total, one entry per currency, by store id. */
export function earnedByStore(
  rows: readonly EarningsRow[],
): Map<string, Earned[]> {
  const byStore = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byStore.get(row.storeId) ?? [];
    list.push(row);
    byStore.set(row.storeId, list);
  }
  return new Map(
    [...byStore.entries()].map(([storeId, list]) => [storeId, fold(list)]),
  );
}

/** One currency's figure, 0 when it earned nothing in it. */
export function earnedIn(totals: readonly Earned[], code: string): number {
  return totals.find((one) => one.currencyCode === code)?.amount ?? 0;
}

/**
 * The figures as one cell: "$12.00, 90,000 ل.ل", or "—" for a shop with no
 * earnings rows in the range.
 */
export function earnedText(
  earned: readonly Earned[] | undefined,
  format: (minor: number, code: string) => string,
): string {
  if (!earned || earned.length === 0) return "—";
  return earned.map((one) => format(one.amount, one.currencyCode)).join(", ");
}
