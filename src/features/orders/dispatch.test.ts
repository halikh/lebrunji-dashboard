import { describe, expect, it } from "vitest";

import { t, type Params, type TranslationKey } from "@/i18n/translations";
import type { ConvertibleCurrency, Currency } from "@/lib/money";

import type { Order, OrderLine, OrderStore } from "./api/orders";
import {
  cancellationMessage,
  dispatchMessage,
  earningLine,
  earningModelLabel,
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

/** What the messages say a label as. */
const say = (key: TranslationKey, params?: Params) => t(key, params, "ar");

const USD: Currency = {
  code: "USD",
  symbol: "$",
  symbolPosition: "before",
  decimalDigits: 2,
  decimalSeparator: ".",
  groupSeparator: ",",
};

/** The pair a message says figures in both of: dollars, and lira at 89,500. */
const BOTH: { from: ConvertibleCurrency; to: ConvertibleCurrency } = {
  from: { ...USD, rate: 1, isBase: true },
  to: {
    code: "LBP",
    symbol: "ل.ل",
    symbolPosition: "after",
    decimalDigits: 0,
    decimalSeparator: ".",
    groupSeparator: ",",
    rate: 89_500,
  },
};

const store = (
  id: string,
  storeName: string,
  branchName: string | null = null,
  branchAddress: string | null = null,
  over: Partial<OrderStore> = {},
): OrderStore => ({
  id,
  storeId: `shop-${id}`,
  storeName,
  branchName,
  branchAddress,
  pickupAddress: null,
  pickupLatitude: null,
  pickupLongitude: null,
  shopRate: null,
  storeImageUrl: null,
  storeWhatsapp: null,
  statusSlug: "preparing",
  statusName: "Preparing",
  progress: 2,
  subtotal: 0,
  earnings: null,
  arabic: { storeName, branchName, pickupAddress: over.pickupAddress ?? null },
  ...over,
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
  sizeQuantity: null,
  sizeUnit: null,
  storeUnitPrice: null,
  storeOptionsPrice: null,
  note: null,
  options: [],
  nameAr: over.name ?? "Kafta",
  optionsAr: over.options ?? [],
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
  it("carries the customer, the phone, the address and the pin", () => {
    const text = dispatchMessage(order(), USD, true);

    expect(text).toContain(
      "*المحطة 2: التسليم إلى Rima Haddad*\nHamra, Bliss St, 3rd floor\n",
    );
    expect(text).toContain("الهاتف: \u200E+96170123456");
    expect(text).toContain(
      "الموقع: https://www.google.com/maps/search/?api=1&query=33.8959,35.4787",
    );
    expect(text).toContain("ملاحظة الزبون: Ring twice");
  });

  it("leaves the map out when the order has no pin", () => {
    const text = dispatchMessage(
      order({ latitude: null, longitude: null }),
      USD,
      true,
    );
    expect(text).not.toContain("الموقع:");
  });

  it("names an unfinished signup rather than leaving the customer blank", () => {
    const text = dispatchMessage(order({ customerName: "" }), USD, true);
    expect(text).toContain(`التسليم إلى ${say("orders.incompleteSignup")}*`);
  });

  it("ends with the amount to collect, in bold, then what is left", () => {
    const text = dispatchMessage(order(), USD, true);
    const lines = text.split("\n");

    expect(lines.at(-3)).toBe("الأصناف $10.00 + التوصيل $3.00");
    expect(lines.at(-2)).toBe("*اقبض من الزبون: $13.00*");
    // $13.00 collected, $10.00 to the shop.
    expect(lines.at(-1)).toBe(say("dispatch.cashLeft", { amount: "$3.00" }));
    expect(text).not.toContain("الخصم");
  });

  it("says the discount, and the other currency after the total, as cash", () => {
    const text = dispatchMessage(
      order({ discount: 200, total: 1100 }),
      USD,
      true,
      BOTH,
    );
    const lines = text.split("\n");

    expect(text).toContain("الأصناف $10.00 + التوصيل $3.00 − الخصم $2.00");
    // As the app adds it: the dishes' 896,000, and delivery less the
    // discount — $1.00, 89,500, so 90,000 in cash.
    expect(lines.at(-2)).toBe("*اقبض من الزبون: $11.00* أو 986,000 ل.ل");
    // Less the shop's 896,000.
    expect(lines.at(-1)).toBe(
      say("dispatch.cashLeft", { amount: "$1.00 أو 90,000 ل.ل" }),
    );
  });

  it("adds the total's lira up from its lines, as the customer saw it", () => {
    // DL-261110-00238: $3.93 + $1.12 at 89,000, 10% commission, delivery
    // taken off in full. The total converted in one go is 449,000; the
    // lines are 350,000 + 100,000, and the app showed 450,000.
    const text = dispatchMessage(
      order({
        subtotal: 505,
        deliveryFee: 200,
        discount: 200,
        total: 505,
        stores: [
          store("os-1", "Abu Ghraib", null, null, {
            shopRate: 89_000,
            earnings: {
              model: "commission",
              commissionPercent: 10,
              sales: 505,
              storeDue: 454,
              earning: 51,
            },
          }),
        ],
        lines: [
          line({ id: "a", name: "Qamhiyeh", unitPrice: 393 }),
          line({ id: "b", name: "Oat bread", unitPrice: 112 }),
        ],
      }),
      USD,
      true,
      BOTH,
    );
    const lines = text.split("\n");

    expect(text).toContain("*ادفع للمحل: $4.54* أو 405,000 ل.ل");
    expect(lines.at(-2)).toBe("*اقبض من الزبون: $5.05* أو 450,000 ل.ل");
    expect(lines.at(-1)).toBe(
      say("dispatch.cashLeft", { amount: "$0.51 أو 45,000 ل.ل" }),
    );
  });

  it("says by how much a cash total was rounded, so the lines add up", () => {
    // 1000 + 300 = 1300, rounded to 1325: +$0.25.
    const text = dispatchMessage(order({ total: 1325 }), USD, true);
    expect(text).toContain("+ التقريب $0.25");
  });

  it("never sends bare minor units while the currency is loading", () => {
    const text = dispatchMessage(order(), undefined, true);

    expect(text).toContain("المبلغ: راجع لوحة التحكم.");
    expect(text).not.toMatch(/\b1300\b/);
    expect(text).not.toContain("اقبض من");
    expect(text).not.toContain("يبقى معك");
    // The dish line goes out without a price rather than with a wrong one.
    expect(text).toContain("• 2 × Kafta\n");
  });

  it("gives every pickup its own block, before the door", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", "Grill House Hamra", "Bliss Street", {
            pickupAddress: "Bliss Street",
            pickupLatitude: 33.9,
            pickupLongitude: 35.48,
            storeWhatsapp: "96171000001",
            // This shop quotes its own rate (0120).
            shopRate: 90_000,
          }),
          store("os-2", "Juice Bar", null, null, {
            pickupAddress: "Makdisi Street",
          }),
        ],
        lines: [
          line({ id: "a", orderStoreId: "os-2", name: "Lemonade" }),
          line({
            id: "b",
            orderStoreId: "os-1",
            name: "Kafta",
            unitPrice: 325,
            quantity: 2,
          }),
        ],
      }),
      USD,
      true,
      BOTH,
    );

    // A chain's branch by its own name; each stop numbered and complete.
    const grill = text.indexOf(
      "*المحطة 1: الاستلام من Grill House Hamra (Bliss Street)*",
    );
    const juice = text.indexOf(
      "*المحطة 2: الاستلام من Juice Bar (Makdisi Street)*",
    );
    const door = text.indexOf("*المحطة 3: التسليم إلى");
    expect(grill).toBeGreaterThan(-1);
    expect(juice).toBeGreaterThan(grill);
    expect(door).toBeGreaterThan(juice);

    const first = text.slice(grill, juice);
    // In the heading now, and not said a second time beneath it.
    expect(first).toContain("(Bliss Street)*\nالموقع:");
    expect(first).toContain(
      "الموقع: https://www.google.com/maps/search/?api=1&query=33.9,35.48",
    );
    expect(first).toContain("الهاتف: \u200E+96171000001");
    expect(first).toContain("Kafta");
    // At the shop's own 90,000: $3.25 is 292,500, paid as 293,000, twice.
    expect(first).toContain("*ادفع للمحل: $6.50* أو 586,000 ل.ل");

    const second = text.slice(juice, door);
    expect(second).not.toContain("\nMakdisi Street");
    expect(second).not.toContain("الموقع:");
    expect(second).not.toContain("الهاتف:");
    expect(second).toContain("Lemonade");
    // At the platform's 89,500: $5.00 is 447,500, paid as 448,000.
    expect(second).toContain("*ادفع للمحل: $5.00* أو 448,000 ل.ل");
  });

  it("keeps a pickup address on the heading's line, so the bold closes", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            pickupAddress: " Bliss Street,\n  next to the bank ",
          }),
        ],
      }),
      USD,
      true,
    );
    expect(text).toContain(
      "*المحطة 1: الاستلام من Grill House (Bliss Street, next to the bank)*\n",
    );
  });

  it("pays a single pickup too, without numbering it", () => {
    const text = dispatchMessage(order(), USD, true);
    expect(text).toContain("*المحطة 1: الاستلام من Grill House*");
    expect(text.split("\n")[1]).toBe(say("dispatch.tripOne"));
    expect(text).toContain("*ادفع للمحل: $10.00*");
    // No second currency given: no second figure guessed.
    expect(text).not.toContain("ل.ل");
  });

  it("pays a shop for what is in the bag, not what was ordered", () => {
    const text = dispatchMessage(
      order({
        lines: [line({ id: "a", quantity: 3, fulfilledQuantity: 1 })],
      }),
      USD,
      true,
    );
    expect(text).toContain("*ادفع للمحل: $5.00*");
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

  it("tells the driver the size on the pack too (0262)", () => {
    const text = dispatchMessage(
      order({
        lines: [
          line({
            name: "Basmati Rice",
            quantity: 2,
            sizeQuantity: 900,
            sizeUnit: "g",
          }),
        ],
      }),
      USD,
      true,
    );
    expect(text).toContain("• 2 × Basmati Rice (900 غ) — $10.00");
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
      `• 1 × Kafta — $5.00\n   – Extra garlic\n   – ${say("dispatch.lineNote", { note: "well done" })}`,
    );
  });
});

