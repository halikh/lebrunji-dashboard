import { describe, expect, it } from "vitest";

import { liveStatusSlugs, searchTerm, type OrderStatus } from "./orders";

/** The statuses migration 0003 seeds. */
const SEEDED: OrderStatus[] = [
  { id: "1", slug: "ordered", name: "Placed", progress: 1 },
  { id: "2", slug: "confirmed", name: "Confirmed", progress: 2 },
  { id: "3", slug: "driverSent", name: "On the way", progress: 3 },
  { id: "4", slug: "delivered", name: "Delivered", progress: 4 },
  { id: "5", slug: "cancelled", name: "Cancelled", progress: null },
];

describe("liveStatusSlugs", () => {
  it("is everything that still needs somebody", () => {
    expect(liveStatusSlugs(SEEDED)).toEqual([
      "ordered",
      "confirmed",
      "driverSent",
    ]);
  });

  it("excludes the end of the path and everything off it", () => {
    const live = liveStatusSlugs(SEEDED);
    expect(live).not.toContain("delivered");
    expect(live).not.toContain("cancelled");
  });

  it("includes a step a merchant inserts", () => {
    // The reason this is derived rather than a hardcoded list of three slugs.
    // `order_statuses` is a lookup table exactly so a step can be added, and a
    // hardcoded set would leave orders at the new step out of the default view
    // — orders that exist and that nobody is shown.
    const withPacking: OrderStatus[] = [
      ...SEEDED,
      { id: "6", slug: "packing", name: "Packing", progress: 2.5 },
    ];
    expect(liveStatusSlugs(withPacking)).toContain("packing");
  });

  it("follows the path when a step is added at the end", () => {
    // A new final step makes the old final step live again — "delivered" is no
    // longer the end if "collected" comes after it.
    const withCollected: OrderStatus[] = [
      ...SEEDED,
      { id: "6", slug: "collected", name: "Collected", progress: 5 },
    ];
    const live = liveStatusSlugs(withCollected);
    expect(live).toContain("delivered");
    expect(live).not.toContain("collected");
  });

  it("is empty rather than wrong when nothing is loaded", () => {
    // The caller checks this: an empty set must not silently become "no filter",
    // which would show every order ever placed under a tab labelled Live.
    expect(liveStatusSlugs([])).toEqual([]);
    expect(
      liveStatusSlugs([
        { id: "1", slug: "cancelled", name: "x", progress: null },
      ]),
    ).toEqual([]);
  });
});

describe("searchTerm", () => {
  it("keeps the hyphens the stored codes contain", () => {
    // Stripping them produced a term that could never match anything, which
    // reads to the operator as "there are no orders".
    expect(searchTerm("#DL-260830-00042")).toBe("DL-260830-00042");
  });

  it("drops the hash and any spaces", () => {
    expect(searchTerm("  #DL-260830-00042 ")).toBe("DL-260830-00042");
    expect(searchTerm("DL 260830 00042")).toBe("DL26083000042");
  });

  it("leaves a bare tail alone, which is how people read a code out", () => {
    expect(searchTerm("00042")).toBe("00042");
  });
});
