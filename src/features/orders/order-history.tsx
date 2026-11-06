"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Flag,
  Pencil,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button, EmptyState, Skeleton, StatusBadge, cx } from "@/components/ui";
import { Price } from "@/features/reference/price";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import { fetchAmendments, fetchHandovers } from "./api/history";
import type { Order, OrderStatus } from "./api/orders";
import { orderKeys, orderStatus } from "./use-orders";

/**
 * Everything that has happened to an order since it was placed, newest first.
 *
 * Read rarely, and almost always because something has gone wrong — a
 * customer disputing a total, an order nobody can find. So it is a tab away
 * from the receipt rather than pushing the money down the page.
 *
 * ## Two records, one column, in time order
 *
 * Amendments and hand-overs are stored apart because they are different facts
 * (see `api/history.ts`) and shown together because the question is a
 * sequence: changed, then sent to Ali, then changed again. Two lists side by
 * side make the reader do the interleaving, which is where the order of events
 * gets remembered wrongly.
 *
 * Status moves are not recorded one by one — the order carries only where it
 * stands — so the timeline opens with that, undated, and says so.
 */
export function OrderHistory({
  order,
  statuses,
}: {
  order: Order;
  statuses: OrderStatus[];
}) {
  const clock = useClock();
  const amendments = useQuery({
    queryKey: orderKeys.amendments(order.id),
    queryFn: () => fetchAmendments(order.id),
  });
  const handovers = useQuery({
    queryKey: orderKeys.handovers(order.id),
    queryFn: () => fetchHandovers(order.id),
  });
  const status = orderStatus(order, statuses);

  const money = (value: number, className?: string) => (
    <Price
      value={value}
      code={order.currencyCode}
      shopRate={order.shopRate}
      className={className}
    />
  );

  type Entry = {
    id: string;
    at: string;
    icon: ReactNode;
    tone: "accent" | "info" | "neutral";
    title: ReactNode;
    body?: ReactNode;
  };

  const events: Entry[] = [
    ...(amendments.data ?? []).map((one): Entry => ({
      id: `a-${one.id}`,
      at: one.createdAt,
      icon: <Pencil />,
      tone: "accent",
      title: t("history.amended"),
      body: (
        <div className="flex flex-col gap-2">
          {/* Both figures, because the question is almost always "the
                customer says it was X" — and one number cannot answer it. */}
          <span className="flex flex-wrap items-baseline gap-2 text-[13.5px]">
            {money(one.previousTotal, "text-ink-3 line-through")}
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 self-center text-ink-4 rtl:rotate-180"
            />
            {money(one.newTotal, "font-semibold text-ink")}
          </span>
          {one.note && (
            <p className="rounded-md border-s-2 border-line-strong bg-subtle px-3 py-2 text-[13px] text-ink-2">
              {one.note}
            </p>
          )}
        </div>
      ),
    })),
    ...(handovers.data ?? []).map((one): Entry => ({
      id: `h-${one.id}`,
      at: one.dispatchedAt,
      icon: <Truck />,
      tone: "info",
      title: (
        <>
          {t("history.handedTo")}{" "}
          <Link
            href={`/drivers/${one.courierId}`}
            className="text-accent hover:underline"
          >
            {one.courierName}
          </Link>
        </>
      ),
      // The driver page's caveat: this is where somebody works out who had
      // an order that went missing, and overclaiming is worse than less.
      body: <p className="text-[12.5px] text-ink-3">{t("history.caveat")}</p>,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const loading = amendments.isPending || handovers.isPending;
  const failed = amendments.isError || handovers.isError;

  if (failed) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("history.failed")}
        action={
          <Button
            onClick={() => {
              void amendments.refetch();
              void handovers.refetch();
            }}
          >
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        <Item
          icon={<Flag />}
          tone="neutral"
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t("history.now")}
              {status && <StatusBadge slug={status.slug} />}
            </span>
          }
          when={null}
          body={
            <p className="text-[12.5px] text-ink-3">
              {t("history.statusNote")}
            </p>
          }
        />

        {loading
          ? [0, 1].map((row) => (
              <li key={row} className="flex gap-3.5 pb-6" aria-hidden>
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </li>
            ))
          : events.map((entry) => (
              <Item
                key={entry.id}
                icon={entry.icon}
                tone={entry.tone}
                title={entry.title}
                when={clock.dayAndTime(entry.at)}
                body={entry.body}
              />
            ))}

        <Item
          icon={<ShoppingBag />}
          tone="neutral"
          title={t("history.placed")}
          when={clock.dayAndTime(order.placedAt)}
          body={
            <p className="text-[13px] text-ink-3">
              {t("history.placedBy", {
                name: order.customerName || t("orders.incompleteSignup"),
              })}
            </p>
          }
          last
        />
      </ol>

      {!loading && events.length === 0 && (
        <p className="rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-3">
          {t("history.nothing")}
        </p>
      )}
    </div>
  );
}

function Item({
  icon,
  tone,
  title,
  when,
  body,
  last,
}: {
  icon: ReactNode;
  tone: "accent" | "info" | "neutral";
  title: ReactNode;
  when: string | null;
  body?: ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-6 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute start-4 top-9 bottom-1 w-px -translate-x-1/2 bg-line rtl:translate-x-1/2"
        />
      )}
      <span
        aria-hidden
        className={cx(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full border [&_svg]:size-4",
          tone === "accent" && "border-accent/20 bg-accent-soft text-accent",
          tone === "info" && "border-info/20 bg-info-soft text-info",
          tone === "neutral" && "border-line bg-surface text-ink-3",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-[14px] font-medium text-ink">{title}</p>
          {when && (
            <time className="text-[12.5px] text-ink-3 tabular-nums">
              {when}
            </time>
          )}
        </div>
        {body}
      </div>
    </li>
  );
}
