"use client";

import { useEffect, useRef } from "react";

import { Badge, Button, StatusBadge, cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { placesLine, type Order, type OrderStatus } from "./api/orders";
import { OrderAge, urgencyOf } from "./order-age";
import { nextStatus, orderStatus } from "./use-orders";

/**
 * One order in the queue. Reads left to right in the order the operator asks:
 * which order and how long it has waited, who and where, from which shop, how
 * much — then the one button that moves it on.
 *
 * The waiting time ticks (`now`) and turns amber, then red, as the order
 * outstays its step — see `order-age.tsx`. A red order also gets the red edge,
 * so a long queue can be scanned by colour down its left side.
 */
export function OrderRow({
  order,
  statuses,
  money,
  now,
  selected,
  focused,
  compact,
  onOpen,
  onAdvance,
}: {
  order: Order;
  now: number;
  statuses: OrderStatus[];
  money: (minorUnits: number, code: string) => string;
  selected: boolean;
  focused: boolean;
  /** Narrow column beside the receipt: two lines, no inline button. */
  compact: boolean;
  onOpen: () => void;
  onAdvance: () => void;
}) {
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;
  const waiting = status?.slug === "ordered";
  const late = urgencyOf(status?.slug, order.placedAt, now) === "late";

  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected || focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected, focused]);

  return (
    <li
      ref={ref}
      aria-current={selected || undefined}
      onClick={onOpen}
      className={cx(
        "group relative flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors sm:px-6",
        selected ? "bg-accent-soft/70" : "hover:bg-subtle",
        focused && !selected && "bg-subtle",
      )}
    >
      {(waiting || selected || late) && (
        <span
          aria-hidden
          className={cx(
            "absolute inset-y-0 start-0 w-[3px]",
            selected ? "bg-accent" : late ? "bg-danger" : "bg-status-ordered",
          )}
        />
      )}

      <div className="flex w-[88px] shrink-0 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink tabular-nums">
          {order.code}
        </span>
        <OrderAge
          placedAt={order.placedAt}
          slug={status?.slug}
          now={now}
          className="text-[12px]"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cx(
            "truncate text-[14px]",
            order.customerName ? "font-medium text-ink" : "text-ink-4 italic",
          )}
        >
          {order.customerName || t("orders.incompleteSignup")}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] text-ink-3">
            {compact ? placesLine(order.stores) : order.addressLine}
          </span>
          {order.amendedAt && (
            <Badge tone="info" className="h-[18px] px-1.5 text-[11px]">
              {t("orders.amendedBadge")}
            </Badge>
          )}
        </span>
      </div>

      {!compact && (
        <div className="hidden min-w-0 flex-1 flex-col items-start gap-1 lg:flex">
          {status && <StatusBadge slug={status.slug} />}
          <span className="max-w-full truncate text-[12.5px] text-ink-3">
            {placesLine(order.stores)}
          </span>
        </div>
      )}

      <div
        className={cx(
          "flex shrink-0 flex-col items-end gap-1",
          // Fixed width where the status column shows, so that column starts at
          // the same x on every row whatever the total's length.
          !compact && "lg:w-[128px]",
        )}
      >
        <span className="text-[14px] font-semibold text-ink tabular-nums">
          {money(order.total, order.currencyCode)}
        </span>
        {status && (
          <span className={cx(compact ? "block" : "lg:hidden")}>
            <StatusBadge slug={status.slug} />
          </span>
        )}
      </div>

      {!compact && (
        <div className="hidden w-[132px] shrink-0 justify-end md:flex">
          {next && (
            <Button
              size="sm"
              variant={waiting ? "primary" : "secondary"}
              className="w-full"
              onClick={(event) => {
                event.stopPropagation();
                onAdvance();
              }}
            >
              {next.name}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
