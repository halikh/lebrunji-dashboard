"use client";

import Link from "next/link";

import { Button } from "@/components/ui";
import { Copyable } from "@/components/ui/copyable";
import { Panel } from "@/components/ui/panel";
import { t } from "@/i18n/translations";
import { useClock } from "@/features/settings/use-clock";

import { OrderActions, OrderBody, PanelSkeleton } from "./order-detail";
import { StatusPill } from "./status-pill";
import { orderStatus, useOrder, useOrderStatuses } from "./use-orders";

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
  docked = false,
  opened = orderId !== null,
  onClose,
}: {
  /** The order to show — on the queue, the selected one or the first. */
  orderId: string | null;
  /**
   * The queue's mode: on a wide screen the panel is always there and has no
   * close. Elsewhere (a customer's profile) it is opened over the screen and
   * closed again, as before.
   */
  docked?: boolean;
  /**
   * Whether the operator picked it. When docked this only decides the phone
   * overlay, which has to be dismissable or the queue underneath could never
   * be reached.
   */
  opened?: boolean;
  onClose: () => void;
}) {
  const clock = useClock();
  const statuses = useOrderStatuses();
  const order = useOrder(orderId);
  const status = order.data ? orderStatus(order.data, statuses) : null;

  return (
    <Panel
      docked={docked}
      open={opened}
      onClose={onClose}
      label={t("orders.panelLabel")}
    >
      {/* Nothing in the queue, so nothing to show. Said, rather than left as a
          skeleton that never resolves — a disabled query reads as pending. */}
      {orderId === null && (
        <p className="p-xxl text-[14px] text-text-faint">
          {t("orders.panelEmpty")}
        </p>
      )}

      {orderId !== null && order.isPending && <PanelSkeleton />}

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
          <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-lg pb-md pt-lg">
            <div className="flex items-start gap-md">
              <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                {/* Copy only: there is nowhere for a code to go, and it is
                    pasted into messages constantly. Reading sixteen characters
                    back off a screen by hand is where mistakes come from. */}
                <h2 className="flex items-center gap-sm text-[22px]">
                  <Copyable
                    value={order.data.code}
                    label={t("orders.copyCode")}
                  />
                </h2>
                <span className="text-[13px] text-text-faint">
                  {t("orders.placed")} {clock.dayAndTime(order.data.placedAt)}
                </span>
              </div>
              {status && <StatusPill slug={status.slug} name={status.name} />}
              {!docked && (
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
              )}
            </div>

            {/* The ways out, as two quiet chips on one line. They leave the
                screen the operator is working on, which is almost never what
                they want next — but when it is, hunting for it is worse. */}
            <div className="flex flex-wrap items-center gap-sm">
              <Link href={`/orders/${order.data.id}`} className={CHIP}>
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
                  {/* A box with an arrow leaving it — "this goes somewhere
                      else". */}
                  <path d="M14 4h6v6" />
                  <path d="M20 4l-8 8" />
                  <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                </svg>
                {t("orders.openPage")}
              </Link>

              {/* Straight to the history rather than to the page's first tab.
                  Somebody following this link has a question about what
                  happened — landing them on the receipt they were already
                  reading would cost a second click for nothing. */}
              <Link
                href={`/orders/${order.data.id}?tab=history`}
                className={CHIP}
              >
                {/* A clock with its hand turned back — "what has happened to
                    this". */}
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
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M12 8v4l3 2" />
                </svg>
                {t("history.open")}
              </Link>
            </div>
          </div>

          <OrderBody order={order.data} from={"panel"} />
          <OrderActions order={order.data} statuses={statuses} />
        </>
      )}
    </Panel>
  );
}

/** The app's `outline` pill: cream, hairline, soft ink type. */
const CHIP =
  "flex h-[28px] items-center gap-xs rounded-full border border-line bg-cream px-md text-[13px] font-medium text-text-soft hover:bg-neutral-fill hover:text-text";
