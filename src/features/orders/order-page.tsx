"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Button,
  Copyable,
  DescriptionList,
  EmptyState,
  Page,
  PageHeader,
  Section,
  Skeleton,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { Price } from "@/features/reference/price";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { isFinishedSlug } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";

import { fetchAmendments, fetchHandovers } from "./api/history";
import { placeName, type OrderStatus } from "./api/orders";
import { OrderAge, useTick } from "./order-age";
import { OrderActions, OrderBody, type OrderWithLines } from "./order-detail";
import { OrderHistory } from "./order-history";
import {
  orderKeys,
  orderStatus,
  useOrder,
  useOrderStatuses,
} from "./use-orders";

type TabKey = "receipt" | "history";

/**
 * One order, on its own page.
 *
 * The queue's panel is for working *through* orders without losing your
 * place. This is for what a panel cannot do: a link somebody can send, a
 * second browser tab, and room to read a bag's worth of lines back to a
 * customer. The receipt is `OrderBody` and `OrderActions`, shared with the
 * panel, so the two cannot drift.
 *
 * A page reached from a link carries none of the queue's context, so the
 * header says where the order stands before anything else.
 */
export function OrderPage({ id }: { id: string }) {
  const clock = useClock();
  const now = useTick();
  const statuses = useOrderStatuses();
  const order = useOrder(id);

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // In the URL, so a link can point straight at the history.
  const tab: TabKey = params.get("tab") === "history" ? "history" : "receipt";

  function show(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "receipt") query.delete("tab");
    else query.set("tab", next);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  // The same keys the history tab reads, so the count costs nothing extra.
  const amendments = useQuery({
    queryKey: orderKeys.amendments(id),
    queryFn: () => fetchAmendments(id),
  });
  const handovers = useQuery({
    queryKey: orderKeys.handovers(id),
    queryFn: () => fetchHandovers(id),
  });
  const eventCount =
    amendments.data && handovers.data
      ? amendments.data.length + handovers.data.length
      : null;

  if (order.isPending) {
    return (
      <Page>
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <Skeleton className="hidden h-64 w-full rounded-lg lg:block" />
        </div>
      </Page>
    );
  }

  if (order.isError || !order.data) {
    return (
      <Page>
        <PageHeader title={t("orders.title")} />
        <EmptyState
          icon={<AlertCircle />}
          title={t("orders.detailFailed")}
          description={t("orders.detailFailedBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => void order.refetch()}>
                {t("common.retry")}
              </Button>
              <Button asChild>
                <Link href="/orders">{t("orders.backToQueue")}</Link>
              </Button>
            </div>
          }
        />
      </Page>
    );
  }

  const data = order.data;
  const status = orderStatus(data, statuses);

  return (
    <Page>
      <PageHeader
        title={
          <Copyable
            value={data.code}
            label={t("orders.copyCode")}
            className="tabular-nums"
          />
        }
        meta={status && <StatusBadge slug={status.slug} />}
        description={
          <>
            {t("orders.placed")} {clock.dayAndTime(data.placedAt)}
            {status && !isFinishedSlug(status.slug) && (
              <>
                {", "}
                <OrderAge
                  placedAt={data.placedAt}
                  slug={status.slug}
                  now={now}
                />
              </>
            )}
            {data.amendedAt && (
              <>
                {", "}
                {t("orders.changedAt", {
                  when: clock.dayAndTime(data.amendedAt),
                })}
              </>
            )}
          </>
        }
      />

      <Tabs
        items={[
          { key: "receipt", label: t("history.tabReceipt") },
          {
            key: "history",
            label: t("history.tabHistory"),
            count: eventCount || null,
          },
        ]}
        value={tab}
        onChange={show}
        className="-mt-2"
      />

      {/* Siblings rather than one swapped child, so a half-read receipt
          survives a look at the history and back. */}
      <div
        className={
          tab === "receipt"
            ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
            : "hidden"
        }
      >
        <div className="flex min-w-0 flex-col">
          <OrderBody order={data} from="page" flush />
        </div>
        <Aside order={data} statuses={statuses} />
      </div>

      <div className={tab === "history" ? undefined : "hidden"}>
        <Section
          title={t("history.title")}
          description={t("history.description")}
        >
          <OrderHistory order={data} statuses={statuses} />
        </Section>
      </div>
    </Page>
  );
}

/**
 * The right-hand column on a wide screen: what to do next, then the order
 * at a glance. On a phone it comes first, so the next step is not a
 * receipt's length of scrolling away; the glance is left to the receipt.
 */
function Aside({
  order: one,
  statuses,
}: {
  order: OrderWithLines;
  statuses: OrderStatus[];
}) {
  const phone = one.customerPhone ? formatPhone(one.customerPhone) : null;
  return (
    <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-0 lg:order-none">
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs empty:hidden [&>div]:border-t-0">
        <OrderActions order={one} statuses={statuses} />
      </div>

      <Section
        title={t("orders.atAGlance")}
        className="hidden lg:block"
        bodyClassName="p-4"
      >
        <DescriptionList
          className="grid-cols-[minmax(0,6.5rem)_1fr]"
          items={[
            {
              label: t("orders.customer"),
              value: (
                <Link
                  href={`/customers/${one.customerId}?fromOrder=${one.id}&code=${encodeURIComponent(one.code)}`}
                  className="font-medium text-ink hover:text-accent hover:underline"
                >
                  {one.customerName || t("orders.incompleteSignup")}
                </Link>
              ),
            },
            {
              label: t("orders.phone"),
              value: phone ? (
                <Copyable
                  value={phone}
                  href={`tel:${phone}`}
                  label={t("orders.copyPhone")}
                  className="tabular-nums"
                />
              ) : (
                <span className="text-ink-4">{t("orders.noPhone")}</span>
              ),
            },
            {
              label: t("orders.deliveringTo"),
              value: one.addressLine,
            },
            {
              label: t("orders.shops"),
              value: one.stores.map((store) => placeName(store)).join(", "),
            },
            {
              label: t("orders.total"),
              value: (
                <Price
                  value={one.total}
                  code={one.currencyCode}
                  shopRate={one.shopRate}
                  className="font-semibold"
                />
              ),
            },
          ]}
        />
      </Section>
    </aside>
  );
}
