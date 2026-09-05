import { t } from "@/i18n/translations";
import { formatDateTime } from "@/lib/time";
import { formatMoney, type Currency } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

import type { Order, OrderLine } from "./api/orders";

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
 * the amount to collect at the door**, and it is the last thing in the message
 * where it can be found without scrolling.
 *
 * ## Plain text, and no shouting
 *
 * WhatsApp renders `*bold*`, and a message that uses it for every heading is
 * harder to skim than one that uses it for two. Bold marks the two things read
 * at a glance — the address and the amount — and nothing else.
 */

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
 */
export function dispatchMessage(
  order: Order & { lines: OrderLine[] },
  currency: Currency | undefined,
  clock24h: boolean,
): string {
  const money = (minor: number) =>
    currency ? formatMoney(minor, currency) : null;

  const lines: string[] = [];

  lines.push(t("dispatch.heading", { code: order.code }));
  lines.push(
    t("dispatch.placed", { when: formatDateTime(order.placedAt, clock24h) }),
  );
  lines.push("");

  lines.push(
    t("dispatch.customer", {
      name: order.customerName || t("orders.incompleteSignup"),
    }),
  );
  if (order.customerPhone) {
    lines.push(
      t("dispatch.phone", { phone: formatPhone(order.customerPhone) }),
    );
  }
  lines.push(`*${t("dispatch.address", { address: order.addressLine })}*`);

  // The pin, where there is one. `latitude`/`longitude` come from `addresses`
  // and are null for a one-time address — see the note on the `Order` type — so
  // this is a help in finding the door, never a substitute for the line above.
  if (order.latitude !== null && order.longitude !== null) {
    lines.push(
      t("dispatch.map", {
        url: `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`,
      }),
    );
  }

  if (order.courierNote) {
    lines.push(t("dispatch.note", { note: order.courierNote }));
  }

  // Grouped by shop, because a two-shop order is two pickups and the driver
  // needs to know which dish is at which door. `lines` is flat and carries the
  // `order_stores` row it belongs to — the same shape the receipt draws from.
  for (const store of order.stores) {
    lines.push("");
    lines.push(t("dispatch.from", { store: store.storeName }));

    for (const line of order.lines.filter(
      (one) => one.orderStoreId === store.id,
    )) {
      const amount = money(line.unitPrice * line.quantity);
      lines.push(
        `• ${line.quantity} × ${line.name}${amount ? ` — ${amount}` : ""}`,
      );
      // Indented under the dish, because an option on its own line at the same
      // level reads as a second thing to pack.
      for (const option of line.options) lines.push(`   ${option}`);
      if (line.note)
        lines.push(`   ${t("dispatch.lineNote", { note: line.note })}`);
    }
  }

  lines.push("");

  const total = money(order.total);
  if (total) {
    const delivery = money(order.deliveryFee);
    const discount = order.discount > 0 ? money(order.discount) : null;

    lines.push(t("dispatch.subtotal", { amount: money(order.subtotal) ?? "" }));
    if (delivery) lines.push(t("dispatch.delivery", { amount: delivery }));
    if (discount) lines.push(t("dispatch.discount", { amount: discount }));
    // The one number the driver acts on.
    lines.push(`*${t("dispatch.collect", { amount: total })}*`);
  } else {
    lines.push(t("dispatch.amountUnknown"));
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

  lines.push(t("dispatch.kitchenHeading", { code: order.code }));
  lines.push(
    t("dispatch.placed", { when: formatDateTime(order.placedAt, clock24h) }),
  );

  // A first name, not the full one. The bag needs a label; the shop does not
  // need a customer.
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  if (first) lines.push(t("dispatch.kitchenFor", { name: first }));

  lines.push("");

  for (const line of order.lines.filter(
    (one) => one.orderStoreId === storeId,
  )) {
    const quantity = line.fulfilledQuantity ?? line.quantity;
    if (quantity === 0) continue;

    lines.push(`• ${quantity} × ${line.name}`);
    for (const option of line.options) lines.push(`   ${option}`);
    if (line.note)
      lines.push(`   ${t("dispatch.lineNote", { note: line.note })}`);
  }

  // Only when this shop is the whole order. On a split order the note may be
  // about the other half, and passing it on invites a kitchen to act on an
  // instruction that was never theirs.
  if (order.courierNote && order.stores.length === 1) {
    lines.push("");
    lines.push(t("dispatch.note", { note: order.courierNote }));
  }

  if (portion) {
    lines.push("");
    lines.push(t("dispatch.kitchenFooter", { store: portion.storeName }));
  }

  return lines.join("\n");
}
