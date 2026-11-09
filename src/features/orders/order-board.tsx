"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, Skeleton, cx } from "@/components/ui";
import { useMoney } from "@/features/reference/use-currencies";
import { t, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";

import {
  isWaitingOnDriver,
  placesLine,
  type Order,
  type OrderStatus,
} from "./api/orders";
import { OrderAge, urgencyOf } from "./order-age";
import { nextStatus, orderStatus, useOrders } from "./use-orders";

const EMPTY: Record<string, TranslationKey> = {
  ordered: "orders.boardEmptyOrdered",
  confirmed: "orders.boardEmptyConfirmed",
  atStore: "orders.boardEmptyAtStore",
  toCustomer: "orders.boardEmptyToCustomer",
};

/**
 * Every live step side by side — Placed, Confirmed, At the store, Heading to
 * the customer — the way
 * Deliveroo's Restaurant Hub and DoorDash's order manager lay out the day.
 *
 * Tabs hide work: an operator sitting on Placed does not see the confirmed
 * order that has been waiting twenty minutes for a driver. A board puts the
 * whole pipeline on one screen, so the stuck card is visible wherever it is.
 * Each column is oldest first — the card at the top is the one to do next.
 *
 * Only for live orders. Delivered and cancelled grow forever and would turn
 * the board into an archive; the list is for those, and for search.
 */
export function OrderBoard({
  statuses,
  counts,
  search,
  now,
  openOrderId,
  onOpen,
  onAdvance,
  onMove,
}: {
  statuses: OrderStatus[];
  counts: Record<string, number> | undefined;
  search: string;
  now: number;
  openOrderId: string | null;
  onOpen: (order: Order) => void;
  onAdvance: (order: Order) => void;
  /** A card dropped on another column. Only ever one step either way. */
  onMove: (order: Order, from: OrderStatus, to: OrderStatus) => void;
}) {
  const columns = statuses.filter(
    (status) => status.slug in EMPTY && status.progress !== null,
  );
  // The card in the air, and where it came from. Only the neighbouring
  // columns accept it: one step on is the button, one step back is Undo, and
  // a jump across a step is not a move the queue offers anywhere else.
  const [dragging, setDragging] = useState<DragData | null>(null);
  const targets = useMemo(() => {
    if (!dragging) return new Set<string>();
    const at = columns.findIndex((one) => one.slug === dragging.from.slug);
    return new Set(
      [columns[at - 1], columns[at + 1]]
        .filter((one): one is OrderStatus => one !== undefined)
        .map((one) => one.slug),
    );
  }, [columns, dragging]);

  // A drag starts only once the pointer has really moved (or, on a touch
  // screen, after a short press), so a click still opens the card and a
  // swipe still scrolls the column.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );
  const { format } = useMoney();

  function start(event: DragStartEvent) {
    setDragging((event.active.data.current as DragData | undefined) ?? null);
  }

  function end(event: DragEndEvent) {
    const to = columns.find((one) => one.slug === event.over?.id);
    if (dragging && to && targets.has(to.slug)) {
      onMove(dragging.order, dragging.from, to);
    }
    setDragging(null);
  }

  return (
    <DndContext
      id="order-board"
      sensors={sensors}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto p-3 scrollbar-thin sm:p-4 md:snap-none">
        {columns.map((status) => (
          <Column
            key={status.slug}
            status={status}
            statuses={statuses}
            count={counts?.[status.slug]}
            search={search}
            now={now}
            openOrderId={openOrderId}
            onOpen={onOpen}
            onAdvance={onAdvance}
            dragging={dragging !== null}
            accepts={targets.has(status.slug)}
            draggingId={dragging?.order.id ?? null}
          />
        ))}
      </div>
      {/* The card that follows the pointer: solid, full size, lifted. Drawn
          by the page, not the browser, whose drag image is always faded. */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {dragging && (
          <CardFace
            order={dragging.order}
            statuses={statuses}
            now={now}
            money={format}
            floating
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

type DragData = { order: Order; from: OrderStatus };

function Column({
  status,
  statuses,
  count,
  search,
  now,
  openOrderId,
  onOpen,
  onAdvance,
  dragging,
  accepts,
  draggingId,
}: {
  status: OrderStatus;
  statuses: OrderStatus[];
  count: number | undefined;
  search: string;
  now: number;
  openOrderId: string | null;
  onOpen: (order: Order) => void;
  onAdvance: (order: Order) => void;
  dragging: boolean;
  accepts: boolean;
  draggingId: string | null;
}) {
  const orders = useOrders("live", status.slug, search);
  const { setNodeRef, isOver } = useDroppable({
    id: status.slug,
    disabled: !accepts,
  });
  const over = isOver && accepts;
  const { format } = useMoney();

  // A live column is bounded by what is still in play, so it is read to the
  // end: oldest first is only true once the oldest has arrived.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = orders;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const cards = useMemo(
    () =>
      (orders.data?.pages.flatMap((page) => page.orders) ?? [])
        .slice()
        .sort((a, b) => a.placedAt.localeCompare(b.placedAt)),
    [orders.data],
  );
  const late = cards.filter(
    (order) =>
      urgencyOf(orderStatus(order, statuses)?.slug, order.placedAt, now) ===
      "late",
  ).length;
  const tone = statusTone(status.slug);

  return (
    <section
      aria-label={status.name}
      ref={setNodeRef}
      className={cx(
        "flex w-[85vw] max-w-[380px] min-w-[260px] shrink-0 snap-start flex-col rounded-lg border bg-subtle transition-[border-color,background-color,opacity] md:w-auto md:max-w-none md:flex-1",
        !dragging && "border-line",
        dragging && accepts && !over && "border-dashed border-accent/60",
        dragging && accepts && over && "border-accent bg-accent-soft",
        dragging && !accepts && "border-line opacity-60",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: tone.dot }}
        />
        <h2 className="text-[13.5px] font-semibold text-ink">{status.name}</h2>
        {count !== undefined && (
          <span className="text-[13px] text-ink-3 tabular-nums">
            {t("orders.columnCount", { count })}
          </span>
        )}
        {late > 0 && (
          <Badge tone="danger" className="ms-auto">
            {t("orders.lateCount", { count: late })}
          </Badge>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
        {orders.isPending && (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-[116px] w-full rounded-lg" />
            ))}
          </div>
        )}

        {orders.isError && (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <AlertCircle aria-hidden className="size-5 text-ink-4" />
            <p className="text-[13px] text-ink-3">{t("orders.boardFailed")}</p>
            <Button size="sm" onClick={() => void orders.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {orders.isSuccess && cards.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-ink-4">
            {t(EMPTY[status.slug] ?? "orders.emptyTitle")}
          </p>
        )}

        {cards.length > 0 && (
          <ul className="flex flex-col gap-2">
            {cards.map((order) => (
              <Card
                key={order.id}
                order={order}
                statuses={statuses}
                now={now}
                money={format}
                selected={order.id === openOrderId}
                onOpen={() => onOpen(order)}
                onAdvance={() => onAdvance(order)}
                from={status}
                lifted={order.id === draggingId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Card({
  order,
  statuses,
  now,
  money,
  selected,
  onOpen,
  onAdvance,
  from,
  lifted,
}: {
  order: Order;
  statuses: OrderStatus[];
  now: number;
  money: (minorUnits: number, code: string) => string;
  selected: boolean;
  onOpen: () => void;
  onAdvance: () => void;
  from: OrderStatus;
  /** This card is the one in the air; its place shows as an empty slot. */
  lifted: boolean;
}) {
  const { setNodeRef, listeners } = useDraggable({
    id: order.id,
    data: { order, from } satisfies DragData,
  });

  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <li
      ref={(node) => {
        ref.current = node;
        setNodeRef(node);
      }}
      {...listeners}
      className={cx(
        "relative cursor-grab touch-manipulation active:cursor-grabbing",
      )}
    >
      {/* While it is in the air, its place is an empty slot of the same
          size — nothing faded left behind, and the column does not jump. */}
      <div className={cx(lifted && "invisible")}>
        <CardFace
          order={order}
          statuses={statuses}
          now={now}
          money={money}
          selected={selected}
          onOpen={onOpen}
          onAdvance={onAdvance}
        />
      </div>
      {lifted && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-lg border-2 border-dashed border-line-strong bg-subtle"
        />
      )}
    </li>
  );
}

/** What a card shows: in its column, and as the one following the pointer. */
function CardFace({
  order,
  statuses,
  now,
  money,
  selected = false,
  floating = false,
  onOpen,
  onAdvance,
}: {
  order: Order;
  statuses: OrderStatus[];
  now: number;
  money: (minorUnits: number, code: string) => string;
  selected?: boolean;
  /** Drawn under the pointer while dragged: lifted, slightly tilted. */
  floating?: boolean;
  onOpen?: () => void;
  onAdvance?: () => void;
}) {
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;
  const late = urgencyOf(status?.slug, order.placedAt, now) === "late";

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-lg border bg-surface transition-[border-color]",
        floating
          ? "rotate-[1.5deg] cursor-grabbing border-accent shadow-lg ring-1 ring-accent/30"
          : "shadow-xs",
        !floating &&
          (selected
            ? "border-accent ring-1 ring-accent"
            : late
              ? "border-danger/40"
              : "border-line hover:border-line-strong"),
      )}
    >
      {late && !selected && (
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 w-[3px] bg-danger"
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        tabIndex={floating ? -1 : undefined}
        aria-current={selected || undefined}
        className="flex w-full flex-col gap-1 px-3 pt-2.5 pb-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-ink tabular-nums">
            {order.code}
          </span>
          <OrderAge
            placedAt={order.placedAt}
            slug={status?.slug}
            now={now}
            icon
            className="text-[12.5px]"
          />
        </span>
        <span
          className={cx(
            "truncate text-[13.5px]",
            order.customerName ? "font-medium text-ink" : "text-ink-4 italic",
          )}
        >
          {order.customerName || t("orders.incompleteSignup")}
        </span>
        <span className="truncate text-[12.5px] text-ink-3">
          {placesLine(order.stores)}
        </span>
        <span className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[13.5px] font-semibold text-ink tabular-nums">
            {money(order.total, order.currencyCode)}
          </span>
          {order.amendedAt && (
            <Badge tone="info" className="h-[18px] px-1.5 text-[11px]">
              {t("orders.amendedBadge")}
            </Badge>
          )}
        </span>
        {isWaitingOnDriver(order) && (
          <span className="truncate text-[12.5px] font-medium text-status-to-customer-ink">
            {order.driverName
              ? t("orders.withDriver", { name: order.driverName })
              : t("orders.withADriver")}
          </span>
        )}
      </button>
      {next && (
        <div className="px-3 pb-3">
          <Button
            size="sm"
            variant={status?.slug === "ordered" ? "primary" : "secondary"}
            className="w-full"
            tabIndex={floating ? -1 : undefined}
            onClick={onAdvance}
          >
            {next.name}
          </Button>
        </div>
      )}
    </div>
  );
}
