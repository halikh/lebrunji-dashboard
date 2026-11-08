import { describe, expect, it } from "vitest";

import { t } from "@/i18n/translations";

import {
  effectiveEarnings,
  formatPercent,
  newShopEarnings,
  percentProblem,
  usesMarkup,
  type ShopEarnings,
} from "./earnings";

/**
 * Commission and markup, resolved the way `order_stores_take_the_rate`
 * resolves them when an order is written (`0262`): the branch's, else the
 * shop's, else commission at no rate. A screen that resolved them differently
 * would show one model and the order would be settled by another.
 */
describe("effectiveEarnings", () => {
  it("is commission at no rate with no row anywhere", () => {
    expect(effectiveEarnings(null)).toEqual({
      model: "commission",
      commissionPercent: null,
    });
  });

  it("takes the shop's row when the branch has none", () => {
    expect(
      effectiveEarnings({ model: "commission", commissionPercent: 10 }, null),
    ).toEqual({ model: "commission", commissionPercent: 10 });
  });

  it("lets a branch's nulls follow the shop", () => {
    expect(
      effectiveEarnings(
        { model: "commission", commissionPercent: 10 },
        { model: null, commissionPercent: 12.5 },
      ),
    ).toEqual({ model: "commission", commissionPercent: 12.5 });
    expect(
      effectiveEarnings(
        { model: "commission", commissionPercent: 10 },
        { model: "commission", commissionPercent: null },
      ),
    ).toEqual({ model: "commission", commissionPercent: 10 });
  });

  it("drops the rate on markup, whoever set it", () => {
    expect(
      effectiveEarnings(
        { model: "commission", commissionPercent: 10 },
        { model: "markup", commissionPercent: null },
      ),
    ).toEqual({ model: "markup", commissionPercent: null });
  });
});

describe("usesMarkup", () => {
  const shop = (
    model: "commission" | "markup" | null,
    branches: [string, "commission" | "markup" | null][] = [],
  ): ShopEarnings => ({
    shop: { model, commissionPercent: null },
    branches: new Map(
      branches.map(([id, branchModel]) => [
        id,
        { model: branchModel, commissionPercent: null },
      ]),
    ),
  });

  it("is false before the rows have loaded", () => {
    expect(usesMarkup(undefined)).toBe(false);
  });

  it("is true for a shop on markup", () => {
    expect(usesMarkup(shop("markup"))).toBe(true);
  });

  // The shop's own model decides (user, 2026-11-08): a branch on markup is
  // priced on that branch's Menu tab, not in the shop-wide editors.
  it("is false for a shop on commission, whatever its branches do", () => {
    expect(usesMarkup(shop("commission", [["b2", "markup"]]))).toBe(false);
  });
});

describe("percentProblem", () => {
  it("accepts whole and two-decimal rates", () => {
    for (const typed of ["0", "10", "12.5", "12.75", "100"]) {
      expect(percentProblem(typed)).toBeUndefined();
    }
  });

  it("requires a rate", () => {
    for (const typed of ["", "  "]) {
      expect(percentProblem(typed)).toBe(t("earnings.percentRequired"));
    }
  });

  it("refuses a rate outside 0–100", () => {
    for (const typed of ["-1", "100.01", "abc"]) {
      expect(percentProblem(typed)).toBe(t("earnings.percentRange"));
    }
  });

  it("refuses more than two decimals, which numeric(5, 2) would round", () => {
    expect(percentProblem("10.125")).toBe(t("earnings.percentDecimals"));
  });
});

describe("formatPercent", () => {
  it("says a rate without trailing zeros", () => {
    expect(formatPercent(10)).toBe("10");
    expect(formatPercent(12.5)).toBe("12.5");
    expect(formatPercent(12.75)).toBe("12.75");
  });
});

describe("newShopEarnings", () => {
  it("is markup with no rate", () => {
    expect(newShopEarnings("markup", "")).toEqual({
      model: "markup",
      commissionPercent: null,
    });
    // A rate typed before switching to markup is not kept.
    expect(newShopEarnings("markup", "10")).toEqual({
      model: "markup",
      commissionPercent: null,
    });
  });

  it("is commission at the rate typed", () => {
    expect(newShopEarnings("commission", " 12.5 ")).toEqual({
      model: "commission",
      commissionPercent: 12.5,
    });
  });

  it("is not ready on commission without a valid rate", () => {
    expect(newShopEarnings("commission", "")).toBeNull();
    expect(newShopEarnings("commission", "120")).toBeNull();
    expect(newShopEarnings("commission", "10.125")).toBeNull();
  });
});
