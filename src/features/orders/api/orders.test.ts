import { describe, expect, it } from "vitest";

import { t } from "@/i18n/translations";
import { isUndoableMove, orderStatuses, statusName } from "@/lib/order-status";

import {
  liveStatusSlugs,
  roundingOf,
  roundToCash,
  searchTerm,
  withOrderMoved,
  type OrderStatus,
  type OrderStore,
} from "./orders";
import { OrderRefusal, orderRefusal } from "./refusal";

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

describe("isUndoableMove", () => {
  it("offers undo on a move along the path", () => {
    expect(isUndoableMove("confirmed")).toBe(true);
    expect(isUndoableMove("driverSent")).toBe(true);
  });

  it("never offers it onto delivered or cancelled", () => {
    // `progress !== null` used to decide this and offered Undo on Delivered,
    // which the RPC will not move off.
    expect(isUndoableMove("delivered")).toBe(false);
    expect(isUndoableMove("cancelled")).toBe(false);
    expect(isUndoableMove("nonsense")).toBe(false);
  });
});

describe("roundingOf", () => {
  it("is the gap between the lines and the charged total", () => {
    expect(
      roundingOf({
        subtotal: 1_234_500,
        deliveryFee: 0,
        discount: 0,
        total: 1_235_000,
      }),
    ).toBe(500);
  });

  it("is zero when nothing was rounded or the sum is not positive", () => {
    expect(
      roundingOf({ subtotal: 10, deliveryFee: 5, discount: 3, total: 12 }),
    ).toBe(0);
    expect(
      roundingOf({ subtotal: 10, deliveryFee: 0, discount: 20, total: 0 }),
    ).toBe(0);
  });
});

describe("orderRefusal", () => {
  it("reads the code, not the sentence", () => {
    const moved = orderRefusal({ code: "MOVED", message: "x" }, "advance");
    expect(moved).toBeInstanceOf(OrderRefusal);
    expect(moved.code).toBe("MOVED");
    expect(moved.message).toBe(t("orders.movedElsewhere"));
    expect(orderRefusal({ code: "MOVED", message: "x" }, "amend").message).toBe(
      t("amend.changedElsewhere"),
    );
  });

  it("names a too-late amendment but not a table CHECK", () => {
    expect(
      orderRefusal(
        { code: "23514", message: "This order is on its way" },
        "amend",
      ).message,
    ).toBe(t("amend.tooLate"));
    expect(
      orderRefusal(
        { code: "23514", message: 'violates check constraint "x"' },
        "amend",
      ).message,
    ).toBe('violates check constraint "x"');
  });

  it("keeps the database's words for a code it does not know", () => {
    expect(
      orderRefusal({ code: "P0001", message: "odd" }, "dispatch").message,
    ).toBe("odd");
  });
});

describe("roundToCash", () => {
  it("rounds lira to the nearest 1,000, half away from zero", () => {
    expect(roundToCash(1_234_499, "LBP")).toBe(1_234_000);
    expect(roundToCash(1_234_500, "LBP")).toBe(1_235_000);
    expect(roundToCash(499, "LBP")).toBe(0);
  });

  it("never goes below zero", () => {
    expect(roundToCash(-1_500, "LBP")).toBe(0);
    expect(roundToCash(-5, "USD")).toBe(0);
  });

  it("leaves a currency without a cash step alone", () => {
    expect(roundToCash(1_875, "USD")).toBe(1_875);
  });
});

describe("withOrderMoved", () => {
  /** A portion at `slug`, carrying what `toOrder` would have read for it. */
  const portion = (id: string, slug: string): OrderStore => ({
    id,
    storeId: `store-${id}`,
    storeName: id,
    storeImageUrl: null,
    branchName: null,
    storeWhatsapp: null,
    statusSlug: slug,
    statusName: statusName(slug),
    progress: PATH.find((s) => s.slug === slug)?.progress ?? null,
    subtotal: 0,
  });

  it("moves every live portion, carrying the target's name and position", () => {
    const moved = withOrderMoved(
      { stores: [portion("a", "ordered"), portion("b", "confirmed")] },
      "driverSent",
    );
    expect(moved.stores).toEqual([
      portion("a", "driverSent"),
      portion("b", "driverSent"),
    ]);
  });

  it("leaves delivered and cancelled portions where they are, as the function does", () => {
    const delivered = portion("a", "delivered");
    const cancelled = portion("b", "cancelled");
    const moved = withOrderMoved(
      { stores: [delivered, cancelled, portion("c", "confirmed")] },
      "ordered",
    );
    expect(moved.stores[0]).toBe(delivered);
    expect(moved.stores[1]).toBe(cancelled);
    expect(moved.stores[2]).toEqual(portion("c", "ordered"));
  });

  it("keeps the rest of the order, lines included", () => {
    const order = {
      id: "o",
      lines: ["kept"],
      stores: [portion("a", "ordered")],
    };
    const moved = withOrderMoved(order, "confirmed");
    expect(moved.id).toBe("o");
    expect(moved.lines).toBe(order.lines);
  });

  it("returns the same order when nothing would move", () => {
    const order = {
      stores: [portion("a", "confirmed"), portion("b", "delivered")],
    };
    expect(withOrderMoved(order, "confirmed")).toBe(order);
  });
});
