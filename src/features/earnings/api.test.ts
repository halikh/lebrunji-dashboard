import { describe, expect, it } from "vitest";

import { groupByCurrency, type EarningsRow } from "./api";

const row = (over: Partial<EarningsRow>): EarningsRow => ({
  storeId: "s1",
  storeName: { en: "Grill House" },
  branchId: null,
  branchName: null,
  branchAddress: null,
  model: "commission",
  currencyCode: "USD",
  orders: 1,
  sales: 1000,
  earning: 100,
  storeDue: 900,
  delivery: 200,
  ...over,
});

describe("groupByCurrency", () => {
  it("never adds one currency to another", () => {
    const groups = groupByCurrency([
      row({ currencyCode: "USD", orders: 3, earning: 300 }),
      row({ currencyCode: "LBP", orders: 1, earning: 90_000, delivery: 0 }),
      row({ storeId: "s2", currencyCode: "USD", orders: 2, earning: 50 }),
    ]);

    expect(groups.map((group) => group.currencyCode)).toEqual(["USD", "LBP"]);
    expect(groups[0]?.totals).toEqual({
      orders: 5,
      sales: 2000,
      earning: 350,
      storeDue: 1800,
      delivery: 400,
    });
    expect(groups[1]?.totals.earning).toBe(90_000);
  });

  it("keeps the function's order within a currency", () => {
    const groups = groupByCurrency([
      row({ storeId: "a", earning: 500 }),
      row({ storeId: "b", earning: 100 }),
    ]);
    expect(groups[0]?.rows.map((one) => one.storeId)).toEqual(["a", "b"]);
  });

  it("is empty for an empty period", () => {
    expect(groupByCurrency([])).toEqual([]);
  });
});
