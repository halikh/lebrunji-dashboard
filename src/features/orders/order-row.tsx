"use client";

import { Button, cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { formatMoney } from "@/lib/money";

import type { Order, OrderStatus } from "./api/orders";
import { nextStatus } from "./use-orders";

/**
 * One order in the queue.
 *
 * ## The primary button names the next step
 *
 * Not "Advance", and not a dropdown. The common case is always forward, and the
 * operator should never open a menu to pick the only sensible answer — so the
 * button reads "Confirm", then "Send driver", then "Delivered". The full list
 * stays reachable for the uncommon jump.
 *
 * ## A two-shop order has two of everything
 *
 * The status lives on `order_stores`, so an order spanning two shops has two
 * statuses and two buttons, advanced independently. Collapsing them into one
 * would be a lie about what the schema can express, and the operator does have
 * to deal with each shop separately.
 */
export function OrderRow({
  order,
  statuses,
  focused,
  onAdvance,
  onOpen,
}: {
  order: Order;
  statuses: OrderStatus[] | undefined;
  focused: boolean;
  onAdvance: (input: {
    store: Order["stores"][number];
    to: OrderStatus;
  }) => void;
  onOpen: () => void;
}) {
  return (
    <div
      // A row is not a button — it holds buttons. `article` with a label keeps
      // it navigable without claiming it is a control.
      role="article"
      aria-label={order.code}
      onClick={onOpen}
      className={cx(
        "flex cursor-pointer items-center gap-lg rounded-md border bg-surface px-lg py-md",
        focused
          ? "border-active shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]"
          : "border-border",
      )}
    >
      <div className="flex w-[150px] shrink-0 flex-col gap-xxs">
        <span className="text-[15px] font-bold tabular-nums">{order.code}</span>
        <span className="text-[12px] text-text-faint">
          {relativeTime(order.placedAt)}
        </span>
      </div>

      <div className="flex w-[190px] shrink-0 flex-col gap-xxs">
        {order.customerName ? (
          <span className="text-[14px] font-semibold">
            {order.customerName}
          </span>
        ) : (
          // An empty name is the app's "setup not finished" flag, not missing
          // data. Rendering it blank would read as a fault in the dashboard.
          <span className="text-[14px] font-semibold italic text-text-faint">
            {t("orders.incompleteSignup")}
          </span>
        )}
        <span className="truncate text-[12px] text-text-faint">
          {order.addressLine}
        </span>
      </div>

      <div className="flex flex-grow flex-col gap-xs">
        {order.stores.map((store) => (
          <span
            key={store.id}
            className="flex items-center gap-sm text-[13px] text-text-soft"
          >
            <span
              aria-hidden
              className="size-[7px] rounded-full"
              style={{ background: statusColour(store.statusSlug) }}
            />
            {store.storeName} · {store.statusName}
          </span>
        ))}
      </div>

      <span className="w-[130px] shrink-0 text-right text-[15px] font-bold tabular-nums">
        {formatMoney(order.total, order.currencyCode)}
      </span>

      <div className="flex w-[150px] shrink-0 flex-col items-stretch gap-xs">
        {order.stores.map((store) => {
          const next = nextStatus(statuses, store.statusSlug);
          if (!next) return null;
          return (
            <Button
              key={store.id}
              size="sm"
              onClick={(event) => {
                // The row opens the panel; the button only advances. Without
                // this, advancing also opens the detail of the order that just
                // left the tab.
                event.stopPropagation();
                onAdvance({ store, to: next });
              }}
            >
              {next.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Status colour, from the palette's status ramp.
 *
 * `order_statuses` is a lookup table a merchant may add to, so an unknown slug
 * has to render as something — `unknown` rather than transparent, which would
 * read as a missing dot rather than a step nobody has given a colour yet.
 */
function statusColour(slug: string): string {
  const known: Record<string, string> = {
    ordered: "var(--color-status-ordered)",
    confirmed: "var(--color-status-confirmed)",
    driverSent: "var(--color-status-driver-sent)",
    delivered: "var(--color-status-delivered)",
    cancelled: "var(--color-status-cancelled)",
  };
  return known[slug] ?? "var(--color-status-unknown)";
}

/**
 * "2 minutes ago".
 *
 * `Intl.RelativeTimeFormat` rather than a hand-rolled ladder, so it is one
 * string per language rather than five, and so the second language does not
 * arrive needing plural rules written by hand.
 */
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return relative.format(Math.round(seconds), "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}
