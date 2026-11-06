"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Avatar,
  EmptyState,
  ListCard,
  Page,
  PageHeader,
  SearchInput,
  TBody,
  THead,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  QueryState,
  cx,
} from "@/components/ui";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatRelative } from "@/lib/time";

import { AccountActions } from "./account-actions";
import type { Customer, CustomerScope } from "./api/customers";
import { CustomerStatus, nameOf } from "./customer-status";
import { useCustomerCounts, useCustomers } from "./use-customers";

const SCOPES: { key: CustomerScope; label: TranslationKey }[] = [
  { key: "all", label: "customers.tabAll" },
  { key: "active", label: "customers.tabActive" },
  { key: "suspended", label: "customers.tabSuspended" },
  { key: "closed", label: "customers.tabClosed" },
];

const EMPTY: Record<
  CustomerScope,
  { title: TranslationKey; body: TranslationKey }
> = {
  all: { title: "customers.emptyTitle", body: "customers.emptyBody" },
  active: { title: "customers.emptyTitle", body: "customers.emptyBody" },
  suspended: {
    title: "customers.emptySuspendedTitle",
    body: "customers.emptySuspendedBody",
  },
  closed: {
    title: "customers.emptyClosedTitle",
    body: "customers.emptyClosedBody",
  },
};

/** The term, once the operator has stopped typing for a moment. */
function useSettled(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Customers — search first, then open one.
 *
 * The job is "somebody rings up, find *that* person", so the search box takes
 * focus on arrival and the list underneath is the fallback. A `?q=` (the
 * command palette links here with one) seeds the box; the tab is `?show=`,
 * written with `replace` so Back leaves the screen rather than walking back
 * through the tabs.
 *
 * Counts on the tabs come from `head` requests, so they are the size of each
 * set, not of what has been fetched. Closed accounts stay listed — their
 * orders still trace back to somebody.
 */
export function CustomersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("show");
  const scope: CustomerScope = SCOPES.some((one) => one.key === requested)
    ? (requested as CustomerScope)
    : "all";

  // Seeded from `?q=`, and re-seeded when a new one arrives while the screen
  // is already open (the palette, pressed twice). Adjusted during render
  // rather than in an effect, so the box never paints the old term.
  const incoming = params.get("q") ?? "";
  const [seed, setSeed] = useState(incoming);
  const [search, setSearch] = useState(incoming);
  if (incoming !== seed) {
    setSeed(incoming);
    setSearch(incoming);
  }

  const settled = useSettled(search.trim());
  // Below the minimum nothing is sent: one letter matches most of a table.
  const term = settled.length >= SEARCH.minTerm ? settled : "";

  const customers = useCustomers(scope, term);
  const counts = useCustomerCounts();
  const rows = customers.data?.pages.flatMap((page) => page.customers) ?? [];

  function show(next: CustomerScope) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("show");
    else query.set("show", next);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  const empty = term
    ? ({ title: "customers.noneTitle", body: "customers.noneBody" } as const)
    : EMPTY[scope];

  const total = counts.data?.[scope] ?? null;

  return (
    <Page>
      <PageHeader
        title={t("customers.title")}
        description={t("customers.blurb")}
      />

      {/* Shopify's customer index: one card holding the saved views, the
          search and the table, with the count of the set at its foot. */}
      <ListCard
        tabs={
          <Tabs
            value={scope}
            onChange={show}
            items={SCOPES.map((one) => ({
              key: one.key,
              label: t(one.label),
              count: counts.data?.[one.key] ?? null,
            }))}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("customers.search")}
            // The screen's one job is finding a person, so the cursor starts
            // here.
            autoFocus
          />
        }
        footer={
          customers.isSuccess && rows.length > 0 ? (
            <>
              <span className="tabular-nums">
                {term || total === null
                  ? t("customers.shownCount", { count: rows.length })
                  : t("customers.shownOf", { shown: rows.length, total })}
              </span>
              <InfiniteSentinel
                hasMore={customers.hasNextPage}
                loading={customers.isFetchingNextPage}
                onLoadMore={() => void customers.fetchNextPage()}
              />
            </>
          ) : undefined
        }
      >
        <QueryState
          status={
            customers.isPending
              ? "pending"
              : customers.isError
                ? "error"
                : rows.length === 0
                  ? "empty"
                  : "ready"
          }
          rows={8}
          failedTitle={t("customers.failedTitle")}
          onRetry={() => void customers.refetch()}
          empty={
            <EmptyState
              icon={term ? <SearchX /> : <Users />}
              title={t(empty.title)}
              description={t(empty.body)}
            />
          }
        />

        {rows.length > 0 && (
          <Table aria-busy={customers.isFetching || undefined}>
            <THead>
              <tr>
                <Th>{t("customers.colCustomer")}</Th>
                <Th className="hidden md:table-cell">
                  {t("customers.colPhone")}
                </Th>
                <Th className="hidden sm:table-cell">
                  {t("customers.colStatus")}
                </Th>
                <Th className="text-end">{t("customers.colOrders")}</Th>
                <Th className="hidden lg:table-cell">
                  {t("customers.colLastOrder")}
                </Th>
                <Th className="hidden xl:table-cell">
                  {t("customers.colJoined")}
                </Th>
                <Th className="w-12">
                  <span className="sr-only">{t("customers.colActions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  onOpen={() => router.push(`/customers/${customer.id}`)}
                />
              ))}
            </TBody>
          </Table>
        )}
      </ListCard>
    </Page>
  );
}

