import { formatPercent } from "@/features/catalog/api/earnings";
import { t, type Params, type TranslationKey } from "@/i18n/translations";
import { formatDateTime } from "@/lib/time";
import {
  convertMoney,
  formatMoney,
  type ConvertibleCurrency,
  type Currency,
} from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { displaySizeOf, sizeOf } from "@/lib/unit-label";
import { itemUnit, linePrice } from "@/lib/units";

import {
  placeName,
  roundToCash,
  roundingOf,
  type Order,
  type OrderLine,
  type OrderStore,
} from "./api/orders";

/**
 * Handing an order to a driver, over WhatsApp.
 *
 * ## Why a link and not an integration
 *
 * Nothing here talks to WhatsApp. `wa.me` opens a chat with a message already
 * typed, and the operator presses send from their own account — so there is no
 * Business API, no template approval, no number to register, and no message
 * stored anywhere. The dashboard composes; a person sends.
 *
 * That is not a shortcut around a better version. It is the version that
 * matches how the job is done: the driver replies "on my way" and the operator
 * answers, in the same thread, from the same phone they already use.
 *
 * ## The message is the whole order, because the driver has no screen
 *
 * They are not going to open a dashboard. Whatever is not in this message is
 * something they have to ring back for, at a moment when the operator is
 * dealing with the next order — so it carries the customer, the phone, the
 * address, the pin, every line with its options and notes, and what to collect.
 *
 * Cash on delivery is the only payment method in the product, so **the total is
 * the amount to collect at the door**, and it sits at the bottom, followed
 * only by what that leaves the driver holding once the shops are paid.
 *
 * ## Plain text, and no shouting
 *
 * WhatsApp renders `*bold*`, and a message that uses it everywhere is harder
 * to skim than one that uses it for the stops. Bold marks where to go — each
 * pickup, then "Deliver to" — and the money that changes hands there: what
 * each shop is paid, and what is collected at the door. Nothing else, so the
 * message reads as the trip: stop and pay, stop and pay, door and collect.
 *
 * ## In Arabic, whatever the screen is in
 *
 * Drivers and shops read Arabic (user, 2026-11-08), so every message is, and
 * the operator's dialog around it stays English. Labels come from `ar` in the
 * bundle; dishes, options, shops and pickup addresses from the Arabic the row
 * carries, or its English when it has none. What a customer typed — their
 * name, the door, a note — goes out as they typed it.
 */

/** A label in the language the driver and the shop read. */
function say(key: TranslationKey, params?: Params): string {
  return t(key, params, "ar");
}

/**
 * A code, phone number or date, kept whole inside a right-to-left line.
 *
 * Their first character is the problem: "#" and "+" have no direction of
 * their own, so an Arabic line sends them to the far side of what follows —
 * "DL-48213#", "96170123456+". An invisible left-to-right mark in front
 * holds them in place. Money needs none: "$" stays with its digits.
 */
function ltr(text: string): string {
  return `‎${text}`;
}

/**
 * One line of the bag, as the person packing it needs to read it.
 *
 * Three kinds of line, and each says the thing that decides what goes in:
 *
 * - **Sold as itself** — "2 × Kafta sandwich". A count.
 * - **A fixed size** (a unit, no step) — "2 × Basmati rice (500 g each)". The
 *   size is what tells the shop *which* rice: without it, "2 × Basmati rice"
 *   leaves them to guess between the 500 g bag and the 5 kg sack, and the one
 *   left on the counter is the one that was not ordered. "each" because two
 *   of them is two bags of 500 g, not one bag of a kilo.
 * - **Sold by amount** (a step) — "1.5 kg Minced beef", "750 g Halloumi",
 *   "3 bags Charcoal". The amount is the order; there is no count to give.
 *   The `×` stays off it: in front of an amount it reads as a multiplication.
 *   See `0122`.
 *
 * A display-only size (`0262`) goes beside the name whichever kind it is —
 * "2 × Basmati Rice (900 g)" — because it is what tells the shop which pack
 * on the shelf was ordered.
 */
