"use client";

import Link from "next/link";
import { useState } from "react";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Copyable } from "@/components/ui/copyable";
import { Map } from "@/components/ui/map";
import { Price } from "@/features/reference/price";
import { t } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";
import { statusTone } from "@/lib/order-status";
import { unitLabel } from "@/lib/unit-label";
import { itemUnit, linePrice } from "@/lib/units";

import type { Order, OrderLine, OrderStore, OrderStatus } from "./api/orders";

/**
 * An order with its lines — what `fetchOrder` returns, and what a receipt
 * needs. The queue's `Order` has none: a row does not draw them, and asking
 * for them per row would be a join nobody reads.
 */
type OrderWithLines = Order & { lines: OrderLine[] };

import { AmendOrder } from "./amend-order";
import { DispatchModal, WhatsAppMark } from "./dispatch-modal";
import { nextStatus, orderStatus, useAdvanceOrder } from "./use-orders";

/**
 * One order's receipt, and the actions on it.
 *
 * ## Why it is not the panel any more
 *
 * It was, and then an order got its own page. The two want the same content and
 * a different frame: the panel opens beside the queue so advancing does not
 * cost the operator their place in the list, and the page is what you send
 * somebody or open in a second tab.
 *
 * Rendering the receipt twice would mean two places to add a field to, and the
 * one that gets forgotten is whichever the author was not looking at. So the
 * body and the actions live here, and each frame supplies its own header.
 *
 * Nothing in here positions itself — no `absolute`, no fixed width, no assumed
 * scroll container. That is what lets the same markup sit in a 420px panel and
 * across a page.
 */

/**
 * Where this receipt is being read.
 *
 * The only thing it decides is where a link *out* of the receipt leads back to
 * — see the customer link below. The receipt itself is identical either way,
 * which is the point of sharing it.
 */
export type ReadFrom = "panel" | "page";

/**
 * The receipt: who, where, what, and what it came to.
 *
 * Laid out as the app's own order page is (`app/order/[id].tsx`), so the
 * operator reads the same receipt the customer is holding: white cards on the
 * cream ground, each with the soft card shadow and no border — the customer,
 * where it is going, one card per shop with its lines, then the bill with the
 * 2px ink rule above the total.
 */
