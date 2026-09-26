import { describe, expect, it } from "vitest";

import { orderStatuses } from "@/lib/order-status";

import { liveStatusSlugs, searchTerm, type OrderStatus } from "./orders";

/** The path, hardcoded — the database constrains `order_stores.status` to it. */
const PATH: OrderStatus[] = [
  { slug: "ordered", name: "Placed", progress: 1 },
  { slug: "confirmed", name: "Confirmed", progress: 2 },
  { slug: "driverSent", name: "On the way", progress: 3 },
  { slug: "delivered", name: "Delivered", progress: 4 },
  { slug: "cancelled", name: "Cancelled", progress: null },
];

describe("orderStatuses", () => {
  it("is the fixed path, in order, with cancelled off it and last", () => {
    expect(orderStatuses()).toEqual(PATH);
  });
});

describe("liveStatusSlugs", () => {
  it("is everything that still needs somebody", () => {
    expect(liveStatusSlugs()).toEqual(["ordered", "confirmed", "driverSent"]);
  });

  it("excludes the end of the path and everything off it", () => {
    const live = liveStatusSlugs();
    expect(live).not.toContain("delivered");
    expect(live).not.toContain("cancelled");
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