describe("dispatchMessage — what the platform keeps (0262)", () => {
  // Two at $5.00: a $10.00 bag. Delivery is never in it.
  const commission = (percent: number | null, earning: number) =>
    order({
      stores: [
        store("os-1", "Grill House", null, null, {
          earnings: {
            model: "commission",
            commissionPercent: percent,
            sales: 1000,
            storeDue: 1000 - earning,
            earning,
          },
        }),
      ],
    });

  it("takes the commission off what the shop is paid, and says so first", () => {
    const text = dispatchMessage(commission(10, 100), USD, true);
    expect(text).toContain(
      `${say("dispatch.commission", { percent: "10", amount: "$1.00" })}
*ادفع للمحل: $9.00*`,
    );
    // The door is unchanged: the customer pays what they were charged.
    expect(text).toContain("*اقبض من الزبون: $13.00*");
  });

  it("takes the same rate off the cash figure in the other currency", () => {
    const text = dispatchMessage(commission(10, 100), USD, true, BOTH);
    // $5.00 is 447,500, paid as 448,000, twice: 896,000. 10% of it is 89,600,
    // which the driver can only hand over as 90,000 — so 806,000.
    expect(text).toContain("*ادفع للمحل: $9.00* أو 806,000 ل.ل");
  });

  it("says a rate with decimals as it was set", () => {
    const text = dispatchMessage(commission(12.5, 125), USD, true);
    expect(text).toContain(
      say("dispatch.commission", { percent: "12.5", amount: "$1.25" }),
    );
    expect(text).toContain("*ادفع للمحل: $8.75*");
  });

  it("says nothing of a commission with no rate, and pays the whole bag", () => {
    const text = dispatchMessage(commission(null, 0), USD, true);
    expect(text).not.toContain("عمولة");
    expect(text).toContain("*ادفع للمحل: $10.00*");
  });

  it("pays a markup shop its store prices, in both currencies", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            earnings: {
              model: "markup",
              commissionPercent: null,
              sales: 1000,
              storeDue: 800,
              earning: 200,
            },
          }),
        ],
        lines: [
          line({
            id: "l1",
            quantity: 2,
            storeUnitPrice: 400,
            storeOptionsPrice: 0,
          }),
        ],
      }),
      USD,
      true,
      BOTH,
    );
    // $4.00 is 358,000 at 89,500, twice.
    // The lines are at the shop's own prices, so they add up to what it is
    // paid, and the markup is never said.
    expect(text).toContain(
      "• 2 × Kafta — $8.00\n*ادفع للمحل: $8.00* أو 716,000 ل.ل",
    );
    expect(text).not.toMatch(/markup/i);
    // The door is still what the customer was charged.
    expect(text).toContain("الأصناف $10.00 + التوصيل $3.00");
  });

  it("pays a markup line with no store price at its app price", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            earnings: {
              model: "markup",
              commissionPercent: null,
              sales: 1000,
              storeDue: 1000,
              earning: 0,
            },
          }),
        ],
      }),
      USD,
      true,
      BOTH,
    );
    expect(text).toContain("*ادفع للمحل: $10.00* أو 896,000 ل.ل");
  });

  it("settles each pickup on its own terms", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            earnings: {
              model: "commission",
              commissionPercent: 10,
              sales: 500,
              storeDue: 450,
              earning: 50,
            },
          }),
          // Placed before 0262 would have no row: paid its bag, as before.
          store("os-2", "Juice Bar"),
        ],
        lines: [
          line({ id: "a", orderStoreId: "os-1" }),
          line({ id: "b", orderStoreId: "os-2", name: "Lemonade" }),
        ],
      }),
      USD,
      true,
    );
    const juice = text.indexOf("*المحطة 2: الاستلام من Juice Bar*");
    expect(text.slice(0, juice)).toContain("*ادفع للمحل: $4.50*");
    expect(text.slice(juice)).toContain("*ادفع للمحل: $5.00*");
    expect(text.slice(juice)).not.toContain("عمولة");
  });
});

