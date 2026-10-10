"use client";

import { Button, cx } from "@/components/ui";
import { t } from "@/i18n/translations";
import { formatRelative } from "@/lib/time";

import type { Order, OrderStatus } from "./api/orders";
import { StatusPill } from "./status-pill";
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
 * ## The button names the next step
 *
 * Not "Advance", and not a dropdown. The common case is always forward, and
 * nobody should open a menu to pick the only sensible answer — so it reads
 * "Confirm", then "Send driver", then "Delivered". It is filled ink only on an
 * order still waiting to be confirmed; see the note on it.
 */
export function OrderRow({
  order,
  statuses,
  focused,
  selected,
  money,
  onAdvance,
  onOpen,
}: {
  order: Order;
  statuses: OrderStatus[] | undefined;
  focused: boolean;
  /** The order the receipt beside the queue is showing. */
  selected: boolean;
  money: (minorUnits: number, code: string) => string;
  onAdvance: (to: OrderStatus) => void;
  onOpen: () => void;
}) {
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;
  // Placed and not yet confirmed: somebody is waiting to hear the shop has
  // it. The one state on the queue that is the operator's to answer now.
  const waiting = status?.slug === "ordered";

  return (
    <div
      // A row is not a button — it holds one. `article` with a label keeps it
      // navigable without claiming to be a control.
      role="article"
      aria-label={order.code}
      aria-current={selected || undefined}
      onClick={onOpen}
      className={cx(
        // The app's order card: white, radius 16, the soft shadow, no border.
        // `cursor-pointer` stated because this is a `div` that happens to be
        // clickable, which the global pointer rule rightly does not cover.
        //
        // A real 2px border on every row, transparent until it means something,
        // so choosing a row never shifts its contents by a pixel. A border and
        // not a box-shadow ring: the hover shadow would replace a ring, and the
        // open order would lose its outline exactly while the pointer is on it.
        "relative flex cursor-pointer items-center gap-lg rounded-lg border-2 bg-surface py-md pl-xl pr-md shadow-card",
        "transition-[box-shadow,border-color] duration-[var(--duration-control)] hover:shadow-selected",
        // Chosen is ink, as it is in the app — the order open in the receipt.
        selected
          ? "border-active shadow-selected"
          : // The keyboard's place, when it is not on the open order.
            focused
            ? "border-line"
            : "border-transparent",
      )}
    >
      {/* A sun edge on an order still waiting to be confirmed — seen from
          across the room, before a word of the row is read. */}
      {waiting && (
        <span
          aria-hidden
          className="absolute inset-y-md left-[7px] w-[4px] rounded-full bg-yellow"
        />
      )}

      <div className="flex w-[132px] shrink-0 flex-col gap-xxs">
        <span className="text-[15px] font-medium tabular-nums">{order.code}</span>
        <span
          className={cx(
            "text-[12px]",
            waiting ? "font-medium text-text" : "text-text-faint",
          )}
        >
          {formatRelative(order.placedAt)}
        </span>
      </div>

      <div className="flex min-w-0 flex-[1.2] flex-col gap-xxs">
        {order.customerName ? (
          <span className="truncate text-[15px] font-medium">
            {order.customerName}
          </span>
        ) : (
          // An empty name is the app's "setup not finished" flag, not missing
          // data. Blank would read as a fault in the dashboard.
          <span className="truncate text-[15px] italic text-text-faint">
            {t("orders.incompleteSignup")}
          </span>
        )}
        <span className="truncate text-[13px] text-text-soft">
          {order.addressLine}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-xs">
        {status && (
          <StatusPill slug={status.slug} name={status.name} size="md" />
        )}
        {/* The shops, as information. One order, however many of them. */}
        <span className="truncate text-[13px] text-text-soft">
          {order.stores.map((store) => store.storeName).join(" · ")}
        </span>
      </div>

      <span className="w-[110px] shrink-0 text-right text-[15px] font-medium tabular-nums">
        {money(order.total, order.currencyCode)}
      </span>

      <div className="w-[140px] shrink-0">
        {next && (
          <Button
            fullWidth
            size="sm"
            // Ink only where the order is waiting on the shop — that is the
            // press the queue exists for, and a column of identical black
            // buttons would make every row shout equally. Everything further
            // along is the app's secondary.
            variant={waiting ? "primary" : "secondary"}
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