export function OrderBody({
  order,
  from,
}: {
  order: OrderWithLines;
  from: ReadFrom;
}) {
  const itemCount = order.lines.length;

  return (
    <div className="flex min-h-0 flex-grow flex-col gap-md overflow-y-auto scroll-hint bg-background p-lg">
      <ReceiptCard>
        <div className="flex items-center gap-md">
          <Icon path={PERSON} />
          <div className="flex min-w-0 flex-grow flex-col gap-xxs">
            <Eyebrow>{t("orders.customer")}</Eyebrow>
            {/* Through to their profile: the next question after "who is
                this" is almost always "what else have they ordered", and the
                answer is one page away rather than a search.

                And back again, to whatever the operator was actually reading.
                From the panel that is the queue with this order still open;
                from the order's own page it is that page, named by its code.

                What travels is the order's **id** — and its code as a label,
                not as an address. A link built from a return *URL* in a query
                parameter is a link somebody else chooses the destination of;
                the profile builds the path itself from a uuid whose shape it
                can check. */}
            <Link
              href={
                from === "page"
                  ? `/customers/${order.customerId}?fromOrder=${order.id}&code=${encodeURIComponent(order.code)}`
                  : `/customers/${order.customerId}?fromQueue=${order.id}`
              }
              className="w-fit max-w-full truncate text-[16px] font-medium text-text hover:underline"
            >
              {order.customerName || t("orders.incompleteSignup")}
            </Link>
          </div>
          {order.customerPhone ? (
            // Both: click to ring, copy to paste into a courier app. The two
            // are separate gestures on purpose — a number that dialled when
            // somebody meant to copy it is a call to a customer at eleven at
            // night.
            <Copyable
              value={formatPhone(order.customerPhone)}
              href={`tel:${formatPhone(order.customerPhone)}`}
              label={t("orders.copyPhone")}
              className="shrink-0 text-[15px] tabular-nums"
            />
          ) : (
            <span className="shrink-0 text-[13px] text-text-faint">
              {t("orders.noPhone")}
            </span>
          )}
        </div>
      </ReceiptCard>

      <ReceiptCard>
        <div className="flex items-start gap-md">
          <Icon path={PIN} />
          <div className="flex min-w-0 flex-grow flex-col gap-xxs">
            <Eyebrow>{t("orders.deliveringTo")}</Eyebrow>
            {/* The snapshot written at checkout, not the customer's current
                address — this is what was agreed, and it must not change
                under a delivery because somebody edited their address book. */}
            <p className="text-[15px] font-medium">{order.addressLine}</p>
          </div>
        </div>
        {order.courierNote && (
          // Sun-washed, because a courier note is the one line on the receipt
          // that changes what somebody physically does at the door.
          <div className="mt-md rounded-sm bg-warning-wash px-md py-md text-[14px]">
            <span className="font-medium">{t("orders.courierNote")}</span>
            {order.courierNote}
          </div>
        )}
        {/* The pin comes from `addresses`, which the order references — it is
            never snapshotted, so this is where the customer's pin is *now*.
            Good enough to find a door, not evidence. */}
        <Map
          className="mt-md"
          latitude={order.latitude}
          longitude={order.longitude}
          label={t("orders.locationLabel", {
            name: order.addressLine,
          })}
        />
      </ReceiptCard>

      {/* "Items" with its count on the same baseline — the app's heading row
          over its shop cards. */}
      <div className="flex items-baseline justify-between gap-md px-xxs pt-sm">
        <h3 className="text-[19px]">{t("orders.items")}</h3>
        <Eyebrow>
          {[
            itemCount === 1
              ? t("orders.itemCountOne")
              : t("orders.itemCount", { count: itemCount }),
            order.stores.length > 1 &&
              t("orders.fromShops", { count: order.stores.length }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Eyebrow>
      </div>

      {order.stores.map((store) => (
        <StoreSection
          key={store.id}
          store={store}
          lines={order.lines.filter((line) => line.orderStoreId === store.id)}
          currencyCode={order.currencyCode}
          shopRate={order.shopRate}
        />
      ))}

      <ReceiptCard>
        <h3 className="mb-sm text-[19px]">{t("orders.payment")}</h3>
        {/* Every line of the bill at the one rate, the platform's money on it
            included. The ladder and the discount were *charged* at the
            platform's rate — `0120` left the money path alone — but what is
            being read here is the bill the customer settles at the door, and
            they settle all of it in one currency at one shop's number. A
            delivery fee converted at a different rate from the subtotal above
            it would not add up to the total below it. */}
        <Money
          label={t("orders.subtotal")}
          value={order.subtotal}
          code={order.currencyCode}
          shopRate={order.shopRate}
        />
        <Money
          label={t("orders.delivery")}
          value={order.deliveryFee}
          code={order.currencyCode}
          shopRate={order.shopRate}
        />
        {order.discount > 0 && (
          <Money
            label={t("orders.discount")}
            value={-order.discount}
            code={order.currencyCode}
            shopRate={order.shopRate}
            good
          />
        )}
        {/* The app's strong rule: 2px of ink above the total, the one heavy
            line on the receipt, so the eye lands on what is owed. */}
        <div aria-hidden className="mt-xs h-[2px] rounded-full bg-text" />
        <div className="flex items-baseline justify-between pt-md">
          <span className="font-heading text-[19px] font-semibold">
            {t("orders.total")}
          </span>
          <Price
            value={order.total}
            code={order.currencyCode}
            shopRate={order.shopRate}
            align="end"
            className="text-[22px] font-medium"
          />
        </div>
      </ReceiptCard>
    </div>
  );
}

/**
 * Advance, and cancel.
 *
 * One button for the whole order. A customer who ordered from two shops placed
 * one order, and "half confirmed" is not a state anybody outside the schema can
 * act on.
 *
 * Cancel is the only action here with a confirmation, and for a structural
 * reason: it is terminal, the function refuses to move off it, so there is no
 * undo to offer — and undo is what every other move gets.
 */
export function OrderActions({
  order,
  statuses,
}: {
  // The lines as well as the header: the dispatch message below is the whole
  // order, not a summary of it.
  order: OrderWithLines;
  statuses: OrderStatus[] | undefined;
}) {
  const { advance } = useAdvanceOrder(statuses);
  const [amending, setAmending] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const cancelled = statuses?.find((status) => status.progress === null);
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;

  /**
   * Whether the order can still be changed.
   *
   * Not "is it terminal". An order that has left the kitchen cannot be amended
   * in any useful sense — the bag is packed and on a scooter, and a screen that
   * offers to remove a dish from it is offering something nobody can carry out.
   * So the control goes away one step earlier than Cancel does.
   *
   * **Derived from `progress`, not from a list of slugs.** The rule is
   * structural: amending is possible while **more than one move remains**,
   * because the last remaining move is always the one that ends the order.
   *
   * Hidden rather than disabled. A disabled button is a promise the screen
   * cannot keep, and there is nothing the operator could do to re-enable it —
   * it is not off because of something they have not done yet, it is off
   * because the moment has passed.
   */
  const path = (statuses ?? []).filter((one) => one.progress !== null);
  const here = status?.progress ?? null;
  const movesLeft =
    here === null
      ? 0
      : path.filter((one) => (one.progress as number) > here).length;
  const amendable = movesLeft > 1;

  return (
    // The app's bottom bar: white, pinned under the scrolling receipt, with the
    // one action the screen exists for at full size at the very bottom.
    <div className="flex shrink-0 flex-col gap-sm bg-surface px-lg pb-lg pt-md shadow-[0_-3px_10px_rgba(31,25,21,0.06)]">
      {/* The secondary actions, as one row of equals above the big button.
          None is what the operator came here to press — that is the step
          below — so none is filled ink.

          Dispatch stays whatever the status is: a driver is told about an order
          being cooked, and told again about one already on its way, so taking
          it away at the end would remove it exactly when somebody is chasing a
          late delivery. Amending does not — see `amendable`. */}
      <div
        role="group"
        aria-label={t("orders.otherActions")}
        className="flex items-center gap-sm"
      >
        {/* WhatsApp's own green, so the control that hands off to it is
            recognised before it is read — which matters on a button reached
            for under time pressure. Restricted to controls that open that
            application, like the brand red is restricted to the mark. */}
        <span className="flex min-w-0 flex-1">
          <Button
            size="sm"
            fullWidth
            onClick={() => setDispatching(true)}
            className="bg-whatsapp text-on-whatsapp hover:bg-whatsapp-deep"
          >
            <WhatsAppMark size={16} />
            {t("dispatch.open")}
          </Button>
        </span>
        {amendable && (
          <span className="flex min-w-0 flex-1">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => setAmending(true)}
            >
              {t("amend.open")}
            </Button>
          </span>
        )}
        {next && cancelled && (
          <span className="flex min-w-0 flex-1">
            <ConfirmButton
              onConfirm={() =>
                advance({
                  orderId: order.id,
                  code: order.code,
                  fromSlug: status?.slug ?? "",
                  toSlug: cancelled.slug,
                  toName: cancelled.name,
                  undoable: false,
                })
              }
              titleKey="orders.cancelTitle"
              bodyKey="orders.cancelBody"
              confirmKey="orders.cancelConfirm"
              variant="danger"
              // The app's danger button — coral type on cream-deep. Quiet
              // enough not to compete with the step below, red enough that
              // nobody presses it thinking it is Amend. The cost is said by the
              // dialog it opens.
              triggerVariant="danger-soft"
              size="sm"
              fullWidth
            >
              {t("orders.cancel")}
            </ConfirmButton>
          </span>
        )}
      </div>

      {dispatching && (
        <DispatchModal
          order={order}
          lines={order.lines}
          onClose={() => setDispatching(false)}
        />
      )}

      {amending && (
        <AmendOrder
          order={order}
          lines={order.lines}
          onClose={() => setAmending(false)}
        />
      )}

      {next && (
        // The app's primary: espresso ink, 54 tall, the whole width. Named
        // after the step it takes — "Confirm", "Send driver", "Delivered" — and
        // carrying that step's dot, so the colour an operator has learned for
        // each step is still on the button without painting the button in it.
        <Button
          size="lg"
          fullWidth
          onClick={() =>
            advance({
              orderId: order.id,
              code: order.code,
              fromSlug: status?.slug ?? "",
              toSlug: next.slug,
              toName: next.name,
              undoable: next.progress !== null,
            })
          }
        >
          <span
            aria-hidden
            className="size-[9px] shrink-0 rounded-full"
            style={{ background: statusTone(next.slug).dot }}
          />
          {next.name}
        </Button>
      )}
    </div>
  );
}

function StoreSection({
  store,
  lines,
  currencyCode,
  shopRate,
}: {
  store: OrderStore;
  lines: OrderLine[];
  currencyCode: string;
  /** The rate this order reads at — see `Order.shopRate`. */
  shopRate: number | null;
}) {
  const tone = statusTone(store.statusSlug);

  return (
    // One card per shop, as the app draws them: the shop's header, then its
    // lines with hairlines between.
    <section className="rounded-md bg-surface p-[14px] shadow-card">
      <div className="flex items-center gap-[10px] pb-sm">
        <Thumbnail src={store.storeImageUrl} size={36} name={store.storeName} />
        <div className="flex min-w-0 flex-grow flex-col">
          <h4 className="truncate text-[17px]">{store.storeName}</h4>
          <span
            className="flex items-center gap-xs text-[12px] font-medium"
            style={{ color: tone.ink }}
          >
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full"
              style={{ background: tone.dot }}
            />
            {store.statusName}
          </span>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {lines.map((line) => {
          // What is actually coming. `null` is the ordinary case and means the
          // line is untouched — which is why the strike-through and the note
          // below appear only when somebody has changed something.
          const coming = line.fulfilledQuantity ?? line.quantity;
          const gone = coming === 0;
          const changed = line.fulfilledQuantity !== null;

          return (
            <li key={line.id} className="flex items-start gap-md py-md">
              <Thumbnail src={line.imageUrl} size={40} name={line.name} />
              <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="flex items-baseline gap-[6px]">
                  {/* Struck through rather than removed. "We could not bring
                      your kibbeh" is something the customer needs to see, and
                      a line that simply vanished from the receipt says nothing
                      at all — it reads as an order that was always smaller. */}
                  <span
                    className={cx(
                      "text-[15px] font-medium",
                      gone && "text-text-faint line-through",
                    )}
                  >
                    {line.name}
                  </span>
                  {/* The amount for a line sold by weight, the count
                      otherwise — the app's eyebrow beside the name. Since
                      `0122` the price beside it is a proportion of the
                      amount, and "2×" is a number that cannot be checked
                      against it — see `linePrice`. */}
                  <span className="shrink-0 text-[13px] font-medium text-text-faint tabular-nums">
                    {itemUnit(line)?.step == null
                      ? t("orders.quantity", { count: coming })
                      : unitLabel(line, coming)}
                  </span>
                </span>
                {(line.options.length > 0 || line.note) && (
                  <span className="text-[13px] text-text-soft">
                    {[...line.options, line.note].filter(Boolean).join(" · ")}
                  </span>
                )}
                {changed && (
                  // The app's error pill.
                  <span className="mt-xxs flex h-[22px] w-fit items-center rounded-full bg-danger-wash px-[9px] text-[11px] font-medium text-danger">
                    {gone
                      ? t("amend.outOfStock")
                      : // The amount on a line sold by weight — "Only 1 kg
                        // available" is the sentence that was said on the
                        // phone, where "Only 1 available" is not. `0122`.
                        t("amend.short", { count: unitLabel(line, coming) })}
                  </span>
                )}
                {line.amendmentReason === "substitute" && (
                  // The app's cream pill.
                  <span className="mt-xxs flex h-[22px] w-fit items-center rounded-full bg-neutral-fill px-[9px] text-[11px] font-medium text-text">
                    {t("amend.substituteFor", {
                      name:
                        lines.find((one) => one.id === line.replacesLineId)
                          ?.name ?? "",
                    })}
                  </span>
                )}
              </div>
              <div className="shrink-0">
                <Price
                  // The line's own snapshot, not today's menu: a receipt says
                  // what was charged. `0122`.
                  value={linePrice(
                    line.unitPrice,
                    line.optionsPrice,
                    itemUnit(line),
                    coming,
                  )}
                  code={currencyCode}
                  shopRate={shopRate}
                  align="end"
                  className={cx("text-[15px] font-medium", gone && "opacity-50")}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A picture, or a placeholder that is obviously one.
 *
 * `image_url` is nullable everywhere it appears, and an item deleted since the
 * order was placed has none at all — so the absent case is normal rather than
 * exceptional. A plain `<img>` with a broken source would render the browser's
 * torn-page icon, which reads as a fault.
 *
 * `<img>` rather than `next/image`: these are arbitrary URLs a merchant typed,
 * pointing anywhere, and `next/image` would need every one of those hosts
 * declared in the config before it would load them at all.
 */
export function Thumbnail({
  src,
  size,
  rounded = false,
  name,
}: {
  src: string | null;
  size: number;
  rounded?: boolean;
  /** What it is a picture of, for the button that opens it. */
  name?: string;
}) {
  // 8, the app's `radius.xs` for thumbnails.
  const style = { width: size, height: size, borderRadius: rounded ? 999 : 8 };

  if (!src) {
    return <ImagePlaceholder style={style} />;
  }

  // It opens full size on a click, like every other picture in the dashboard.
  // Here that is worth more than most: an operator reading an order is often
  // deciding whether the kitchen sent the right thing, and a 40pt square is
  // not enough to settle it.
  return <PreviewImage src={src} name={name} style={style} />;
}

/** The app's standard card: white, radius 14, padding 14, soft shadow. */
function ReceiptCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-md bg-surface p-[14px] shadow-card">
      {children}
    </section>
  );
}

/** The app's `eyebrow`: Inter 500, 12, faint, a little tracking. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-medium tracking-[0.05em] text-text-faint">
      {children}
    </span>
  );
}

const PERSON =
  "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0";
const PIN =
  "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";

/** The app's 30pt icon chip: cream-deep tile, ink glyph. */
function Icon({ path }: { path: string }) {
  return (
    <span
      aria-hidden
      className="flex size-[30px] shrink-0 items-center justify-center rounded-xs bg-neutral-fill text-text"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </span>
  );
}

/**
 * One line of the bill — the app's: label and amount both Inter 500 at 15,
 * the discount in green with its minus sign.
 *
 * `items-baseline` rather than centred: the two labels and the two primary
 * figures sit on one line whether or not a converted figure hangs below, so the
 * column of amounts reads straight down even when a rate is missing for one.
 */
function Money({
  label,
  value,
  code,
  shopRate,
  good = false,
}: {
  label: string;
  value: number;
  code: string;
  /** The rate this order reads at — see `Order.shopRate`. */
  shopRate?: number | null;
  /** Money saved — green, as the app sets it. */
  good?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between py-[6px] text-[15px] font-medium",
        good && "text-accent-deep",
      )}
    >
      <span>{label}</span>
      <Price value={value} code={code} shopRate={shopRate} align="end" />
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-md bg-background p-lg">
      <div className="h-[64px] rounded-md bg-line-soft" />
      <div className="h-[260px] rounded-md bg-line-soft" />
      <div className="h-[88px] rounded-md bg-line-soft" />
      <div className="h-[140px] rounded-md bg-line-soft" />
    </div>
  );
}
