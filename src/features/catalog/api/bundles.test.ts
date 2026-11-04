import { describe, expect, it } from "vitest";

import {
  liveBundlesWith,
  offSaleItems,
  separatePrice,
  toBundle,
} from "./bundles";
import { toColumns } from "./artworks";

describe("toBundle", () => {
  it("reads a row with its shop and its dishes in their order", () => {
    const bundle = toBundle({
      id: "b1",
      store_id: "s1",
      name: { en: "Burger meal" },
      description: null,
      image_url: null,
      price: 900,
      is_active: true,
      starts_at: null,
      ends_at: null,
      sort_order: 2,
      stores: { name: { en: "Grill House" }, currency_code: "USD" },
      bundle_items: [
        {
          menu_item_id: "fries",
          quantity: 1,
          sort_order: 1,
          dish: { name: { en: "Fries" }, price: 300 },
        },
        {
          menu_item_id: "burger",
          quantity: 2,
          sort_order: 0,
          dish: { name: { en: "Burger" }, price: 450 },
        },
      ],
    });

    expect(bundle.storeName).toBe("Grill House");
    expect(bundle.currencyCode).toBe("USD");
    expect(bundle.items.map((item) => item.menuItemId)).toEqual([
      "burger",
      "fries",
    ]);
    expect(separatePrice(bundle.items)).toBe(1200);
  });
});

/**
 * The dish half of `bundle_is_sellable` (`0204`), as the dashboard reads it.
 *
 * Its failure is silent: a dish switched off or archived takes the bundle out
 * of the app without a word, and a list that reads only the bundle's own
 * switch goes on calling it Live (QA-021).
 */
describe("offSaleItems", () => {
  const burger = {
    name: { en: "Burger" },
    price: 600,
    is_active: true,
    deleted_at: null,
  };
  const fries = {
    name: { en: "Fries" },
    price: 300,
    is_active: true,
    deleted_at: null,
  };
  const bundleOf = (...dishes: (Record<string, unknown> | null)[]) =>
    toBundle({
      id: "b1",
      store_id: "s1",
      name: { en: "Burger meal" },
      is_active: true,
      bundle_items: dishes.map((dish, index) => ({
        menu_item_id: `d${index}`,
        quantity: 1,
        sort_order: index,
        dish,
      })),
    });
  const labels = (bundle: ReturnType<typeof toBundle>) =>
    offSaleItems(bundle).map((item) => item.label);

  it("is empty while every dish is on the menu", () => {
    expect(labels(bundleOf(burger, fries))).toEqual([]);
  });

  it("names a switched-off dish", () => {
    expect(labels(bundleOf(burger, { ...fries, is_active: false }))).toEqual([
      "Fries",
    ]);
  });

  it("names an archived dish, even one still switched on", () => {
    expect(
      labels(
        bundleOf({ ...burger, deleted_at: "2026-11-04T10:00:00Z" }, fries),
      ),
    ).toEqual(["Burger"]);
  });

  it("counts a dish it cannot read as off sale", () => {
    expect(offSaleItems(bundleOf(burger, null))).toHaveLength(1);
  });

  it("names only the switched-on bundles that hold a dish", () => {
    const live = bundleOf(burger, fries);
    const hidden = { ...live, id: "b2", isActive: false };
    expect(liveBundlesWith([live, hidden], "d1")).toEqual(["Burger meal"]);
    expect(liveBundlesWith([live, hidden], "d9")).toEqual([]);
  });
});

describe("artwork toColumns with a bundle", () => {
  it("writes the bundle and drops the picture's own dates", () => {
    expect(
      toColumns({
        bundleId: "b1",
        startsAt: "2026-11-01T00:00:00Z",
        endsAt: null,
      }),
    ).toMatchObject({ bundle_id: "b1", starts_at: null, ends_at: null });
  });
});
