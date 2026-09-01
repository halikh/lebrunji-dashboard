"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Copyable } from "@/components/ui/copyable";
import { Map } from "@/components/ui/map";
import { Price } from "@/features/reference/price";
import { t } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";
import { statusTone } from "@/lib/order-status";

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

/** The receipt: who, where, what, and what it came to. */
export function OrderBody({
  order,
  from,
}: {
  order: OrderWithLines;
  from: ReadFrom;
}) {
  return (
    <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
      <section className="flex flex-col gap-sm">
        <SectionTitle>{t("orders.customer")}</SectionTitle>
        <div className="flex flex-wrap items-baseline gap-md">
          {/* Through to their profile: the next question after "who is this"
              is almost always "what else have they ordered", and the answer is
              one page away rather than a search. */}
          {/* And back again, to whatever the operator was actually reading.
              From the panel that is the queue with this order still open; from
              the order's own page it is that page, named by its code — "Order
              #DL-260830-00042" says where you are going in a way "All orders"
              does not, and from a page there is no queue behind you to return
              to.

              What travels is the order's **id** — and its code as a label, not
              as an address. A link built from a return *URL* in a query
              parameter is a link somebody else chooses the destination of; the
              profile builds the path itself from a uuid whose shape it can
              check. */}
          <Link
            href={
              from === "page"
                ? `/customers/${order.customerId}?fromOrder=${order.id}&code=${encodeURIComponent(order.code)}`
                : `/customers/${order.customerId}?fromQueue=${order.id}`
            }
            className="text-[15px] font-semibold text-primary hover:underline"
          >
            {order.customerName || t("orders.incompleteSignup")}
          </Link>
          {order.customerPhone ? (
            // Both: tap to ring, copy to paste into a courier app. The
            // two are separate gestures on purpose — a number that dialled
            // when somebody meant to copy it is a call to a customer at
            // eleven at night.
            <Copyable
              value={formatPhone(order.customerPhone)}
              href={`tel:${formatPhone(order.customerPhone)}`}
              label={t("orders.copyPhone")}
              className="text-[14px]"
            />
          ) : (
            <span className="text-[13px] text-text-faint">
              {t("orders.noPhone")}
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <SectionTitle>{t("orders.address")}</SectionTitle>
        {/* The snapshot written at checkout, not the customer's current
            address — this is what was agreed, and it must not change
            under a delivery because somebody edited their address book. */}
        <p className="text-[14px] leading-relaxed">{order.addressLine}</p>
        {order.courierNote && (
          <div className="rounded-md bg-yellow-wash px-md py-md text-[13px] leading-relaxed">
            <strong className="font-semibold">{t("orders.courierNote")}</strong>
            {order.courierNote}
          </div>
        )}
        {/* The pin comes from `addresses`, which the order references —
            it is never snapshotted, so this is where the customer's pin
            is *now*. Good enough to find a door, not evidence. */}
        <Map
          latitude={order.latitude}
          longitude={order.longitude}
          label={t("orders.locationLabel", {
            name: order.addressLine,
          })}
        />
      </section>

      {order.stores.map((store) => (
        <StoreSection
          key={store.id}
          store={store}
          lines={order.lines.filter((line) => line.orderStoreId === store.id)}
          currencyCode={order.currencyCode}
        />
      ))}

      <div className="flex flex-col gap-sm border-t border-border pt-lg text-[14px]">
        <Money
          label={t("orders.subtotal")}
          value={order.subtotal}
          code={order.currencyCode}
        />
        <Money
          label={t("orders.delivery")}
          value={order.deliveryFee}
          code={order.currencyCode}
        />
        {order.discount > 0 && (
          <Money
            label={t("orders.discount")}
            value={-order.discount}
            code={order.currencyCode}
          />
        )}
        <div className="flex items-baseline justify-between pt-xs">
          <span className="text-[16px] font-bold">{t("orders.total")}</span>
          <Price
            value={order.total}
            code={order.currencyCode}
            align="end"
            className="text-[16px] font-bold"
          />
        </div>
      </div>
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
   * **Derived from `progress`, never from a slug.** `order_statuses` is a
   * lookup table precisely so a merchant can insert a step (`0032` says so),
   * and a hardcoded list of "amendable" slugs would silently exclude any new
   * one — which is the same failure that would hide orders from the queue. The
   * rule instead is structural: amending is possible while **more than one move
   * remains**, because the last remaining move is always the one that ends the
   * order.
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
    <div className="flex shrink-0 flex-col gap-sm border-t border-border p-xxl">
      {/* One row, both secondary. Neither is the thing the operator came here
          to press — that is the status button below — and a dispatch control
          that took a full-width row of its own was spending the panel's most
          valuable space on something done once per order.

          Dispatch stays whatever the status is: a driver is told about an order
          being cooked, and told again about one already on its way, so taking
          it away at the end would remove it exactly when somebody is chasing a
          late delivery. Amending does not — see `amendable`. */}
      <div className="flex items-center gap-sm">
        {/* WhatsApp's own green, so the control that hands off to it is
            recognised before it is read — which matters on a button reached
            for under time pressure. Restricted to controls that open that
            application, like the brand red is restricted to the mark. */}
        <Button
          size="sm"
          onClick={() => setDispatching(true)}
          className="border-whatsapp bg-whatsapp text-on-whatsapp hover:bg-whatsapp-deep"
        >
          <WhatsAppMark size={14} />
          {t("dispatch.open")}
        </Button>
        {amendable && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmending(true)}
          >
            {t("amend.open")}
          </Button>
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
        <div className="flex items-center gap-sm">
          {/* `flex-grow`, not `w-full`. `fullWidth` makes the button
          `w-full`, which took the whole row and pushed Cancel off the
          edge of the panel — visibly gone, on the one action here that
          cannot be undone. Growing into what is left leaves room for
          it. */}
          <span className="flex min-w-0 flex-grow">
            <Button
              fullWidth
              style={{
                background: statusTone(next.slug).fill,
                color: statusTone(next.slug).onFill,
              }}
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
              {next.name}
            </Button>
          </span>

          {cancelled && (
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
              // Filled danger rather than a quiet link. It is a real action
              // with a real cost, and a text link beside a filled button
              // reads as a footnote — which is the wrong weight for the one
              // thing here that cannot be undone.
              triggerVariant="danger"
            >
              {t("orders.cancel")}
            </ConfirmButton>
          )}
        </div>
      )}
    </div>
  );
}

