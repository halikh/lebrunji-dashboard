"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { t } from "@/i18n/translations";
import { formatDayAndTime } from "@/lib/time";
import { Price } from "@/features/reference/price";

import { fetchAmendments, fetchHandovers } from "./api/history";
import type { Order } from "./api/orders";

/**
 * Everything that has happened to an order since it was placed.
 *
 * ## Why this is a tab and not a strip under the receipt
 *
 * The receipt answers "what is coming and where does it go", and that is what
 * the operator reads a hundred times a day. This answers "what happened to
 * it" — asked rarely, and almost always because something has gone wrong: a
 * customer disputing a total, an order nobody can find. Putting it under the
 * lines would push the money off the screen on every ordinary reading to serve
 * the rare one.
 *
 * ## Two records, one column, in time order
 *
 * They are stored apart because they are different facts (see `api/history.ts`)
 * and shown together because the question is chronological. What somebody is
 * reconstructing is a sequence: it was changed, then it went to Ali, then it
 * was changed again — and two lists side by side make the reader do the
 * interleaving in their head, which is exactly the step where the order of
 * events gets remembered wrongly.
 *
 * An order with nothing in either is the ordinary case, and it says so plainly
 * rather than showing two empty headings.
 */
export function OrderHistory({ order }: { order: Order }) {
  const amendments = useQuery({
    queryKey: ["orders", order.id, "amendments"],
    queryFn: () => fetchAmendments(order.id),
  });
  const handovers = useQuery({
    queryKey: ["orders", order.id, "handovers"],
    queryFn: () => fetchHandovers(order.id),
  });

  type Entry = { id: string; at: string; node: React.ReactNode };

  const entries: Entry[] = [
    ...(amendments.data ?? []).map((one) => ({
      id: `a-${one.id}`,
      at: one.createdAt,
      node: (
        <div className="flex flex-col gap-xs">
          <div className="flex flex-wrap items-baseline gap-md">
            <span className="text-[15px] font-semibold">
              {t("history.amended")}
            </span>
            <span className="flex items-baseline gap-sm text-[13px]">
              {/* Both figures, because the question this answers is almost
                  always "the customer says it was X" — and one number cannot
                  answer it. */}
              <span className="text-text-faint line-through">
                <Price value={one.previousTotal} code={order.currencyCode} />
              </span>
              {/* An SVG rather than an arrow character: the lint rule that
                  bans literal strings in JSX is what keeps every user-facing
                  word in `translations.ts`, and a bare glyph is exactly the
                  kind of thing that slips past a sweep for untranslated text.
                  This one carries no words at all. */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="shrink-0 self-center text-text-faint"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <Price value={one.newTotal} code={order.currencyCode} />
            </span>
          </div>
          {one.note && <p className="text-[13px] text-text-soft">{one.note}</p>}
        </div>
      ),
    })),
    ...(handovers.data ?? []).map((one) => ({
      id: `h-${one.id}`,
      at: one.dispatchedAt,
      node: (
        <div className="flex flex-col gap-xs">
          <span className="text-[15px] font-semibold">
            {t("history.handedTo")}{" "}
            <Link
              href={`/drivers/${one.courierId}`}
              className="text-primary hover:underline"
            >
              {one.courierName}
            </Link>
          </span>
          {/* The same caveat the driver's page carries, for the same reason:
              this is where somebody works out who had an order that went
              missing, and a page that overclaims is worse than one that says
              less. */}
          <p className="text-[12px] text-text-faint">{t("history.caveat")}</p>
        </div>
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const loading = amendments.isPending || handovers.isPending;

  return (
    <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
      {(amendments.isError || handovers.isError) && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("content.failed")}
        </p>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-[13px] text-text-faint">{t("history.nothing")}</p>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-lg"
        >
          <span className="text-[12px] text-text-faint">
            {formatDayAndTime(entry.at)}
          </span>
          {entry.node}
        </div>
      ))}
    </div>
  );
}
