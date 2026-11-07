import { describe, expect, it } from "vitest";

import { t } from "@/i18n/translations";
import type { Currency } from "@/lib/money";

import type { Order, OrderLine, OrderStore } from "./api/orders";
import {
  cancellationMessage,
  dispatchMessage,
  kitchenMessage,
  whatToPack,
  whatsappLink,
} from "./dispatch";

/**
 * What a driver and a kitchen are told (QA-058).
 *
 * The driver has no screen: whatever this leaves out they ring back for, and
 * whatever it gets wrong is what they collect at the door. The kitchen is the
 * opposite — every line of a customer record it is sent is one it should not
 * hold. Both are plain strings nobody else checks before they are sent.
 */

const USD: Currency = {
  code: "USD",
  symbol: "$",
  symbolPosition: "before",
  decimalDigits: 2,
  decimalSeparator: ".",
  groupSeparator: ",",
};

const store = (
  id: string,
  storeName: string,
  branchName: string | null = null,
): OrderStore => ({
  id,
  storeId: `shop-${id}`,
  storeName,
  branchName,
  branchAddress: null,
  storeImageUrl: null,
  storeWhatsapp: null,
  statusSlug: "preparing",
  statusName: "Preparing",
  progress: 2,
  subtotal: 0,
});

const line = (over: Partial<OrderLine>): OrderLine => ({
  id: "line",
  orderStoreId: "os-1",
  menuItemId: "dish",
  name: "Kafta",
  imageUrl: null,
  quantity: 1,
  fulfilledQuantity: null,
  replacesLineId: null,
  amendmentReason: null,
  unitPrice: 500,
  optionsPrice: 0,
  priceUnit: null,
  unitQuantity: null,
  unitStep: null,
  note: null,
  options: [],
  ...over,
});

const order = (
  over: Partial<Order & { lines: OrderLine[] }> = {},
): Order & { lines: OrderLine[] } => ({
  id: "order-1",
  code: "#DL-48213",
  placedAt: "2026-11-04T18:30:00Z",
  amendedAt: null,
  customerId: "cust-1",
  customerName: "Rima Haddad",
  customerPhone: "96170123456",
  addressLine: "Hamra, Bliss St, 3rd floor",
  courierNote: "Ring twice",
  latitude: 33.8959,
  longitude: 35.4787,
  currencyCode: "USD",
  shopRate: null,
  subtotal: 1000,
  deliveryFee: 300,
  discount: 0,
  total: 1300,
  stores: [store("os-1", "Grill House")],
  lines: [line({ id: "l1", quantity: 2 })],
  ...over,
});

describe("dispatchMessage", () => {
  it("carries the customer, the phone, the address in bold and the pin", () => {
    const text = dispatchMessage(order(), USD, true);

    expect(text).toContain("Customer: Rima Haddad");
    expect(text).toContain("Phone: +96170123456");
    expect(text).toContain("*Address: Hamra, Bliss St, 3rd floor*");
    expect(text).toContain(
      "Map: https://www.google.com/maps/search/?api=1&query=33.8959,35.4787",
    );
    expect(text).toContain("Note for you: Ring twice");
  });

  it("leaves the map out when the order has no pin", () => {
    const text = dispatchMessage(
      order({ latitude: null, longitude: null }),
      USD,
      true,
    );
    expect(text).not.toContain("Map:");
  });

  it("names an unfinished signup rather than leaving the customer blank", () => {
    const text = dispatchMessage(order({ customerName: "" }), USD, true);
    expect(text).toContain(`Customer: ${t("orders.incompleteSignup")}`);
  });

  it("ends with the amount to collect, in bold", () => {
    const text = dispatchMessage(order(), USD, true);
    const last = text.split("\n").at(-1);

    expect(last).toBe("*Collect on delivery: $13.00*");
    expect(text).toContain("Items: $10.00");
    expect(text).toContain("Delivery: $3.00");
    expect(text).not.toContain("Discount");
  });

  it("says the discount, and the other currency after the total", () => {
    const text = dispatchMessage(
      order({ discount: 200, total: 1100 }),
      USD,
      true,
      (minor) => `${minor * 895} ل.ل`,
    );
    const lines = text.split("\n");

    expect(text).toContain("Discount: -$2.00");
    expect(lines.at(-2)).toBe("*Collect on delivery: $11.00*");
    expect(lines.at(-1)).toBe(
      t("dispatch.collectOther", { amount: "984500 ل.ل" }),
    );
  });

  it("says by how much a cash total was rounded, so the lines add up", () => {
    // 1000 + 300 = 1300, rounded to 1325: +$0.25.
    const text = dispatchMessage(order({ total: 1325 }), USD, true);
    expect(text).toContain(t("dispatch.rounding", { amount: "+$0.25" }));
  });

  it("never sends bare minor units while the currency is loading", () => {
    const text = dispatchMessage(order(), undefined, true);

    expect(text).toContain("Amount: see the dashboard.");
    expect(text).not.toMatch(/\b1300\b/);
    expect(text).not.toContain("Collect on delivery");
    // The dish line goes out without a price rather than with a wrong one.
    expect(text).toContain("• 2 × Kafta\n");
  });

  it("groups lines under their shop, branch and all", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", "Hamra"),
          store("os-2", "Juice Bar"),
        ],
        lines: [
          line({ id: "a", orderStoreId: "os-2", name: "Lemonade" }),
          line({ id: "b", orderStoreId: "os-1", name: "Kafta" }),
        ],
      }),
      USD,
      true,
    );

    const grill = text.indexOf("From Grill House — Hamra:");
    const juice = text.indexOf("From Juice Bar:");
    expect(grill).toBeGreaterThan(-1);
    expect(text.indexOf("Kafta")).toBeGreaterThan(grill);
    expect(text.indexOf("Kafta")).toBeLessThan(juice);
    expect(text.indexOf("Lemonade")).toBeGreaterThan(juice);
  });

  it("sends an amended order as it now stands", () => {
    const text = dispatchMessage(
      order({
        lines: [
          line({ id: "a", name: "Kafta", quantity: 3, fulfilledQuantity: 1 }),
          line({
            id: "b",
            name: "Tabbouleh",
            quantity: 2,
            fulfilledQuantity: 0,
          }),
        ],
      }),
      USD,
      true,
    );

    expect(text).toContain("• 1 × Kafta — $5.00");
    expect(text).not.toContain("Tabbouleh");
  });

  it("indents a line's options and note under it", () => {
    const text = dispatchMessage(
      order({
        lines: [line({ options: ["Extra garlic"], note: "well done" })],
      }),
      USD,
      true,
    );
    expect(text).toContain(
      `• 1 × Kafta — $5.00\n   Extra garlic\n   ${t("dispatch.lineNote", { note: "well done" })}`,
    );
  });
});

