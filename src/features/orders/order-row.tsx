"use client";

import { Button, cx } from "@/components/ui";
import { ROW } from "@/components/ui/row";
import { t } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { formatRelative } from "@/lib/time";

import type { Order, OrderStatus } from "./api/orders";
import { nextStatus, orderStatus } from "./use-orders";

/**
 * One order in the queue.
 *
 * ## The order is the unit, not the shop
 *
 * A customer who orders from two shops places one order — one status, one wait,
 * one courier run. So there is **one status and one button**, however many
 * shops are on it. The shops are still named, because the operator has to know
 * who to ring, but they are information rather than separate controls.
 *
 * The status shown is the least advanced portion that can still move: an order
 * is not confirmed until every shop has confirmed it.
 *
 * ## The primary button names the next step
 *
 * Not "Advance", and not a dropdown. The common case is always forward, and
 * nobody should open a menu to pick the only sensible answer — so it reads
 * "Confirm", then "Send driver", then "Delivered", in the colour of the step it
 * moves to.
 */
export function OrderRow({
  order,
  statuses,
  focused,
  money,
  onAdvance,
  onOpen,
}: {
  order: Order;
  statuses: OrderStatus[] | undefined;
  focused: boolean;
  money: (minorUnits: number, code: string) => string;
  onAdvance: (to: OrderStatus) => void;
  onOpen: () => void;
}) {
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;
  const tone = statusTone(status?.slug ?? "");

  return (
    <div
      // A row is not a button — it holds one. `article` with a label keeps it
      // navigable without claiming to be a control.
      role="article"
      aria-label={order.code}
      onClick={onOpen}
      className={cx(
        // Stated here rather than covered by the global rule: this is a `div`
        // that happens to be clickable, not a control. The rule deliberately
        // does not reach for arbitrary elements — a pointer on everything with
        // an `onClick` would put one on half the page.
        ROW,
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

      <div className="flex w-[180px] shrink-0 flex-col gap-xxs">
        {order.customerName ? (
          <span className="text-[14px] font-semibold">
            {order.customerName}
          </span>
        ) : (
          // An empty name is the app's "setup not finished" flag, not missing
          // data. Blank would read as a fault in the dashboard.
          <span className="text-[14px] font-semibold italic text-text-faint">
            {t("orders.incompleteSignup")}
          </span>
        )}
        <span className="truncate text-[12px] text-text-faint">
          {order.addressLine}
        </span>
      </div>

      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <span className="flex items-center gap-sm text-[13px]">
          <span
            aria-hidden
            className="size-[7px] shrink-0 rounded-full"
            style={{ background: tone.dot }}
          />
          <span className="font-semibold" style={{ color: tone.ink }}>
            {status?.name ?? ""}
          </span>
        </span>
        {/* The shops, as information. One order, however many of them. */}
        <span className="truncate text-[12px] text-text-faint">
          {order.stores.map((store) => store.storeName).join(" · ")}
        </span>
      </div>

      <span className="w-[130px] shrink-0 text-right text-[15px] font-bold tabular-nums">
        {money(order.total, order.currencyCode)}
      </span>

      <div className="w-[150px] shrink-0">
        {next && (
          <Button
            fullWidth
            size="sm"
            // The colour of the step being moved *to*: the button is a promise
            // about what happens next, and an operator working quickly learns
            // the colour of the action rather than reading every button.
            style={{
              background: statusTone(next.slug).fill,
              color: statusTone(next.slug).onFill,
            }}
            onClick={(event) => {
              // The row opens the panel; the button only advances. Without
              // this, advancing also opens the detail of an order that has just
              // left the tab.
              event.stopPropagation();
              onAdvance(next);
            }}
          >
            {next.name}
          </Button>
        )}
      </div>
    </div>
  );
}
