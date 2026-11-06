"use client";

import Link from "next/link";
import { AlertCircle, Maximize2, PanelRightClose, X } from "lucide-react";

import {
  Button,
  Copyable,
  EmptyState,
  Skeleton,
  StatusBadge,
  Tooltip,
} from "@/components/ui";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { isFinishedSlug } from "@/lib/order-status";

import { OrderAge, useTick } from "./order-age";
import { OrderActions, OrderBody } from "./order-detail";
import { orderStatus, useOrder, useOrderStatuses } from "./use-orders";

/** The open order's receipt, docked beside the queue. */
export function OrderPanel({
  orderId,
  onClose,
  onMoved,
  embedded,
  onCollapse,
}: {
  orderId: string;
  onClose: () => void;
  onMoved?: (toSlug: string) => void;
  /** Folds the docked panel to a strip, keeping the order open. */
  onCollapse?: () => void;
  /** Inside a sheet that already has its own title and close button. */
  embedded?: boolean;
}) {
  const clock = useClock();
  const now = useTick();
  const statuses = useOrderStatuses();
  const order = useOrder(orderId);
  const status = order.data ? orderStatus(order.data, statuses) : null;

  if (order.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6" aria-busy>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (order.isError || !order.data) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("orders.detailFailed")}
        action={
          <Button onClick={() => void order.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const data = order.data;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-ink tabular-nums">
              <Copyable value={data.code} label={t("orders.copyCode")} />
            </h2>
            {status && <StatusBadge slug={status.slug} />}
          </div>
          <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
            <span>
              {t("orders.placed")} {clock.dayAndTime(data.placedAt)}
            </span>
            {status && !isFinishedSlug(status.slug) && (
              <OrderAge
                placedAt={data.placedAt}
                slug={status.slug}
                now={now}
                icon
              />
            )}
          </span>
        </div>
        <Tooltip content={t("orders.openPage")}>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={t("orders.openPage")}
          >
            <Link href={`/orders/${data.id}`}>
              <Maximize2 />
            </Link>
          </Button>
        </Tooltip>
        {onCollapse && (
          <Tooltip content={t("orders.collapsePanel")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("orders.collapsePanel")}
              onClick={onCollapse}
            >
              <PanelRightClose className="rtl:rotate-180" />
            </Button>
          </Tooltip>
        )}
        {!embedded && (
          <Tooltip content={t("common.close")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <X />
            </Button>
          </Tooltip>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas scrollbar-thin">
        <OrderBody order={data} from="panel" />
      </div>

      <OrderActions order={data} statuses={statuses} onMoved={onMoved} />
    </div>
  );
}
