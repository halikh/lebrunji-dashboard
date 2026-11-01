import { describe, expect, it } from "vitest";

import { separatePrice, toBundle } from "./bundles";
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
        { menu_item_id: "fries", quantity: 1, sort_order: 1, dish: { name: { en: "Fries" }, price: 300 } },
        { menu_item_id: "burger", quantity: 2, sort_order: 0, dish: { name: { en: "Burger" }, price: 450 } },
      ],
    });

    expect(bundle.storeName).toBe("Grill House");
    expect(bundle.currencyCode).toBe("USD");
    expect(bundle.items.map((item) => item.menuItemId)).toEqual(["burger", "fries"]);
    expect(separatePrice(bundle.items)).toBe(1200);
  });
});

describe("artwork toColumns with a bundle", () => {
  it("writes the bundle and drops the picture's own dates", () => {
    expect(
      toColumns({ bundleId: "b1", startsAt: "2026-11-01T00:00:00Z", endsAt: null }),
    ).toMatchObject({ bundle_id: "b1", starts_at: null, ends_at: null });
  });
});