describe("whatToPack", () => {
  it("counts a dish sold as itself", () => {
    expect(whatToPack(line({}), 2)).toBe("2 × Kafta");
  });

  it("gives a fixed-size item its size, each", () => {
    const rice = line({ name: "Rice", priceUnit: "g", unitQuantity: 500 });
    expect(whatToPack(rice, 1)).toBe("1 × Rice (500 g)");
    expect(whatToPack(rice, 2)).toBe("2 × Rice (500 g each)");
  });

  it("says a counted pack in the plural", () => {
    const eggs = line({ name: "Eggs", priceUnit: "piece", unitQuantity: 6 });
    expect(whatToPack(eggs, 2)).toBe("2 × Eggs (6 pieces each)");
  });

  it("leaves a single piece as the item itself", () => {
    const one = line({ name: "Kaak", priceUnit: "piece", unitQuantity: 1 });
    expect(whatToPack(one, 3)).toBe("3 × Kaak");
  });

  it("says the amount of a line sold by weight, in grams under a kilo", () => {
    const beef = line({
      name: "Minced beef",
      priceUnit: "kg",
      unitQuantity: 0.5,
      unitStep: 0.25,
    });
    expect(whatToPack(beef, 1)).toBe("500 g Minced beef");
    expect(whatToPack(beef, 5)).toBe("1.5 kg Minced beef");
  });

  it("says stepped bags in the plural, with no ×", () => {
    const coal = line({
      name: "Charcoal",
      priceUnit: "bag",
      unitQuantity: 1,
      unitStep: 1,
    });
    expect(whatToPack(coal, 1)).toBe("1 bag Charcoal");
    expect(whatToPack(coal, 3)).toBe("3 bags Charcoal");
  });
});

describe("kitchenMessage", () => {
  const twoShops = order({
    stores: [store("os-1", "Grill House"), store("os-2", "Juice Bar")],
    lines: [
      line({ id: "a", orderStoreId: "os-1", name: "Kafta", quantity: 2 }),
      line({ id: "b", orderStoreId: "os-2", name: "Lemonade" }),
    ],
  });

  it("holds no address, no phone, no pin and no money", () => {
    const text = kitchenMessage(order(), "os-1", true);

    expect(text).not.toContain("Hamra");
    expect(text).not.toContain("96170123456");
    expect(text).not.toContain("maps");
    expect(text).not.toContain("$");
  });

  it("names the customer by first name only", () => {
    const text = kitchenMessage(order(), "os-1", true);
    expect(text).toContain(t("dispatch.kitchenFor", { name: "Rima" }));
    expect(text).not.toContain("Haddad");
  });

  it("sends only this shop's lines", () => {
    const text = kitchenMessage(twoShops, "os-1", true);
    expect(text).toContain("• 2 × Kafta");
    expect(text).not.toContain("Lemonade");
  });

  it("passes the courier note on only when the shop is the whole order", () => {
    expect(kitchenMessage(order(), "os-1", true)).toContain("Ring twice");
    expect(kitchenMessage(twoShops, "os-1", true)).not.toContain("Ring twice");
  });

  it("tells the shop the pack size, so it fetches the right one", () => {
    const text = kitchenMessage(
      order({
        lines: [
          line({ name: "Rice", quantity: 2, priceUnit: "kg", unitQuantity: 5 }),
        ],
      }),
      "os-1",
      true,
    );
    expect(text).toContain("• 2 × Rice (5 kg each)");
  });

  it("leaves out a line the shop has said it is out of", () => {
    const text = kitchenMessage(
      order({
        lines: [line({ name: "Tabbouleh", quantity: 2, fulfilledQuantity: 0 })],
      }),
      "os-1",
      true,
    );
    expect(text).not.toContain("Tabbouleh");
  });
});

describe("cancellationMessage", () => {
  it("names the order and the customer, and nothing about where to go", () => {
    const text = cancellationMessage(order());
    expect(text.split("\n")[0]).toBe(
      `*${t("dispatch.cancelHeading", { code: "#DL-48213" })}*`,
    );
    expect(text).toContain("Customer: Rima Haddad");
    expect(text).not.toContain("Hamra");
  });
});

describe("whatsappLink", () => {
  it("puts the whole message in the link, encoded", () => {
    const link = whatsappLink("96170123456", "*Collect: $13.00*\n& thanks");
    expect(link).toBe(
      "https://wa.me/96170123456?text=*Collect%3A%20%2413.00*%0A%26%20thanks",
    );
    expect(new URL(link).searchParams.get("text")).toBe(
      "*Collect: $13.00*\n& thanks",
    );
  });
});