describe("dispatchMessage — reads as the route", () => {
  // #DL-261108-00206 as it was sent: a markup grocer, then a commission
  // restaurant whose name was saved with a trailing space.
  const twoStops = order({
    code: "#DL-261108-00206",
    customerName: "Alin Safawi",
    customerPhone: "96170000001",
    addressLine: "Day3a, Sarafand",
    courierNote: null,
    subtotal: 843,
    deliveryFee: 265,
    total: 1108,
    stores: [
      store("os-1", "Abo Nemer Fruits & Vegies", null, null, {
        pickupAddress: "Sarafand",
        earnings: {
          model: "markup",
          commissionPercent: null,
          sales: 169,
          storeDue: 135,
          earning: 34,
        },
      }),
      store("os-2", "Khalifeh Restaurant ", null, null, {
        pickupAddress: "Dhoor Al Sarafand",
        earnings: {
          model: "commission",
          commissionPercent: 10,
          sales: 674,
          storeDue: 607,
          earning: 67,
        },
      }),
    ],
    lines: [
      line({
        id: "a",
        orderStoreId: "os-1",
        name: "Green Apple",
        unitPrice: 169,
        storeUnitPrice: 135,
        storeOptionsPrice: 0,
      }),
      line({
        id: "b",
        orderStoreId: "os-2",
        name: "Francisco",
        unitPrice: 674,
        options: ["French fries, coleslaw, sauce"],
      }),
    ],
  });

  it("numbers every stop, pickups then the door", () => {
    const text = dispatchMessage(twoStops, USD, true);
    expect(text.split("\n").slice(0, 2)).toEqual([
      "*طلب توصيل جديد \u200E#DL-261108-00206*",
      say("dispatch.tripMany", { count: 2 }),
    ]);
    expect(text).toContain(
      "*المحطة 1: الاستلام من Abo Nemer Fruits & Vegies (Sarafand)*\n• 1 × Green Apple — $1.35\n*ادفع للمحل: $1.35*",
    );
    // No stray space inside the bold, or WhatsApp will not bold it.
    expect(text).toContain(
      "*المحطة 2: الاستلام من Khalifeh Restaurant (Dhoor Al Sarafand)*",
    );
    expect(text).toContain("*المحطة 3: التسليم إلى Alin Safawi*");
  });

  it("says what the driver holds once both shops are paid", () => {
    const text = dispatchMessage(twoStops, USD, true);
    // $11.08 collected, $1.35 and $6.07 paid out.
    expect(text.split("\n").at(-1)).toBe(
      say("dispatch.cashLeft", { amount: "$3.66" }),
    );
  });

  it("adds a commission bag up before taking the commission off it", () => {
    const text = dispatchMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            earnings: {
              model: "commission",
              commissionPercent: 10,
              sales: 1500,
              storeDue: 1350,
              earning: 150,
            },
          }),
        ],
        lines: [
          line({ id: "a" }),
          line({ id: "b", name: "Tawook", unitPrice: 1000 }),
        ],
      }),
      USD,
      true,
    );
    expect(text).toContain(
      `• 1 × Tawook — $10.00\n${say("dispatch.bag", { amount: "$15.00" })}\n${say(
        "dispatch.commission",
        { percent: "10", amount: "$1.50" },
      )}\n*ادفع للمحل: $13.50*`,
    );
  });
});