export function whatToPack(line: OrderLine, quantity: number): string {
  const label = displaySizeOf(line, "ar");
  const name = label ? `${line.nameAr} (${label})` : line.nameAr;
  const unit = itemUnit(line);
  // "1 piece" is the item itself, and saying so adds nothing to read.
  if (!unit || (unit.unit === "piece" && unit.quantity === 1 && !unit.step))
    return `${quantity} × ${name}`;
  if (unit.step !== null) return `${sizeOf(unit, quantity, "ar")} ${name}`;

  const size = sizeOf(unit, 1, "ar");
  return `${quantity} × ${name} (${
    quantity === 1 ? size : say("dispatch.packEach", { size })
  })`;
}

/**
 * A line's options and note, under it: indented and dashed, because an
 * option on its own line at the bullet's level reads as a second thing to
 * pack. The same in the driver's message and the shop's.
 */
function lineDetails(line: Pick<OrderLine, "optionsAr" | "note">): string[] {
  const details = line.optionsAr.map((option) => `   – ${option}`);
  if (line.note) {
    details.push(`   – ${say("dispatch.lineNote", { note: line.note })}`);
  }
  return details;
}

/**
 * How a portion was settled, in words for the screen: "Commission 10%",
 * "Commission, no rate", "Markup".
 */
export function earningModelLabel(
  earnings: NonNullable<OrderStore["earnings"]>,
): string {
  if (earnings.model === "markup") return t("earnings.markup");
  if (earnings.commissionPercent === null) return t("earnings.commissionNone");
  return t("earnings.commissionAt", {
    percent: formatPercent(earnings.commissionPercent),
  });
}

/**
 * What the platform keeps of one pickup, as the driver says it to the shop —
 * "Less 10% commission: −$0.80" — or null when there is nothing to say: a
 * portion placed before `0262`, or commission at no rate.
 *
 * Markup is never said. A markup shop's lines are listed at its own prices,
 * so they already add up to what it is paid; a "Markup" line in a message the
 * driver may show the shop only told it what we charge on top (user,
 * 2026-11-08: the driver's message was confusing).
 */
export function earningLine(
  earnings: OrderStore["earnings"],
  money: (minor: number) => string | null,
): string | null {
  if (!earnings || earnings.model === "markup") return null;
  const amount = money(earnings.earning);
  if (!amount) return null;
  if (earnings.commissionPercent === null) return null;
  return say("dispatch.commission", {
    percent: formatPercent(earnings.commissionPercent),
    amount,
  });
}

/**
 * A line in the other currency, as the app shows it beside the price: the
 * item and its options each converted at `shopRate` and rounded to the cash
 * step, one unit at a time, then counted out — 400,000 LBP stays 400,000, and
 * two of them are 800,000, not 799,000 (the app's `cashFigure`, 2026-11-06).
 * An order already in that currency is its own figure.
 */
export function otherFigure(
  line: Pick<
    OrderLine,
    "unitPrice" | "optionsPrice" | "priceUnit" | "unitQuantity" | "unitStep"
  >,
  quantity: number,
  other: { from: ConvertibleCurrency; to: ConvertibleCurrency },
  shopRate: number | null,
): number {
  const unit = itemUnit(line);
  if (other.from.code === other.to.code) {
    return linePrice(line.unitPrice, line.optionsPrice, unit, quantity);
  }
  const cash = (amount: number) =>
    roundToCash(
      convertMoney(amount, other.from, other.to, shopRate),
      other.to.code,
    );
  const options = cash(line.optionsPrice);
  const item = cash(line.unitPrice - line.optionsPrice);
  return linePrice(item + options, options, unit, quantity);
}

/** The pair a figure is said in: the order's currency, and the other one. */
export type OtherPair = { from: ConvertibleCurrency; to: ConvertibleCurrency };

/**
 * The second figure under a line — **what the customer was shown**.
 *
 * Since the app's `0277` the order keeps it: one unit in the second currency
 * as checkout showed it, saved when the order was placed. It is read, not
 * worked out, so the order page, this message and the customer's own receipt
 * say one number, and a rate changed since moves none of them. An order from
 * before `0277` has none, and the line is converted as the app converts it
 * (`otherFigure`). Null when there is no second currency to say it in.
 */
