"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { ROW } from "@/components/ui/row";
import { EmptyState } from "@/components/ui/empty-state";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { FilterTab, tabArrowHandler, type TabTone } from "@/components/ui/tab";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";

import type { Customer, CustomerScope } from "./api/customers";
import { useCustomerCounts, useCustomers } from "./use-customers";

/**
 * Customers — search first, then open one.
 *
 * ## The search box is the screen, not a filter above it
 *
 * The flow study calls this "read-mostly; search then look", and that is the
 * whole shape of the job: somebody rings up, and the operator needs *that*
 * person. Browsing the list in order is not something anybody does — it is
 * newest-first because a list needs an order, not because the newest customer
 * is who you were after.
 *
 * So the box takes focus on arrival and the list underneath is the fallback.
 *
 * ## A row leads to a page, not a panel
 *
 * A customer is not a form beside a list — it is a record with a history, a set
 * of addresses on a map, and everything they have ever ordered. That does not
 * fit a panel and it should not have to: the row navigates to
 * `/customers/<id>`, which is linkable, reloadable and sendable to somebody
 * else, and has room for the map the addresses actually need.
 *
 * The row's name is the anchor, stretched over the whole row with
 * `after:absolute after:inset-0`. That gives the largest target on the row
 * *and* an accessible name of "Rami Haddad" rather than "row", and keeps
 * open-in-new-tab working — which a click handler on a `div` would quietly have
 * taken away.
 */

/**
 * The tabs, and the colour each wears when selected.
 *
 * The dot is on every tab, selected or not, for the reason the queue's tabs
 * carry one: colour alone is not a distinction a colour-blind operator can rely
 * on, and the dot is what ties a tab to the chip in the rows beneath it. The
 * tabs are the legend.
 *
 * "All" has no tone, because it is not a state — it keeps the app's coral, the
 * same way the queue's "All" does.
 */
const TABS: {
  key: CustomerScope;
  labelKey: TranslationKey;
  tone?: TabTone;
}[] = [
  { key: "all", labelKey: "customers.tabAll" },
  {
    key: "active",
    labelKey: "customers.tabActive",
    tone: {
      wash: "var(--color-accent-wash)",
      ink: "var(--color-text)",
      dot: "var(--color-accent)",
    },
  },
  {
    key: "suspended",
    labelKey: "customers.tabSuspended",
    tone: {
      wash: "var(--color-danger-wash)",
      ink: "var(--color-text)",
      dot: "var(--color-danger)",
    },
  },
  {
    key: "closed",
    labelKey: "customers.tabClosed",
    tone: {
      wash: "var(--color-neutral-fill)",
      ink: "var(--color-text)",
      dot: "var(--color-text-faint)",
    },
  },
];

