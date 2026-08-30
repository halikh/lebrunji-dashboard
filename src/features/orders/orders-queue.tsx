"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx, Input } from "@/components/ui";
import { t } from "@/i18n/translations";
import { statusTone, type StatusTone } from "@/lib/order-status";

import { OrderRow } from "./order-row";
import { useOrderRealtime } from "./use-order-realtime";
import {
  nextStatus,
  useOrderStatuses,
  useOrders,
  useStatusCounts,
  useAdvanceOrder,
} from "./use-orders";

/**
 * The order queue.
 *
 * The screen the operator lives on, and the one the whole dashboard exists for:
 * before this, an order could be placed and then never advanced by anybody,
 * because `order_stores` had no update policy for any role.
 *
 * ## Four states, not one
 *
 * Loading, failed, empty and full are drawn separately. An empty queue and a
 * queue that failed to load look identical if only one of them is handled, and
 * "no orders" is exactly the wrong thing to tell somebody whose connection just
 * dropped during a rush.
 */
export function OrdersQueue() {
  const [statusSlug, setStatusSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);

  const statuses = useOrderStatuses();
  const counts = useStatusCounts(statuses.data);
  const orders = useOrders(statusSlug, search);
  const { advance } = useAdvanceOrder();

  useOrderRealtime();

  const rows = useMemo(() => orders.data?.orders ?? [], [orders.data]);

  // The focused index has to survive the list changing under it — realtime
  // moves rows in and out constantly, so the stored index can outrun the list.
  //
  // Clamped here rather than corrected in an effect. An effect would set state
  // during a render it was itself triggered by, which cascades a second render
  // for every list change and paints one frame with an out-of-range index. This
  // is a value derived from two things already in hand; it does not need to be
  // stored to be right.
  //
  // Clamping rather than resetting keeps the operator roughly where they were,
  // instead of throwing them to the top each time an order arrives.
  const active = Math.min(focused, Math.max(rows.length - 1, 0));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Never steal a key from something being typed into — `j` in the search
      // box is a letter, not a command.
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        if (event.key === "Escape") target.blur();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocused((current) => Math.min(current + 1, rows.length - 1));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocused((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const order = rows[active];
        if (!order) return;
        // The first shop with somewhere to go. On a single-shop order that is
        // simply "the order"; on a two-shop one it advances the leg that is
        // behind, which is the one holding the delivery up.
        for (const store of order.stores) {
          const next = nextStatus(statuses.data, store.statusSlug);
          if (next) {
            event.preventDefault();
            advance({
              orderStoreId: store.id,
              fromSlug: store.statusSlug,
              toSlug: next.slug,
              toName: next.name,
              undoable: next.progress !== null,
            });
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, active, statuses.data, advance]);

  return (
    <div className="flex h-full flex-col">
      {/*
        `shrink-0` on all three pieces of chrome.

        A flex child defaults to `flex-shrink: 1`, so when the list grows past
        the viewport the browser takes the space back from whatever will give —
        and that was the header and the tab row, which got squeezed to half
        their height and clipped their own text. The scrolling list is the part
        that should absorb the overflow; it already says so with `flex-grow`
        and `overflow-y-auto`, and this is the other half of that statement.
      */}
      <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
        <h1 className="flex-grow text-[24px]">{t("orders.title")}</h1>
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("orders.searchPlaceholder")}
          aria-label={t("orders.searchPlaceholder")}
          className="w-[280px]"
        />
      </div>

      <div
        role="tablist"
        aria-label={t("orders.title")}
        className="flex shrink-0 gap-xxs overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        <Tab
          label={t("orders.all")}
          active={statusSlug === null}
          onClick={() => setStatusSlug(null)}
        />
        {statuses.data?.map((status) => (
          <Tab
            key={status.id}
            label={status.name}
            count={counts.data?.[status.slug]}
            active={statusSlug === status.slug}
            // The tab wears the status's own colour, so the queue's tabs are a
            // legend for the dots in the rows below rather than five identical
            // coral chips.
            tone={statusTone(status.slug)}
            onClick={() => setStatusSlug(status.slug)}
          />
        ))}
      </div>

      {/* The one part that scrolls. `min-h-0` for the same reason as the
          layout's main — without it this grows to its content and the header
          and tabs get squeezed instead. */}
      <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
        {orders.isPending && <Skeleton />}

        {orders.isError && (
          <div className="flex flex-col items-center gap-lg py-huge text-center">
            <div className="flex flex-col gap-xs">
              <h2 className="text-[18px]">{t("orders.failedTitle")}</h2>
              <p className="text-[14px] text-text-soft">
                {t("orders.failedBody")}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void orders.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {orders.isSuccess && rows.length === 0 && (
          <EmptyState
            titleKey={search ? "orders.noMatchTitle" : "orders.emptyTitle"}
            bodyKey={search ? "orders.noMatchBody" : "orders.emptyBody"}
          />
        )}

        {rows.map((order, index) => (
          <OrderRow
            key={order.id}
            order={order}
            statuses={statuses.data}
            focused={index === active}
            onOpen={() => setFocused(index)}
            onAdvance={({ store, to }) =>
              advance({
                orderStoreId: store.id,
                fromSlug: store.statusSlug,
                toSlug: to.slug,
                toName: to.name,
                // A move onto a terminal status cannot be undone — the RPC
                // refuses to come back off `delivered` or `cancelled`, and an
                // undo that fails is worse than no undo offered.
                undoable: to.progress !== null,
              })
            }
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-xl border-t border-border bg-surface px-xxl py-md text-[12px] text-text-faint">
        <Key label="J" /> <Key label="K" /> {t("orders.keyboardMove")}
        <span className="flex items-center gap-sm">
          <Key label="Enter" /> {t("orders.keyboardAdvance")}
        </span>
        <span className="flex items-center gap-sm">
          <Key label="/" /> {t("orders.keyboardSearch")}
        </span>
        <span className="ml-auto flex items-center gap-sm">
          <span aria-hidden className="size-[7px] rounded-full bg-accent" />
          {t("orders.live")}
        </span>
      </div>
    </div>
  );
}

function Tab({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  /** Absent on "All", which is not a status and keeps the app's coral. */
  tone?: StatusTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // A dot on every tab, active or not. Colour alone is not a distinction a
      // colour-blind operator can rely on, and the dot is what ties a tab to
      // the rows beneath it — the tabs are the legend.
      style={
        active && tone ? { background: tone.wash, color: tone.ink } : undefined
      }
      className={cx(
        "flex shrink-0 items-center gap-sm whitespace-nowrap rounded-t-md px-lg py-sm text-[14px] font-semibold",
        active && !tone && "bg-active-wash text-active-ink",
        !active && "text-text-soft hover:bg-neutral-fill",
      )}
    >
      {tone && (
        <span
          aria-hidden
          className="size-[7px] shrink-0 rounded-full"
          style={{ background: tone.dot }}
        />
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cx("tabular-nums", active ? "font-bold" : "font-medium")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function Key({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-border px-xs font-semibold text-text-soft">
      {label}
    </span>
  );
}

/**
 * Rows, not a spinner.
 *
 * A spinner says "something is happening"; this says "orders are coming, and
 * they will be about this shape" — so the layout does not jump when they land,
 * which on a screen somebody is scanning is the difference that matters.
 */
function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-sm">
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="h-[66px] rounded-md border border-border bg-surface opacity-60"
        />
      ))}
    </div>
  );
}