describe("earningLine and earningModelLabel", () => {
  const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
  const base = { sales: 1000, storeDue: 900, earning: 100 };

  it("is nothing for a portion with no earnings row", () => {
    expect(earningLine(null, money)).toBeNull();
  });

  it("is nothing on markup: the lines are at the shop's prices already", () => {
    expect(
      earningLine({ ...base, model: "markup", commissionPercent: null }, money),
    ).toBeNull();
  });

  it("is nothing while the currency is unknown", () => {
    expect(
      earningLine(
        { ...base, model: "commission", commissionPercent: 10 },
        () => null,
      ),
    ).toBeNull();
  });

  it("names the model on the order page", () => {
    expect(
      earningModelLabel({
        ...base,
        model: "commission",
        commissionPercent: 10,
      }),
    ).toBe(t("earnings.commissionAt", { percent: "10" }));
    expect(
      earningModelLabel({
        ...base,
        model: "commission",
        commissionPercent: null,
      }),
    ).toBe(t("earnings.commissionNone"));
    expect(
      earningModelLabel({ ...base, model: "markup", commissionPercent: null }),
    ).toBe(t("earnings.markup"));
  });
});

describe("whatToPack", () => {
  it("counts a dish sold as itself", () => {
    expect(whatToPack(line({}), 2)).toBe("2 × Kafta");
  });

  it("gives a fixed-size item its size, each", () => {
    const rice = line({ name: "Rice", priceUnit: "g", unitQuantity: 500 });
    expect(whatToPack(rice, 1)).toBe("1 × Rice (500 غ)");
    expect(whatToPack(rice, 2)).toBe("2 × Rice (500 غ للواحدة)");
  });

  it("says a counted pack in the plural", () => {
    const eggs = line({ name: "Eggs", priceUnit: "piece", unitQuantity: 6 });
    expect(whatToPack(eggs, 2)).toBe("2 × Eggs (6 قطع للواحدة)");
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
    expect(whatToPack(beef, 1)).toBe("500 غ Minced beef");
    expect(whatToPack(beef, 5)).toBe("1.5 كغ Minced beef");
  });

  it("prints a dish's display size beside its name (0262)", () => {
    const rice = line({
      name: "Basmati Rice",
      sizeQuantity: 900,
      sizeUnit: "g",
    });
    expect(whatToPack(rice, 2)).toBe("2 × Basmati Rice (900 غ)");
    // As set, never rescaled: the label on the pack.
    const oil = line({ name: "Oil", sizeQuantity: 1.5, sizeUnit: "l" });
    expect(whatToPack(oil, 1)).toBe("1 × Oil (1.5 ل)");
  });

  it("keeps the display size apart from what the line is sold by", () => {
    const beef = line({
      name: "Beef",
      priceUnit: "kg",
      unitQuantity: 1,
      unitStep: 0.5,
      sizeQuantity: 30,
      sizeUnit: "cm",
    });
    expect(whatToPack(beef, 2)).toBe("1.5 كغ Beef (30 سم)");
  });

  it("says stepped bags in the plural, with no ×", () => {
    const coal = line({
      name: "Charcoal",
      priceUnit: "bag",
      unitQuantity: 1,
      unitStep: 1,
    });
    expect(whatToPack(coal, 1)).toBe("1 كيس Charcoal");
    expect(whatToPack(coal, 3)).toBe("3 أكياس Charcoal");
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

  it("opens with the order, then which branch it is for", () => {
    const text = kitchenMessage(
      order({
        stores: [store("os-1", "Khalifeh Restaurant ")],
        lines: [
          line({
            name: "Francisco",
            options: ["French fries, coleslaw, sauce"],
            note: "no onions",
          }),
        ],
      }),
      "os-1",
      true,
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("*طلب جديد \u200E#DL-48213*");
    // Trimmed: the name was saved with a trailing space.
    expect(lines[1]).toBe("Khalifeh Restaurant");
    expect(text).toContain(
      `• 1 × Francisco\n   – French fries, coleslaw, sauce\n   – ${say(
        "dispatch.lineNote",
        { note: "no onions" },
      )}`,
    );
    expect(lines.at(-1)).toBe(say("dispatch.kitchenFooter"));
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
    expect(text).toContain(say("dispatch.kitchenFor", { name: "Rima" }));
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
    expect(text).toContain("• 2 × Rice (5 كغ للواحدة)");
  });

  it("tells the shop the size printed on the pack (0262)", () => {
    const text = kitchenMessage(
      order({
        lines: [
          line({
            name: "Basmati Rice",
            quantity: 2,
            sizeQuantity: 900,
            sizeUnit: "g",
          }),
        ],
      }),
      "os-1",
      true,
    );
    expect(text).toContain("• 2 × Basmati Rice (900 غ)");
  });

  it("never tells the kitchen what the platform keeps", () => {
    const text = kitchenMessage(
      order({
        stores: [
          store("os-1", "Grill House", null, null, {
            earnings: {
              model: "commission",
              commissionPercent: 10,
              sales: 1000,
              storeDue: 900,
              earning: 100,
            },
          }),
        ],
      }),
      "os-1",
      true,
    );
    expect(text).not.toContain("عمولة");
    expect(text).not.toContain("$");
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

describe("in Arabic", () => {
  const arabicOrder = order({
    customerName: "ريما حداد",
    addressLine: "الحمرا، شارع بلس",
    courierNote: "اقرع الجرس مرتين",
    discount: 100,
    total: 1225,
    stores: [
      store("os-1", "Grill House", "Grill Hamra", "Bliss", {
        pickupAddress: "Bliss Street",
        pickupLatitude: 33.9,
        pickupLongitude: 35.48,
        storeWhatsapp: "96171000001",
        arabic: {
          storeName: "بيت المشاوي",
          branchName: "مشاوي الحمرا",
          pickupAddress: "شارع بلس",
        },
        earnings: {
          model: "commission",
          commissionPercent: 10,
          sales: 1000,
          storeDue: 900,
          earning: 100,
        },
      }),
    ],
    lines: [
      line({
        id: "a",
        name: "Kafta",
        nameAr: "كفتة",
        options: ["Extra garlic"],
        optionsAr: ["ثوم إضافي"],
        note: "مستوية جيداً",
      }),
      line({
        id: "b",
        name: "Rice",
        nameAr: "أرز",
        priceUnit: "kg",
        unitQuantity: 1,
        unitStep: 0.5,
        sizeQuantity: 900,
        sizeUnit: "g",
      }),
    ],
  });

  /** All but links, the code and the date: nothing of ours in English. */
  const ownWords = (text: string) =>
    text
      .replace(/https?:\S+/g, "")
      .replace(/#DL-\d+/g, "")
      .replace(/\d+ Nov, \d+:\d+ [AP]M/g, "");

  it("says every label of the driver's message in Arabic", () => {
    expect(
      ownWords(dispatchMessage(arabicOrder, USD, false, BOTH)),
    ).not.toMatch(/[A-Za-z]/);
  });

  it("says every label of the shop's message in Arabic", () => {
    expect(ownWords(kitchenMessage(arabicOrder, "os-1", false))).not.toMatch(
      /[A-Za-z]/,
    );
  });

  it("says every label of the cancellation in Arabic", () => {
    expect(ownWords(cancellationMessage(arabicOrder))).not.toMatch(/[A-Za-z]/);
  });

  it("names the dish, its options, the branch and the pickup in Arabic", () => {
    const text = dispatchMessage(arabicOrder, USD, true);
    expect(text).toContain("الاستلام من مشاوي الحمرا (شارع بلس)*\n");
    expect(text).toContain("• 1 × كفتة — $5.00\n   – ثوم إضافي");
  });

  it("says when it was placed on Beirut's clock, the date in English", () => {
    // 18:30 UTC on 4 November is 20:30 in Beirut. The mark keeps the day
    // beside its month in a right-to-left line.
    expect(kitchenMessage(arabicOrder, "os-1", false)).toContain(
      "وقت الطلب: ‎4 Nov, 8:30 PM",
    );
    expect(dispatchMessage(arabicOrder, USD, true)).toContain(
      "وقت الطلب: ‎4 Nov, 20:30",
    );
  });

  it("says two of a counted unit with the dual, and no digit", () => {
    const coal = line({
      name: "Charcoal",
      priceUnit: "bag",
      unitQuantity: 1,
      unitStep: 1,
    });
    expect(whatToPack(coal, 2)).toBe("كيسان Charcoal");
  });
});

describe("cancellationMessage", () => {
  it("names the order and the customer, and nothing about where to go", () => {
    const text = cancellationMessage(order());
    expect(text.split("\n")[0]).toBe(
      `*${say("dispatch.cancelHeading", { code: "\u200E#DL-48213" })}*`,
    );
    expect(text).toContain("الزبون: Rima Haddad");
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