export function CustomersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState("");
  // Below the minimum, nothing is sent: one letter matches most of a table,
  // which is a round trip to tell somebody nothing.
  const term = search.trim().length >= SEARCH.minTerm ? search : "";

  const requested = params.get("show");
  const scope: CustomerScope = TABS.some((tab) => tab.key === requested)
    ? (requested as CustomerScope)
    : "all";

  const customers = useCustomers(scope, term);
  const counts = useCustomerCounts();

  /**
   * The tab lives in the URL, `replace` rather than `push`.
   *
   * Switching a filter is not a journey: Back should leave the customers screen
   * rather than walk through the tabs somebody looked at on the way.
   */
  function show(next: CustomerScope) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("show");
    else query.set("show", next);
    const query_string = query.toString();
    router.replace(query_string ? `${pathname}?${query_string}` : pathname, {
      scroll: false,
    });
  }

  const rows = customers.data?.pages.flatMap((page) => page.customers) ?? [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
        <h1 className="shrink-0 text-[24px]">{t("customers.title")}</h1>
        {/* The one screen where the box *is* the point — a customer is found by
            typing, not by scrolling — so it starts right after the heading and
            runs to the end of the bar. A strut pushing it to the right left the
            widest gap on the screen exactly where the most-used control was
            meant to be. */}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("customers.search")}
        />
      </div>

      {/* The same strip the order queue uses — same shape, same place, same
          keyboard behaviour — because these are the same kind of control and
          two spellings of it would be two things to learn.

          Counts come from `head` requests, so a tab says how many rows are in a
          set the screen has not loaded. Counting what was fetched would make
          every tab read "50", which is worse than no number: it looks like an
          answer. */}
      <div
        role="tablist"
        aria-label={t("customers.title")}
        className="flex shrink-0 gap-xxs overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        {TABS.map(({ key, labelKey, tone }) => (
          <FilterTab
            key={key}
            label={t(labelKey)}
            count={counts.data?.[key]}
            active={scope === key}
            tone={tone}
            onClick={() => show(key)}
            onKeyDown={tabArrowHandler(
              TABS.map((one) => one.key),
              scope,
              show,
            )}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
        {customers.isPending && (
          <div aria-hidden className="flex flex-col gap-sm">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-[58px] rounded-md border border-border bg-surface opacity-60"
              />
            ))}
          </div>
        )}

        {customers.isError && (
          <div className="flex flex-col items-center gap-lg py-huge text-center">
            <h2 className="text-[18px]">{t("customers.failedTitle")}</h2>
            <Button
              variant="secondary"
              onClick={() => void customers.refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}

        {rows.map((row) => (
          <Row key={row.id} customer={row} />
        ))}

        {customers.isSuccess && rows.length === 0 && (
          <EmptyState
            mood="lost"
            titleKey={term ? "customers.noneTitle" : "customers.emptyTitle"}
            bodyKey={term ? "customers.noneBody" : "customers.emptyBody"}
          />
        )}

        {customers.isSuccess && rows.length > 0 && (
          <InfiniteSentinel
            hasMore={customers.hasNextPage}
            loading={customers.isFetchingNextPage}
            onLoadMore={() => void customers.fetchNextPage()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The name, or what to say instead of one.
 *
 * `users.name = ''` is this schema's record of "signed in, never finished
 * setup" — the constraint in `0045`/`0046` exists to permit exactly that state.
 * Rendering it as a blank makes the row look broken; naming it makes it a
 * status, which is what it is.
 */
export function nameOf(customer: { name: string }): string {
  return customer.name.trim() || t("customers.incomplete");
}

function Row({ customer }: { customer: Customer }) {
  const closed = customer.deletedAt !== null;

  return (
    <div
      className={cx(
        ROW,
        // Marked rather than dimmed. A faded row reads as disabled, and these
        // are the rows most likely to be the one somebody is looking for.
        closed || !customer.isActive
          ? "border-danger-wash bg-danger-wash/30"
          : "border-border",
        "hover:border-active",
      )}
    >
      <Avatar id={customer.id} name={customer.name} />

      <span className="flex min-w-0 flex-grow flex-col gap-xxs">
        <Link
          href={`/customers/${customer.id}`}
          className={cx(
            "truncate text-[15px] font-semibold after:absolute after:inset-0",
            !customer.name.trim() && "italic text-text-soft",
          )}
        >
          {nameOf(customer)}
        </Link>
        <span className="truncate tabular-nums text-[12px] text-text-faint">
          {formatPhone(customer.phone)}
        </span>
      </span>

      <span className="shrink-0 text-[12px] text-text-faint">
        {customer.orderCount === 0
          ? t("customers.noOrders")
          : t("customers.orderCount", { count: customer.orderCount })}
      </span>

      <span className="w-[110px] shrink-0 text-[12px] text-text-faint">
        {t("customers.joined", { when: formatDate(customer.createdAt) })}
      </span>

      <StatusChip customer={customer} />
    </div>
  );
}

/** A state, not a switch. The switch lives on the profile, where it has room. */
export function StatusChip({
  customer,
  className,
}: {
  customer: { isActive: boolean; deletedAt: string | null };
  className?: string;
}) {
  const closed = customer.deletedAt !== null;

  return (
    <span
      className={cx(
        "w-[92px] shrink-0 rounded-sm px-sm py-[2px] text-center text-[12px] font-semibold",
        closed
          ? "bg-neutral-fill text-text-soft"
          : customer.isActive
            ? "bg-accent-wash text-text"
            : "bg-danger-wash text-text",
        className,
      )}
    >
      {closed
        ? t("customers.closedLabel")
        : customer.isActive
          ? t("customers.activeLabel")
          : t("customers.suspendedLabel")}
    </span>
  );
}
