import { describe, expect, it } from "vitest";

import type { EarningsRow } from "./api";
import { earnedByStore, earnedIn, earnedText, earnedTotals } from "./summary";

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

const format = (minor: number, code: string) => `${code} ${minor}`;

describe("earnedTotals", () => {
  it("adds commission and markup, branches and shops, in one currency", () => {
    expect(
      earnedTotals([
        row({ earning: 100 }),
        row({ branchId: "b2", model: "markup", earning: 250 }),
        row({ storeId: "s2", earning: 50 }),
      ]),
    ).toEqual([{ currencyCode: "USD", amount: 400 }]);
  });

  it("keeps each currency apart", () => {
    expect(
      earnedTotals([
        row({ earning: 100 }),
        row({ currencyCode: "LBP", earning: 90_000 }),
        row({ storeId: "s2", currencyCode: "LBP", earning: 45_000 }),
      ]),
    ).toEqual([
      { currencyCode: "LBP", amount: 135_000 },
      { currencyCode: "USD", amount: 100 },
    ]);
  });

  it("is empty when nothing was earned", () => {
    expect(earnedTotals([])).toEqual([]);
  });
});

describe("earnedByStore", () => {
  it("folds each shop's branches and models, per currency", () => {
    const map = earnedByStore([
      row({ storeId: "s1", branchId: "a", earning: 100 }),
      row({ storeId: "s1", branchId: "b", model: "markup", earning: 300 }),
      row({ storeId: "s1", currencyCode: "LBP", earning: 90_000 }),
      row({ storeId: "s2", earning: 20 }),
    ]);
    expect(map.get("s1")).toEqual([
      { currencyCode: "LBP", amount: 90_000 },
      { currencyCode: "USD", amount: 400 },
    ]);
    expect(map.get("s2")).toEqual([{ currencyCode: "USD", amount: 20 }]);
    expect(map.get("s3")).toBeUndefined();
  });
});

describe("earnedIn", () => {
  it("is the currency's figure, or nothing", () => {
    const totals = [{ currencyCode: "USD", amount: 400 }];
    expect(earnedIn(totals, "USD")).toBe(400);
    expect(earnedIn(totals, "LBP")).toBe(0);
  });
});

describe("earnedText", () => {
  it("is a dash for a shop with no earnings rows", () => {
    expect(earnedText(undefined, format)).toBe("—");
    expect(earnedText([], format)).toBe("—");
  });

  it("joins mixed currencies with commas", () => {
    expect(
      earnedText(
        [
          { currencyCode: "LBP", amount: 90_000 },
          { currencyCode: "USD", amount: 400 },
        ],
        format,
      ),
    ).toBe("LBP 90000, USD 400");
  });
});