export function secondOfLine(
  line: Pick<
    OrderLine,
    | "unitPrice"
    | "optionsPrice"
    | "priceUnit"
    | "unitQuantity"
    | "unitStep"
    | "secondUnitPrice"
    | "secondOptionsPrice"
  >,
  quantity: number,
  order: Pick<Order, "secondCurrency">,
  other: OtherPair | undefined,
  shopRate: number | null,
): number | null {
  if (!other) return null;
  if (line.secondUnitPrice != null && order.secondCurrency === other.to.code) {
    return linePrice(
      line.secondUnitPrice,
      line.secondOptionsPrice ?? 0,
      itemUnit(line),
      quantity,
    );
  }
  return otherFigure(line, quantity, other, shopRate);
}

/**
 * The second figure under the total, added up as the customer's receipt adds
 * it: every line that is coming (`secondOfLine`), then the rest of the bill —
 * the figure the order kept (`second_bill`), or for an older order delivery,
 * discount and rounding converted at the platform's rate. Never the total
 * converted in one go: that read $5.05 as 449,000 where the lines said
 * 450,000 (DL-261110-00238).
 */
export function secondOfTotal(
  order: Order & { lines: OrderLine[] },
  other: OtherPair | undefined,
): number | null {
  const dishes = secondOfDishes(order, other);
  if (dishes === null || !other) return null;
  const rest =
    order.secondBill != null && order.secondCurrency === other.to.code
      ? order.secondBill
      : roundToCash(
          convertMoney(
            order.deliveryFee - order.discount + roundingOf(order),
            other.from,
            other.to,
          ),
          other.to.code,
        );
  return dishes + rest;
}

/**
 * The total's second figure as something to collect: `secondOfTotal` rounded
 * to the nearest cash step (1,000 for the lira), as the total itself is
 * (`0173`, app `0286`). The lines it adds up can end in 250 or 500 — a shop's
 * own lira price is a step of 250 — and nobody hands a driver 500 lira. The
 * app rounds the figure under a total the same way, so the customer and the
 * driver read one number.
 */
export function secondToCollect(
  order: Order & { lines: OrderLine[] },
  other: OtherPair | undefined,
): number | null {
  const total = secondOfTotal(order, other);
  if (total === null || !other) return total;
  return roundToCash(total, other.to.code);
}

/** Every line that is coming, by `secondOfLine`, added up: the subtotal's. */
export function secondOfDishes(
  order: Order & { lines: OrderLine[] },
  other: OtherPair | undefined,
): number | null {
  if (!other) return null;
  let dishes = 0;
  for (const line of order.lines) {
    const quantity = line.fulfilledQuantity ?? line.quantity;
    if (quantity === 0) continue;
    const rate =
      order.stores.find((store) => store.id === line.orderStoreId)?.shopRate ??
      null;
    dishes += secondOfLine(line, quantity, order, other, rate) ?? 0;
  }
  return dishes;
}

