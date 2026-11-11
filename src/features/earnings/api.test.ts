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
  deliveryWaived: 0,
  freeDeliveries: 0,
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
      deliveryWaived: 0,
      freeDeliveries: 0,
    });
    expect(groups[1]?.totals.earning).toBe(90_000);
  });

  it("adds up free delivery apart from delivery paid, per currency", () => {
    const groups = groupByCurrency([
      row({ delivery: 0, deliveryWaived: 200, freeDeliveries: 1 }),
      row({ storeId: "s2", delivery: 200 }),
      row({
        currencyCode: "LBP",
        delivery: 0,
        deliveryWaived: 150_000,
        freeDeliveries: 1,
      }),
    ]);

    const usd = groups.find((group) => group.currencyCode === "USD");
    expect(usd?.totals.delivery).toBe(200);
    expect(usd?.totals.deliveryWaived).toBe(200);
    expect(usd?.totals.freeDeliveries).toBe(1);
    const lbp = groups.find((group) => group.currencyCode === "LBP");
    expect(lbp?.totals.deliveryWaived).toBe(150_000);
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