function StoreSection({
  store,
  lines,
  currencyCode,
}: {
  store: OrderStore;
  lines: OrderLine[];
  currencyCode: string;
}) {
  const tone = statusTone(store.statusSlug);

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center gap-md">
        <Thumbnail src={store.storeImageUrl} size={38} rounded />
        <div className="flex min-w-0 flex-grow flex-col gap-xxs">
          <h3 className="truncate text-[17px]">{store.storeName}</h3>
          <span
            className="flex items-center gap-sm text-[12px] font-semibold"
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

      <div className="flex flex-col gap-md">
        {lines.map((line) => {
          // What is actually coming. `null` is the ordinary case and means the
          // line is untouched — which is why the strike-through and the note
          // below appear only when somebody has changed something.
          const coming = line.fulfilledQuantity ?? line.quantity;
          const gone = coming === 0;
          const changed = line.fulfilledQuantity !== null;

          return (
            <div key={line.id} className="flex items-start gap-md text-[14px]">
              <Thumbnail src={line.imageUrl} size={44} />
              <span
                className={cx(
                  "w-[26px] shrink-0 pt-xs font-bold tabular-nums",
                  gone ? "text-text-faint" : "text-text-soft",
                )}
              >
                {t("orders.quantity", { count: coming })}
              </span>
              <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                {/* Struck through rather than removed. "We could not bring your
                    kibbeh" is something the customer needs to see, and a line
                    that simply vanished from the receipt says nothing at all —
                    it reads as an order that was always smaller. */}
                <span
                  className={cx(
                    "font-semibold",
                    gone && "text-text-faint line-through",
                  )}
                >
                  {line.name}
                </span>
                {(line.options.length > 0 || line.note) && (
                  <span className="text-[12px] text-text-faint">
                    {[...line.options, line.note].filter(Boolean).join(" · ")}
                  </span>
                )}
                {changed && (
                  <span className="text-[12px] font-semibold text-danger">
                    {gone
                      ? t("amend.outOfStock")
                      : t("amend.short", { count: coming })}
                  </span>
                )}
                {line.amendmentReason === "substitute" && (
                  <span className="text-[12px] font-semibold text-active-ink">
                    {t("amend.substituteFor", {
                      name:
                        lines.find((one) => one.id === line.replacesLineId)
                          ?.name ?? "",
                    })}
                  </span>
                )}
              </div>
              <div className="shrink-0 pt-xs">
                <Price
                  value={line.unitPrice * coming}
                  code={currencyCode}
                  align="end"
                  className={cx("font-semibold", gone && "opacity-50")}
                />
              </div>
            </div>
          );
        })}
      </div>
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
}: {
  src: string | null;
  size: number;
  rounded?: boolean;
}) {
  const style = { width: size, height: size, borderRadius: rounded ? 999 : 14 };

  if (!src) {
    return (
      <div aria-hidden className="shrink-0 bg-neutral-fill" style={style} />
    );
  }

  return (
    // A plain `<img>`, and the rule is overridden rather than obeyed: these are
    // arbitrary URLs a merchant typed, pointing at any host. `next/image`
    // refuses a host that is not declared in `next.config`, so it would turn
    // every picture into a configuration change — and the optimisation it
    // offers is worth nothing on a 44px thumbnail.
    //
    // Decorative: the name is right beside it in text, so announcing the
    // picture too would read the item twice.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className="shrink-0 object-cover"
      style={style}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
      {children}
    </h3>
  );
}

/**
 * One line of the breakdown.
 *
 * `items-baseline` rather than centred: the two labels and the two primary
 * figures sit on one line whether or not a converted figure hangs below, so the
 * column of amounts reads straight down even when a rate is missing for one.
 */
function Money({
  label,
  value,
  code,
}: {
  label: string;
  value: number;
  code: string;
}) {
  return (
    <div className="flex items-baseline justify-between text-text-soft">
      <span>{label}</span>
      <Price value={value} code={code} align="end" />
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-lg p-xxl">
      <div className="h-[24px] w-[180px] rounded-sm bg-neutral-fill" />
      <div className="h-[14px] w-[120px] rounded-sm bg-neutral-fill" />
      <div className="mt-lg h-[60px] rounded-md bg-neutral-fill" />
      <div className="h-[200px] rounded-md bg-neutral-fill" />
    </div>
  );
}