/** A pin as a link that opens in whatever maps app the phone has. */
function mapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** The chat, with the message already in it. */
export function whatsappLink(phone: string, message: string): string {
  // `wa.me` wants digits with no `+`. `couriers.phone` is already stored that
  // way (migration 0081), so nothing is stripped here — a second normaliser
  // would be a second place for the rule to be slightly different.
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * The order, as something a person reads on a phone.
 *
 * `currency` may be missing while the rate loads. Rather than printing a bare
 * integer of minor units — `4200`, which somebody would read out as forty-two
 * hundred — the amounts are left out and the message says the total is on the
 * screen. A dispatch that quietly understates what to collect is worse than one
 * that admits it is incomplete.
 *
 * ## The lines as they now stand
 *
 * `fulfilledQuantity ?? quantity`, as `kitchenMessage` does. A driver handed
 * the ordered quantities of an amended order collects a bag that does not
 * match the message, and the priced lines no longer add up to the subtotal
 * beneath them. A line at zero is left out: it is not in the bag.
 *
 * ## What each shop is paid
 *
 * Every pickup ends with what the driver hands that shop (user, 2026-11-07):
 * its lines as they now stand, added up — so the figure always matches the
 * bag listed above it, amended or not — and the same in the other currency.
 *
 * Since `0262` a portion with earnings pays the shop `storeDue` — the
 * server's figure, worked from the same lines. On commission the lines are at
 * the app's prices and a line says what comes off them; on markup the lines
 * themselves are at the shop's prices, so they add up to what it is paid and
 * nothing more is said. The other currency follows the same arithmetic on
 * the cash figures: each line through `otherFigure` (at the store price, on
 * markup), and on commission the rate taken off the cash bag and rounded to
 * the cash step. A portion with no earnings row is paid its bag, as before.
 *
 * ## What is left with the driver
 *
 * The last line is what the driver holds once the customer has paid and every
 * shop has been: collected, less each shop's figure. It is the number the
 * operator settles with them, and it is worked out here so nobody does it in
 * their head at the end of a shift.
 *
 * ## The other currency, and the rounding
 *
 * `other` is the pair to say a figure in both. A shop's figure is read at
 * **that shop's** rate (`OrderStore.shopRate`), the one its menu quoted; the
 * total as the app adds it: its dish lines, then the bill's own lines at the
 * platform's rate. Since the app's `0277` those are the figures the order
 * kept — what the customer was shown — and nothing is converted
 * (`secondOfLine`, `secondOfTotal`). For an older order, converted figures
 * are cash, as the app shows them: each line one unit at a time, rounded to the
 * 1,000 note, then counted out (`otherFigure`) — so the lira the driver hands
 * a shop is the lira the customer saw. Absent, those lines are left out
 * rather than guessed. And when the server rounded a lira total to its cash
 * step (`0173`), the message says by how much, so the lines above add up.
 */
export function dispatchMessage(
  order: Order & { lines: OrderLine[] },
  currency: Currency | undefined,
  clock24h: boolean,
  /** The order's currency and the other one, to say a figure in both. */
  other?: { from: ConvertibleCurrency; to: ConvertibleCurrency },
): string {
  const money = (minor: number) =>
    currency ? formatMoney(minor, currency) : null;
  const inOther = (minor: number) =>
    other ? formatMoney(minor, other.to) : null;
  /** " or 120,000 ل.ل" after a figure, or nothing with no second currency. */
  const orOther = (minor: number | null) => {
    const amount = minor === null ? null : inOther(minor);
    return amount ? ` ${say("dispatch.collectOther", { amount })}` : "";
  };

  const lines: string[] = [];
  const stops = order.stores.length;

  // The first two lines are the notification: which order, and the trip.
  lines.push(`*${say("dispatch.heading", { code: ltr(order.code) })}*`);
  lines.push(
    stops === 1
      ? say("dispatch.tripOne")
      : say("dispatch.tripMany", { count: stops }),
  );
  lines.push(
    say("dispatch.placed", {
      when: ltr(formatDateTime(order.placedAt, clock24h)),
    }),
  );

  // What every shop is paid, added up, for what is left with the driver.
  let paidShops = 0;
  let paidShopsOther = 0;

  // In the order of the trip: every pickup, then the door, then the money.
  //
  // One block per shop, each complete on its own (user, 2026-11-07): a
  // two-shop order is two stops, and a driver standing at the first needs
  // that shop's address, pin and phone, and to know which bag is whose.
  // Every stop is numbered, the door included (user, 2026-11-08), so the
  // message reads as the route. Names are trimmed: a shop saved as
  // "Khalifeh Restaurant " closed its bold with a space, and WhatsApp then
  // printed the asterisks instead of bolding. The written address goes in
  // brackets beside the name (user, 2026-11-08), flattened to one line for
  // the same reason: a bold cannot cross a line break.
  order.stores.forEach((store, index) => {
    const name = placeName(store.arabic).trim();
    const address = store.arabic.pickupAddress?.replace(/\s+/g, " ").trim();
    lines.push("");
    lines.push(
      `*${say("dispatch.stopPickup", {
        n: index + 1,
        store: address ? `${name} (${address})` : name,
      })}*`,
    );
    if (store.pickupLatitude !== null && store.pickupLongitude !== null) {
      lines.push(
        say("dispatch.map", {
          url: mapUrl(store.pickupLatitude, store.pickupLongitude),
        }),
      );
    }
    if (store.storeWhatsapp) {
      lines.push(
        say("dispatch.phone", { phone: ltr(formatPhone(store.storeWhatsapp)) }),
      );
    }

    const earnings = store.earnings;
    // A markup shop's lines are said at its own prices — the ones it knows,
    // and the ones that add up to what it is paid. See `earningLine`.
    const markup = earnings?.model === "markup";
    let bag = 0;
    let bagOther = 0;
    let count = 0;
    for (const line of order.lines.filter(
      (one) => one.orderStoreId === store.id,
    )) {
      // What is coming, not what was ordered — see above.
      const quantity = line.fulfilledQuantity ?? line.quantity;
      if (quantity === 0) continue;
      count += 1;

      const priced = markup
        ? {
            ...line,
            unitPrice: line.storeUnitPrice ?? line.unitPrice,
            optionsPrice: line.storeOptionsPrice ?? line.optionsPrice,
          }
        : line;
      const price = linePrice(
        priced.unitPrice,
        priced.optionsPrice,
        itemUnit(line),
        quantity,
      );
      bag += price;
      if (other) {
        // A markup shop is paid its own prices, which the customer never
        // saw; everything else is what was shown (`secondOfLine`).
        bagOther += markup
          ? otherFigure(priced, quantity, other, store.shopRate)
          : (secondOfLine(line, quantity, order, other, store.shopRate) ?? 0);
      }
      const amount = money(price);
      lines.push(
        `• ${whatToPack(line, quantity)}${amount ? ` — ${amount}` : ""}`,
      );
      lines.push(...lineDetails(line));
    }

    // What the driver hands this shop, in both currencies — less the
    // commission, where the portion has one (`0262`).
    const due = earnings ? earnings.storeDue : bag;
    let dueOther = bagOther;
    if (earnings?.model === "commission" && other) {
      dueOther =
        bagOther -
        roundToCash(
          Math.round((bagOther * (earnings.commissionPercent ?? 0)) / 100),
          other.to.code,
        );
    }
    paidShops += due;
    paidShopsOther += dueOther;

    const pay = money(due);
    if (pay) {
      const kept = earningLine(earnings, money);
      // The bag added up, so the commission has something to come off —
      // one line is its own total already.
      if (kept && count > 1) {
        lines.push(say("dispatch.bag", { amount: money(bag) ?? "" }));
      }
      if (kept) lines.push(kept);
      lines.push(
        `*${say("dispatch.payShop", { amount: pay })}*${orOther(
          other ? dueOther : null,
        )}`,
      );
    }
  });

  // The door.
  lines.push("");
  lines.push(
    `*${say("dispatch.stopDeliver", {
      n: stops + 1,
      name: order.customerName.trim() || say("orders.incompleteSignup"),
    })}*`,
  );
  lines.push(order.addressLine.trim());

  // The pin, where there is one — the order's own, snapshotted at placement
  // (`0131`), or for an older order the saved address's. See `Order.latitude`.
  // A help in finding the door, never a substitute for the line above.
  if (order.latitude !== null && order.longitude !== null) {
    lines.push(
      say("dispatch.map", { url: mapUrl(order.latitude, order.longitude) }),
    );
  }
  if (order.customerPhone) {
    lines.push(
      say("dispatch.phone", { phone: ltr(formatPhone(order.customerPhone)) }),
    );
  }
  if (order.courierNote) {
    lines.push(say("dispatch.note", { note: order.courierNote }));
  }

  lines.push("");

  const total = money(order.total);
  if (total) {
    // The customer's bill on one line, so the figure under it is found
    // without reading four.
    let bill = say("dispatch.subtotal", {
      amount: money(order.subtotal) ?? "",
    });
    bill += ` + ${say("dispatch.delivery", { amount: money(order.deliveryFee) ?? "" })}`;
    if (order.discount > 0) {
      bill += ` − ${say("dispatch.discount", { amount: money(order.discount) ?? "" })}`;
    }
    const rounding = roundingOf(order);
    if (rounding !== 0) {
      bill += ` ${rounding > 0 ? "+" : "−"} ${say("dispatch.rounding", {
        amount: money(Math.abs(rounding)) ?? "",
      })}`;
    }
    lines.push(bill);

    // The one number the driver acts on at the door, with the second figure
    // the customer was shown under it, to the nearest 1,000 — see
    // `secondToCollect`.
    const totalOther = secondToCollect(order, other);
    lines.push(
      `*${say("dispatch.collect", { amount: total })}*${orOther(totalOther)}`,
    );

    // And what they are holding at the end of it: collected less every shop
    // paid — the figure the operator settles with them.
    const left = order.total - paidShops;
    const leftOther = totalOther === null ? null : totalOther - paidShopsOther;
    lines.push(
      say("dispatch.cashLeft", {
        amount: `${money(left) ?? ""}${orOther(leftOther)}`,
      }),
    );
  } else {
    lines.push(say("dispatch.amountUnknown"));
  }

  return lines.join("\n");
}

/**
 * The order as the **kitchen** needs it, for one shop.
 *
 * ## What is stripped, and why each thing goes
 *
 * The driver's message is the whole order because a driver is going to a door
 * and needs the door, the phone and the amount. A kitchen needs none of that,
 * and sending it anyway is not merely noise:
 *
 * - **No address, no map pin, no customer phone.** A shop cooking one half of a
 *   two-shop order has no reason to hold a stranger's home address, and once it
 *   is in a WhatsApp thread it is on somebody's phone for good. This is the
 *   difference between telling a supplier what to make and handing them a
 *   customer record.
 * - **No money.** The kitchen is not collecting it — cash on delivery means the
 *   driver does — and the total on a multi-shop order is not this shop's
 *   figure anyway. A number they cannot act on is a number they might.
 * - **No other shop's items.** Obvious, and it is the whole reason this is
 *   per-shop rather than one broadcast.
 *
 * ## What is kept
 *
 * The code, so a phone call about it has something to name. The lines with
 * their options and notes, which *is* the job. The customer's first name only,
 * because a bag needs a label and a surname adds nothing to that. And the
 * courier note when the shop is the only one on the order — "no coriander"
 * reaches the person who can act on it.
 *
 * ## Amended lines are shown as they now stand
 *
 * `fulfilled_quantity` decides the number sent, so a shop that has already said
 * it is out of something is not asked for it again. A line at zero is left out
 * entirely rather than struck through: the customer's receipt needs to show
 * what is missing, the kitchen's ticket does not.
 */
export function kitchenMessage(
  order: Order & { lines: OrderLine[] },
  storeId: string,
  clock24h: boolean,
): string {
  const portion = order.stores.find((one) => one.id === storeId);
  const lines: string[] = [];

  // The heading and the branch first (user, 2026-11-08): the notification
  // shows them, and a shop with two branches on one phone sees at once
  // which kitchen it is for. Trimmed, so the bold always closes.
  lines.push(`*${say("dispatch.kitchenHeading", { code: ltr(order.code) })}*`);
  if (portion) lines.push(placeName(portion.arabic).trim());
  lines.push(
    say("dispatch.placed", {
      when: ltr(formatDateTime(order.placedAt, clock24h)),
    }),
  );

  // A first name, not the full one. The bag needs a label; the shop does not
  // need a customer.
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  if (first) lines.push(say("dispatch.kitchenFor", { name: first }));

  lines.push("");

  for (const line of order.lines.filter(
    (one) => one.orderStoreId === storeId,
  )) {
    const quantity = line.fulfilledQuantity ?? line.quantity;
    if (quantity === 0) continue;

    lines.push(`• ${whatToPack(line, quantity)}`);
    lines.push(...lineDetails(line));
  }

  // Only when this shop is the whole order. On a split order the note may be
  // about the other half, and passing it on invites a kitchen to act on an
  // instruction that was never theirs.
  if (order.courierNote && order.stores.length === 1) {
    lines.push("");
    lines.push(say("dispatch.note", { note: order.courierNote }));
  }

  // What happens next, and the one thing to tell us.
  lines.push("");
  lines.push(say("dispatch.kitchenFooter"));

  return lines.join("\n");
}

/**
 * Standing a driver down: the order they were handed has been cancelled.
 *
 * Short, because the only thing it has to do is stop a trip. The code and the
 * customer's name are what the driver will recognise from the message before
 * it; the address is left out — they have it already, and repeating it in a
 * message whose point is "do not go there" only invites going there.
 */
export function cancellationMessage(
  order: Pick<Order, "code" | "customerName">,
): string {
  const lines: string[] = [];
  lines.push(`*${say("dispatch.cancelHeading", { code: ltr(order.code) })}*`);
  if (order.customerName) {
    lines.push(say("dispatch.customer", { name: order.customerName }));
  }
  lines.push("");
  lines.push(say("dispatch.cancelBody"));
  return lines.join("\n");
}