function CustomerRow({
  customer,
  onOpen,
}: {
  customer: Customer;
  onOpen: () => void;
}) {
  const unnamed = !customer.name.trim();
  const phone = formatPhone(customer.phone);

  return (
    <Tr
      interactive
      onClick={onOpen}
      className={cx(customer.deletedAt !== null && "bg-subtle/60")}
    >
      <Td className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={unnamed ? "" : customer.name} size={32} />
          <div className="flex min-w-0 flex-col">
            {/* A real link: keyboard-reachable, and open-in-new-tab works.
                The row's own click is the larger, mouse-only target. */}
            <Link
              href={`/customers/${customer.id}`}
              onClick={(event) => event.stopPropagation()}
              className={cx(
                "max-w-[16rem] truncate font-medium text-ink hover:underline",
                unnamed && "font-normal text-ink-3 italic",
              )}
            >
              {nameOf(customer)}
            </Link>
            {/* The phone moves under the name where its column is hidden. */}
            <span
              dir="ltr"
              className="truncate text-start text-[12.5px] text-ink-3 tabular-nums md:hidden"
            >
              {phone}
            </span>
            <span className="sm:hidden">
              <CustomerStatus customer={customer} />
            </span>
          </div>
        </div>
      </Td>
      <Td className="hidden whitespace-nowrap text-ink-2 tabular-nums md:table-cell">
        <span dir="ltr">{phone}</span>
      </Td>
      <Td className="hidden sm:table-cell">
        <CustomerStatus customer={customer} />
      </Td>
      <Td
        className={cx(
          "text-end tabular-nums",
          customer.orderCount === 0 && "text-ink-4",
        )}
      >
        {customer.orderCount}
      </Td>
      <Td className="hidden whitespace-nowrap text-ink-2 lg:table-cell">
        {customer.lastOrderAt ? (
          // "3 weeks ago" is what tells somebody has gone quiet; the date is
          // there on hover for when the exact day matters.
          <span title={formatDate(customer.lastOrderAt)}>
            {formatRelative(customer.lastOrderAt)}
          </span>
        ) : (
          <span className="text-ink-4">{t("customers.never")}</span>
        )}
      </Td>
      <Td className="hidden whitespace-nowrap text-ink-3 xl:table-cell">
        {formatDate(customer.createdAt)}
      </Td>
      <Td className="text-end" onClick={(event) => event.stopPropagation()}>
        <AccountActions customer={customer} />
      </Td>
    </Tr>
  );
}
