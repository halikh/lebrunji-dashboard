"use client";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Panel } from "@/components/ui/panel";
import { t } from "@/i18n/translations";
import { formatMoney } from "@/lib/money";
import { statusTone } from "@/lib/order-status";
import { formatDayAndTime } from "@/lib/time";

import {
  nextStatus,
  useAdvanceOrder,
  useOrder,
  useOrderStatuses,
} from "./use-orders";

/**
 * One order, opened beside the queue.
 *
 * The queue carries what the operator needs to *triage*; this carries what they
 * need to *act* — the phone number to ring, the note the courier has to read,
 * the lines to check against the bag.
 *
 * It never replaces the queue. Advancing an order must not cost the operator
 * their place in the list, which is the whole reason this is a panel.
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
  const { advance } = useAdvanceOrder();

  // `cancelled` is found by shape, not by name: it is the status off the path.
  // A hardcoded slug would break the day somebody renames it, and the rename is
  // supported — `order_statuses` is a lookup table.
  const cancelled = statuses.data?.find((status) => status.progress === null);

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
              <h2 className="text-[20px] tabular-nums">{order.data.code}</h2>
              <span className="text-[13px] text-text-faint">
                {t("orders.placed")} {formatDayAndTime(order.data.placedAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="hidden size-[30px] items-center justify-center rounded-full border border-border text-text-soft lg:flex"
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
            <Section title={t("orders.customer")}>
              <div className="flex flex-wrap items-baseline gap-md">
                <span className="text-[15px] font-semibold">
                  {order.data.customerName || t("orders.incompleteSignup")}
                </span>
                {order.data.customerPhone ? (
                  // A link, because the operator's next move is almost always
                  // to ring — not to read the number and pick up a handset.
                  <a
                    href={`tel:${order.data.customerPhone}`}
                    className="text-[14px] font-semibold text-primary hover:underline"
                  >
                    {order.data.customerPhone}
                  </a>
                ) : (
                  <span className="text-[13px] text-text-faint">
                    {t("orders.noPhone")}
                  </span>
                )}
              </div>
              {/* The snapshot written at checkout, not the customer's current
                  address — this is what was agreed, and it must not change
                  under a delivery because somebody edited their address book. */}
              <p className="text-[14px] leading-relaxed text-text-soft">
                {order.data.addressLine}
              </p>
              {order.data.courierNote && (
                <div className="rounded-md bg-yellow-wash px-md py-md text-[13px] leading-relaxed">
                  <strong className="font-semibold">
                    {t("orders.courierNote")}:{" "}
                  </strong>
                  {order.data.courierNote}
                </div>
              )}
            </Section>

            {order.data.stores.map((store) => {
              const tone = statusTone(store.statusSlug);
              const lines = order.data.lines.filter(
                (line) => line.orderStoreId === store.id,
              );

              return (
                <Section
                  key={store.id}
                  title={store.storeName}
                  aside={
                    <span
                      className="flex items-center gap-sm text-[12px] font-semibold"
                      style={{ color: tone.ink }}
                    >
                      <span
                        aria-hidden
                        className="size-[7px] rounded-full"
                        style={{ background: tone.dot }}
                      />
                      {store.statusName}
                    </span>
                  }
                >
                  {lines.map((line) => (
                    <div key={line.id} className="flex gap-md text-[14px]">
                      <span className="w-[26px] shrink-0 font-bold text-text-soft tabular-nums">
                        {t("orders.quantity", { count: line.quantity })}
                      </span>
                      <div className="flex flex-grow flex-col gap-xxs">
                        <span className="font-semibold">{line.name}</span>
                        {(line.options.length > 0 || line.note) && (
                          <span className="text-[12px] text-text-faint">
                            {[...line.options, line.note]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(
                          line.unitPrice * line.quantity,
                          order.data.currencyCode,
                        )}
                      </span>
                    </div>
                  ))}
                </Section>
              );
            })}

            <div className="flex flex-col gap-sm border-t border-border pt-lg text-[14px]">
              <Money
                label={t("orders.subtotal")}
                value={order.data.subtotal}
                code={order.data.currencyCode}
              />
              <Money
                label={t("orders.delivery")}
                value={order.data.deliveryFee}
                code={order.data.currencyCode}
              />
              {order.data.discount > 0 && (
                <Money
                  label={t("orders.discount")}
                  value={-order.data.discount}
                  code={order.data.currencyCode}
                />
              )}
              <div className="flex justify-between pt-xs text-[16px] font-bold">
                <span>{t("orders.total")}</span>
                <span className="tabular-nums">
                  {formatMoney(order.data.total, order.data.currencyCode)}
                </span>
              </div>
            </div>
          </div>

          {/*
            Forward is one button per shop and names the step. Cancel keeps a
            real confirmation, and it is the only action here that does: it is
            terminal — `api_v1_set_order_status` refuses to move off it — so
            there is no undo to offer, and undo is what every other move gets.
          */}
          <div className="flex shrink-0 flex-col gap-sm border-t border-border p-xxl">
            {order.data.stores.map((store) => {
              const next = nextStatus(statuses.data, store.statusSlug);
              if (!next) return null;
              const tone = statusTone(next.slug);
              return (
                <div key={store.id} className="flex items-center gap-sm">
                  <Button
                    fullWidth
                    style={{ background: tone.fill, color: tone.onFill }}
                    onClick={() =>
                      advance({
                        orderStoreId: store.id,
                        fromSlug: store.statusSlug,
                        toSlug: next.slug,
                        toName: next.name,
                        undoable: next.progress !== null,
                      })
                    }
                  >
                    {order.data.stores.length > 1
                      ? `${next.name} · ${store.storeName}`
                      : next.name}
                  </Button>

                  {cancelled && (
                    <ConfirmButton
                      onConfirm={() =>
                        advance({
                          orderStoreId: store.id,
                          fromSlug: store.statusSlug,
                          toSlug: cancelled.slug,
                          toName: cancelled.name,
                          undoable: false,
                        })
                      }
                      titleKey="orders.cancelTitle"
                      bodyKey="orders.cancelBody"
                      confirmKey="orders.cancelConfirm"
                      variant="danger"
                    >
                      {t("orders.cancel")}
                    </ConfirmButton>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-sm">
      <div className="flex items-center gap-md">
        <h3 className="flex-grow text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

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
    <div className="flex justify-between text-text-soft">
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value, code)}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div aria-hidden className={cx("flex flex-col gap-lg p-xxl")}>
      <div className="h-[24px] w-[180px] rounded-sm bg-neutral-fill" />
      <div className="h-[14px] w-[120px] rounded-sm bg-neutral-fill" />
      <div className="mt-lg h-[60px] rounded-md bg-neutral-fill" />
      <div className="h-[90px] rounded-md bg-neutral-fill" />
    </div>
  );
}
