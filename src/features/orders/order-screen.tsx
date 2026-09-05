"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button, cx } from "@/components/ui";
import { Copyable } from "@/components/ui/copyable";
import { useConfirmLeave } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { useClock } from "@/features/settings/use-clock";

import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
import type { TranslationKey } from "@/i18n/translations";

import { OrderActions, OrderBody } from "./order-detail";
import { OrderHistory } from "./order-history";
import { orderStatus, useOrder, useOrderStatuses } from "./use-orders";

/**
 * One order, on its own page.
 *
 * ## What a page is for that a panel is not
 *
 * The panel exists so advancing an order does not cost the operator their place
 * in the queue — that is its whole justification, and it is a good one. But it
 * means the receipt only ever exists *beside* something, and there are three
 * things that needs:
 *
 *   - **a link somebody can send.** "Look at DL-260831-00021" is a URL now.
 *   - **a second tab**, so an order can be kept open while the queue is worked.
 *   - **room.** A 420px column is right for triage and cramped for reading a
 *     bag's worth of lines back to a customer on the phone.
 *
 * The receipt itself is `OrderBody` and `OrderActions`, shared with the panel,
 * so the two cannot drift.
 *
 * ## The status is in the header here
 *
 * On the queue it is on the row, and the panel inherits that context. A page
 * arrived at from a link has none — so the one thing it has to say before
 * anything else is where this order stands.
 */
type TabKey = "details" | "history";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "details", labelKey: "history.tabDetails" },
  { key: "history", labelKey: "history.tabHistory" },
];

export function OrderScreen({ id }: { id: string }) {
  const clock = useClock();
  const statuses = useOrderStatuses();
  const order = useOrder(id);

  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const pathname = usePathname();
  const params = useSearchParams();

  // In the URL, like every other filter in the dashboard, so a link can point
  // straight at the history — which is what the panel's link does.
  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "details";

  /**
   * Switching tabs unmounts whatever is in the current one, so it is a way out
   * of a form even though the URL barely moves. Guarded here rather than on
   * each tab button: there is one `show`.
   */
  function show(next: TabKey) {
    void confirmLeave().then((leave) => {
      if (!leave) return;
      const query = new URLSearchParams(params);
      if (next === "details") query.delete("tab");
      else query.set("tab", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  if (order.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-text-faint">
        {t("common.loading")}
      </div>
    );
  }

  if (order.isError || !order.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-lg text-center">
        <h1 className="text-[18px]">{t("orders.detailFailed")}</h1>
        <div className="flex gap-sm">
          <Button variant="secondary" onClick={() => void order.refetch()}>
            {t("common.retry")}
          </Button>
          <Link href="/">
            <Button variant="secondary">{t("orders.backToQueue")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const status = orderStatus(order.data, statuses.data);
  const tone = status ? statusTone(status.slug) : null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 flex-col gap-md border-b border-border bg-surface px-xxl py-lg">
        {/* Back to the queue **with this order still open**. Returning to a
            bare list would mean hunting for the row again — in a list that has
            moved since, because orders arrive and advance while you read. The
            queue reads `?order=` for exactly this. */}
        <Link
          href={`/?order=${order.data.id}`}
          className="flex w-fit items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {t("orders.backToQueue")}
        </Link>

        <div className="flex flex-wrap items-center gap-lg">
          <div className="flex min-w-0 flex-grow flex-col gap-xxs">
            <h1 className="flex items-center gap-sm text-[24px]">
              <Copyable value={order.data.code} label={t("orders.copyCode")} />
            </h1>
            <span className="text-[13px] text-text-faint">
              {t("orders.placed")} {clock.dayAndTime(order.data.placedAt)}
            </span>
          </div>

          {/* Where it stands, said before anything else. A page reached from a
              link carries none of the context a row in the queue would have
              given. */}
          {status && tone && (
            <span
              style={{ background: tone.wash, color: tone.ink }}
              className={cx(
                "flex shrink-0 items-center gap-sm rounded-sm px-md py-xs",
                "text-[13px] font-semibold",
              )}
            >
              <span
                aria-hidden
                className="size-[8px] shrink-0 rounded-full"
                style={{ background: tone.dot }}
              />
              {status.name}
            </span>
          )}
        </div>
        {/* Chapters of one order, so `SectionTab` rather than `FilterTab` —
            the same distinction the store screen and the customer profile
            draw. The receipt is what somebody reads a hundred times a day;
            the history is read rarely and almost always because something has
            gone wrong, so it is a tab away rather than pushing the money down
            the page on every ordinary reading. */}
        <div role="tablist" className="-mb-px flex gap-lg pt-md">
          {TABS.map(({ key, labelKey }) => (
            <SectionTab
              key={key}
              label={t(labelKey)}
              active={tab === key}
              onClick={() => show(key)}
              onKeyDown={tabArrowHandler(
                TABS.map((one) => one.key),
                tab,
                show,
              )}
            />
          ))}
        </div>
      </header>

      {/* Full width. The page exists because a 420px panel is cramped for
          reading a bag's worth of lines back to somebody on the phone, and
          capping it here would have given most of that room straight back.

          Siblings rather than one swapped child, so a half-scrolled receipt
          survives a look at the history and back. */}
      <div className="flex min-h-0 flex-grow flex-col overflow-y-auto">
        <div className={cx("flex flex-col", tab !== "details" && "hidden")}>
          <OrderBody order={order.data} from={"page"} />
        </div>
        <div
          className={cx(
            "flex min-h-0 flex-grow flex-col",
            tab !== "history" && "hidden",
          )}
        >
          <OrderHistory order={order.data} />
        </div>
      </div>

      <OrderActions order={order.data} statuses={statuses.data} />
    </div>
  );
}
