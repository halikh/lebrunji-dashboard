"use client";

import Link from "next/link";

import { Button } from "@/components/ui";
import { Copyable } from "@/components/ui/copyable";
import { Panel } from "@/components/ui/panel";
import { t } from "@/i18n/translations";
import { formatDayAndTime } from "@/lib/time";

import { OrderActions, OrderBody, PanelSkeleton } from "./order-detail";
import { useOrder, useOrderStatuses } from "./use-orders";

/**
 * The receipt, opened beside the queue.
 *
 * The queue carries what is needed to *triage*; this carries what is needed to
 * *act* — the number to ring, the note the courier has to read, the pictures to
 * check a bag against, and where the door is.
 *
 * It never replaces the queue. Advancing must not cost the operator their place
 * in the list, which is the whole reason this is a panel and not a page.
 *
 * ## And there is also a page
 *
 * `/orders/<id>` renders the same receipt with room around it. The panel is for
 * working *through* orders; the page is for sending one to somebody, opening it
 * in a second tab, or reading it without a list moving beside it. The link at
 * the top is how you get from one to the other — small and quiet, because it is
 * a way out of the thing you are already doing rather than the thing to do.
 *
 * Both render `OrderBody` and `OrderActions`, so a field added to the receipt
 * cannot appear in one and not the other.
 */
export function OrderPanel({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const statuses = useOrderStatuses();
  const order = useOrder(orderId);

  return (
    <Panel
      open={orderId !== null}
      onClose={onClose}
      label={t("orders.panelLabel")}
    >
      {order.isPending && <PanelSkeleton />}

      {order.isError && (
        <div className="flex flex-col gap-lg p-xxl">
          <p role="alert" className="text-[14px] font-medium text-danger">
            {t("orders.detailFailed")}
          </p>
          <Button variant="secondary" onClick={() => void order.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {order.isSuccess && (
        <>
          <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
            <div className="flex flex-grow flex-col gap-xxs">
              {/* Copy only: there is nowhere for a code to go, and it is pasted
                  into messages constantly. Reading sixteen characters back off
                  a screen by hand is where mistakes come from. */}
              <h2 className="flex items-center gap-sm text-[20px]">
                <Copyable
                  value={order.data.code}
                  label={t("orders.copyCode")}
                />
              </h2>
              <span className="text-[13px] text-text-faint">
                {t("orders.placed")} {formatDayAndTime(order.data.placedAt)}
              </span>

              {/* The way out to the full page. Quiet and small: it leaves the
                  screen the operator is working on, which is almost never what
                  they want next — but when it is, hunting for it is worse. */}
              <Link
                href={`/orders/${order.data.id}`}
                className="flex w-fit items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {/* A box with an arrow leaving it — the conventional mark for
                      "this goes somewhere else", which is precisely what
                      distinguishes it from every other link on the panel. */}
                  <path d="M14 4h6v6" />
                  <path d="M20 4l-8 8" />
                  <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                </svg>
                {t("orders.openPage")}
              </Link>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft lg:flex"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <OrderBody order={order.data} from={"panel"} />
          <OrderActions order={order.data} statuses={statuses.data} />
        </>
      )}
    </Panel>
  );
}
