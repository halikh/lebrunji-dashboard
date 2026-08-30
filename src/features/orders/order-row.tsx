"use client";

import { Button, cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { formatMoney } from "@/lib/money";
import { statusTone } from "@/lib/order-status";
import { formatRelative } from "@/lib/time";

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
          {formatRelative(order.placedAt)}
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
        {order.stores.map((store) => {
          const tone = statusTone(store.statusSlug);
          return (
            <span
              key={store.id}
              className="flex items-center gap-sm text-[13px] text-text-soft"
            >
              <span
                aria-hidden
                className="size-[7px] shrink-0 rounded-full"
                style={{ background: tone.dot }}
              />
              <span className="truncate">{store.storeName}</span>
              <span className="font-semibold" style={{ color: tone.ink }}>
                {store.statusName}
              </span>
            </span>
          );
        })}
      </div>

      <span className="w-[130px] shrink-0 text-right text-[15px] font-bold tabular-nums">
        {formatMoney(order.total, order.currencyCode)}
      </span>

      <div className="flex w-[150px] shrink-0 flex-col items-stretch gap-xs">
        {order.stores.map((store) => {
          const next = nextStatus(statuses, store.statusSlug);
          if (!next) return null;
          // The colour of the step being moved *to*, not the one being left:
          // the button is a promise about what happens next, and an operator
          // working quickly learns the colour of the action.
          //
          // Inline rather than a class because the slug set is not known at
          // build time — see `lib/order-status.ts`.
          const tone = statusTone(next.slug);
          return (
            <Button
              key={store.id}
              size="sm"
              style={{ background: tone.fill, color: tone.onFill }}
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
