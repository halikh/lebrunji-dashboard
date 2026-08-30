"use client";

import { Button } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Copyable } from "@/components/ui/copyable";
import { Map } from "@/components/ui/map";
import { Panel } from "@/components/ui/panel";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { formatDayAndTime } from "@/lib/time";

import type { OrderLine, OrderStore } from "./api/orders";
import {
  nextStatus,
  orderStatus,
  useAdvanceOrder,
  useOrder,
  useOrderStatuses,
} from "./use-orders";

/**
 * The receipt: one order, opened beside the queue.
 *
 * The queue carries what is needed to *triage*; this carries what is needed to
 * *act* — the number to ring, the note the courier has to read, the pictures to
 * check a bag against, and where the door is.
 *
 * It never replaces the queue. Advancing must not cost the operator their place
 * in the list, which is the whole reason this is a panel and not a page.
 */
export function OrderPanel({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const statuses = useOrderStatuses();
  const order = useOrder(orderId);
  const { advance } = useAdvanceOrder(statuses.data);
  const { format, convertTo, secondaryCode } = useMoney();

  const cancelled = statuses.data?.find((status) => status.progress === null);
  const status = order.data ? orderStatus(order.data, statuses.data) : null;
  const next = status ? nextStatus(statuses.data, status.slug) : null;

  return (
    <Panel
      open={orderId !== null}
      onClose={onClose}
      label={t("orders.panelLabel")}
    >
      {order.isPending && <PanelSkeleton />}

      {order.isError && (
        <div className="flex flex-col gap-lg p-xxl">
          <p role="alert" className="text-[14px] font-medium text-danger">
            {t("orders.detailFailed")}
          </p>
          <Button variant="secondary" onClick={() => void order.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {order.isSuccess && (
        <>
          <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
            <div className="flex flex-grow flex-col gap-xxs">
              {/* Copy only: there is nowhere for a code to go, and it is pasted
                  into messages constantly. Reading sixteen characters back off
                  a screen by hand is where mistakes come from. */}
              <h2 className="flex items-center gap-sm text-[20px]">
                <Copyable
                  value={order.data.code}
                  label={t("orders.copyCode")}
                />
              </h2>
              <span className="text-[13px] text-text-faint">
                {t("orders.placed")} {formatDayAndTime(order.data.placedAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft lg:flex"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
            <section className="flex flex-col gap-sm">
              <SectionTitle>{t("orders.customer")}</SectionTitle>
              <div className="flex flex-wrap items-baseline gap-md">
                <span className="text-[15px] font-semibold">
                  {order.data.customerName || t("orders.incompleteSignup")}
                </span>
                {order.data.customerPhone ? (
                  // Both: tap to ring, copy to paste into a courier app. The
                  // two are separate gestures on purpose — a number that dialled
                  // when somebody meant to copy it is a call to a customer at
                  // eleven at night.
                  <Copyable
                    value={order.data.customerPhone}
                    href={`tel:${order.data.customerPhone}`}
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
              <p className="text-[14px] leading-relaxed">
                {order.data.addressLine}
              </p>
              {order.data.courierNote && (
                <div className="rounded-md bg-yellow-wash px-md py-md text-[13px] leading-relaxed">
                  <strong className="font-semibold">
                    {t("orders.courierNote")}
                  </strong>
                  {order.data.courierNote}
                </div>
              )}
              {/* The pin comes from `addresses`, which the order references —
                  it is never snapshotted, so this is where the customer's pin
                  is *now*. Good enough to find a door, not evidence. */}
              <Map
                latitude={order.data.latitude}
                longitude={order.data.longitude}
                label={t("orders.locationLabel", {
                  name: order.data.addressLine,
                })}
              />
            </section>

            {order.data.stores.map((store) => (
              <StoreSection
                key={store.id}
                store={store}
                lines={order.data.lines.filter(
                  (line) => line.orderStoreId === store.id,
                )}
                currencyCode={order.data.currencyCode}
                format={format}
              />
            ))}

            <div className="flex flex-col gap-sm border-t border-border pt-lg text-[14px]">
              <Money
                label={t("orders.subtotal")}
                value={order.data.subtotal}
                code={order.data.currencyCode}
                format={format}
              />
              <Money
                label={t("orders.delivery")}
                value={order.data.deliveryFee}
                code={order.data.currencyCode}
                format={format}
              />
              {order.data.discount > 0 && (
                <Money
                  label={t("orders.discount")}
                  value={-order.data.discount}
                  code={order.data.currencyCode}
                  format={format}
                />
              )}
              <div className="flex items-baseline justify-between pt-xs">
                <span className="text-[16px] font-bold">
                  {t("orders.total")}
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-[16px] font-bold tabular-nums">
                    {format(order.data.total, order.data.currencyCode)}
                  </span>
                  {/* The same money in the other currency.
                      Display only, and it says so by sitting under the real
                      total in lighter type: an order is recorded in what it was
                      priced and paid in, and a stored amount that moved with
                      the rate would be a receipt that rewrites itself. */}
                  <Secondary
                    value={order.data.total}
                    code={order.data.currencyCode}
                    convertTo={convertTo}
                    secondaryCode={secondaryCode}
                  />
                </div>
              </div>
            </div>
          </div>

          {/*
            One button, for the whole order. A customer who ordered from two
            shops placed one order, and "half confirmed" is not a state anybody
            outside the schema can act on.

            Cancel is the only action here with a confirmation, and for a
            structural reason: it is terminal, the function refuses to move off
            it, so there is no undo to offer — and undo is what every other move
            gets.
          */}
          <div className="flex shrink-0 items-center gap-sm border-t border-border p-xxl">
            {next && (
              <Button
                fullWidth
                style={{
                  background: statusTone(next.slug).fill,
                  color: statusTone(next.slug).onFill,
                }}
                onClick={() =>
                  advance({
                    orderId: order.data.id,
                    fromSlug: status?.slug ?? "",
                    toSlug: next.slug,
                    toName: next.name,
                    undoable: next.progress !== null,
                  })
                }
              >
                {next.name}
              </Button>
            )}

            {cancelled && next && (
              <ConfirmButton
                onConfirm={() =>
                  advance({
                    orderId: order.data.id,
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
        </>
      )}
    </Panel>
  );
}

/**
 * One shop's part of the receipt.
 *
 * The store name is a heading rather than a label — with two shops on an order,
 * it is what tells the operator which bag they are looking at, and it has to be
 * findable while glancing between a screen and a counter.
 */
function StoreSection({
  store,
  lines,
  currencyCode,
  format,
}: {
  store: OrderStore;
  lines: OrderLine[];
  currencyCode: string;
  format: (minorUnits: number, code: string) => string;
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
        {lines.map((line) => (
          <div key={line.id} className="flex items-start gap-md text-[14px]">
            <Thumbnail src={line.imageUrl} size={44} />
            <span className="w-[26px] shrink-0 pt-xs font-bold text-text-soft tabular-nums">
              {t("orders.quantity", { count: line.quantity })}
            </span>
            <div className="flex min-w-0 flex-grow flex-col gap-xxs">
              <span className="font-semibold">{line.name}</span>
              {(line.options.length > 0 || line.note) && (
                <span className="text-[12px] text-text-faint">
                  {[...line.options, line.note].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <span className="shrink-0 pt-xs font-semibold tabular-nums">
              {format(line.unitPrice * line.quantity, currencyCode)}
            </span>
          </div>
        ))}
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
function Thumbnail({
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

function Money({
  label,
  value,
  code,
  format,
}: {
  label: string;
  value: number;
  code: string;
  format: (minorUnits: number, code: string) => string;
}) {
  return (
    <div className="flex justify-between text-text-soft">
      <span>{label}</span>
      <span className="tabular-nums">{format(value, code)}</span>
    </div>
  );
}

function Secondary({
  value,
  code,
  convertTo,
  secondaryCode,
}: {
  value: number;
  code: string;
  convertTo: (minorUnits: number, from: string, to: string) => string | null;
  secondaryCode: (primary: string) => string | null;
}) {
  const other = secondaryCode(code);
  const converted = other ? convertTo(value, code, other) : null;

  // Absent rather than wrong. A converted figure that quietly used a rate of 1
  // would be a number somebody might read out to a customer.
  if (!converted) return null;

  return (
    <span className="text-[13px] text-text-faint tabular-nums">
      {converted}
    </span>
  );
}

function PanelSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-lg p-xxl">
      <div className="h-[24px] w-[180px] rounded-sm bg-neutral-fill" />
      <div className="h-[14px] w-[120px] rounded-sm bg-neutral-fill" />
      <div className="mt-lg h-[60px] rounded-md bg-neutral-fill" />
      <div className="h-[200px] rounded-md bg-neutral-fill" />
    </div>
  );
}
