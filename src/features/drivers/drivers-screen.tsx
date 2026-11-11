"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Truck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  ListCard,
  Menu,
  Page,
  PageHeader,
  QueryState,
  SearchInput,
  Tabs,
  cx,
} from "@/components/ui";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatPhone } from "@/lib/phone";

import { isTakingOrders, type Courier } from "./api/couriers";
import { AvailabilityControl, ShiftBadge, ShiftLine } from "./availability";
import { useCouriers, useOurHours, useSetCourierActive } from "./use-couriers";

type Scope = "all" | "active" | "off" | "inactive";

const SCOPES: { key: Scope; label: TranslationKey }[] = [
  { key: "all", label: "drivers.tabAll" },
  { key: "active", label: "drivers.tabActive" },
  { key: "off", label: "drivers.tabOff" },
  { key: "inactive", label: "drivers.tabInactive" },
];

const EMPTY: Record<Scope, { title: TranslationKey; body?: TranslationKey }> = {
  all: { title: "drivers.empty", body: "drivers.emptyBody" },
  active: { title: "drivers.emptyActive", body: "drivers.emptyActiveBody" },
  off: { title: "drivers.emptyOff" },
  inactive: { title: "drivers.emptyInactive" },
};

/**
 * Who an order can be handed to.
 *
 * The search is a query, not a local filter: today the list is a handful of
 * rows, but a local filter fails silently once it is not — it finds only what
 * is loaded and reads as "we do not have that person".
 *
 * The scope lives in the URL like every other filter, so a view can be linked
 * or reloaded. `?focus=` brings a row back into view after an edit started
 * from this list.
 */
export function DriversScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState("");
  const couriers = useCouriers(search);
  const ours = useOurHours();

  const requested = params.get("scope");
  const scope: Scope = SCOPES.some((one) => one.key === requested)
    ? (requested as Scope)
    : "all";
  const focusId = params.get("focus");

  function show(next: Scope) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("scope");
    else query.set("scope", next);
    query.delete("focus");
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  const searching = search.trim().length >= SEARCH.minTerm;
  const matching = couriers.data ?? [];

  /**
   * Counted from what was fetched — exact here, because this list is not
   * paginated: every driver matching the term is in hand. They follow the
   * search, so "Taking orders 2" beside a filtered list means two matches.
   *
   * "All" and the two shift tabs are people who work here; "Not active" is
   * people who used to, so they are kept out of the first three.
   */
  const onBooks = matching.filter((one) => one.isActive);
  const counts: Record<Scope, number> = {
    all: onBooks.length,
    active: onBooks.filter((one) => isTakingOrders(one, ours)).length,
    off: onBooks.filter((one) => !isTakingOrders(one, ours)).length,
    inactive: matching.filter((one) => !one.isActive).length,
  };
  const rows =
    scope === "inactive"
      ? matching.filter((one) => !one.isActive)
      : scope === "all"
        ? onBooks
        : onBooks.filter((one) =>
            scope === "active"
              ? isTakingOrders(one, ours)
              : !isTakingOrders(one, ours),
          );

  const empty = EMPTY[scope];

  /**
   * On "All", the roster splits into who is taking orders and who is not —
   * Onfleet's on-duty / off-duty grouping — so the people a dispatcher can
   * hand to right now are the top of the list, not scattered through it.
   */
  const groups =
    scope === "all"
      ? [
          {
            key: "on",
            label: t("drivers.groupOn", { count: counts.active }),
            rows: rows.filter((one) => isTakingOrders(one, ours)),
          },
          {
            key: "off",
            label: t("drivers.groupOff", { count: counts.off }),
            rows: rows.filter((one) => !isTakingOrders(one, ours)),
          },
        ].filter((group) => group.rows.length > 0)
      : [{ key: scope, label: null, rows }];

  return (
    <Page>
      <PageHeader
        title={t("drivers.title")}
        description={t("drivers.blurb")}
        actions={
          <Button variant="primary" asChild>
            <Link href="/drivers/new">
              <Plus />
              {t("drivers.add")}
            </Link>
          </Button>
        }
      />

      <ListCard
        tabs={
          <Tabs
            items={SCOPES.map(({ key, label }) => ({
              key,
              label: t(label),
              count: couriers.isSuccess ? counts[key] : null,
            }))}
            value={scope}
            onChange={show}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("drivers.search")}
          />
        }
        footer={
          couriers.isSuccess && rows.length > 0 ? (
            <span className="tabular-nums">
              {t("drivers.shownCount", { count: rows.length })}
            </span>
          ) : undefined
        }
      >
        <QueryState
          status={
            couriers.isPending
              ? "pending"
              : couriers.isError
                ? "error"
                : rows.length === 0
                  ? "empty"
                  : "ready"
          }
          rows={5}
          failedTitle={t("drivers.failed")}
          onRetry={() => void couriers.refetch()}
          empty={
            // The term is named: an empty list with no explanation looks the
            // same as one that failed to load.
            <EmptyState
              icon={searching ? <SearchX /> : <Truck />}
              title={
                searching
                  ? t("drivers.searchNone", { term: search.trim() })
                  : t(empty.title)
              }
              description={
                searching
                  ? t("drivers.noneBody")
                  : empty.body
                    ? t(empty.body)
                    : undefined
              }
              action={
                !searching && scope === "all" ? (
                  <Button variant="primary" asChild>
                    <Link href="/drivers/new">
                      <Plus />
                      {t("drivers.add")}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />

        {rows.length > 0 &&
          groups.map((group) => (
            <section key={group.key}>
              {group.label && (
                <h2 className="border-y border-line bg-subtle px-4 py-1.5 text-[12.5px] font-medium text-ink-3 first:border-t-0 sm:px-5">
                  {group.label}
                </h2>
              )}
              <ul className="divide-y divide-line">
                {group.rows.map((courier) => (
                  <DriverRow
                    key={courier.id}
                    courier={courier}
                    focused={courier.id === focusId}
                  />
                ))}
              </ul>
            </section>
          ))}
      </ListCard>
    </Page>
  );
}

/**
 * One driver. The name is a stretched link to their page — the row's main
 * purpose — so every control on the right sits above it with `relative z-10`.
 *
 * There is no delete. A driver who has left still appears on every order they
 * carried; removing the row would leave that history pointing at nobody.
 * Deactivating asks first (it takes somebody out of dispatch, and nothing here
 * looks different afterwards); bringing back does not, because it restores.
 */
function DriverRow({
  courier,
  focused,
}: {
  courier: Courier;
  focused: boolean;
}) {
  const router = useRouter();
  const setActive = useSetCourierActive();
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  return (
    <li
      ref={ref}
      className={cx(
        "relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-subtle sm:flex-nowrap",
        focused && "bg-accent-soft/60 hover:bg-accent-soft/60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/drivers/${courier.id}`}
            className="truncate text-[14px] font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset"
          >
            {courier.name}
          </Link>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
            <span
              dir="ltr"
              className="truncate text-[13px] text-ink-3 tabular-nums"
            >
              {formatPhone(courier.phone)}
            </span>
            <ShiftLine courier={courier} />
          </span>
        </div>
      </div>

      <div className="relative z-10 flex w-full items-center justify-between gap-3 ps-12 sm:w-auto sm:justify-end sm:ps-0">
        <ShiftBadge courier={courier} />
        <div className="flex items-center gap-2">
          {/* Tookan's one-tap contact: the number is stored the way wa.me
              takes it, digits with the country code. */}
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            aria-label={t("drivers.whatsapp")}
          >
            <a
              href={`https://wa.me/${courier.phone}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle />
            </a>
          </Button>
          {courier.isActive ? (
            <AvailabilityControl courier={courier} />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              pending={setActive.isPending}
              onClick={() =>
                setActive.mutate({
                  id: courier.id,
                  active: true,
                  name: courier.name,
                })
              }
            >
              <UserPlus />
              {t("drivers.reactivate")}
            </Button>
          )}
          <Menu
            label={courier.name}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("drivers.rowActions", { name: courier.name })}
              >
                <MoreHorizontal />
              </Button>
            }
            items={[
              {
                label: t("drivers.edit"),
                icon: <Pencil />,
                // `?from=list` so Back returns here rather than to their page.
                onSelect: () =>
                  router.push(`/drivers/${courier.id}/edit?from=list`),
              },
              ...(courier.isActive
                ? [
                    "separator" as const,
                    {
                      label: t("drivers.deactivate"),
                      icon: <UserMinus />,
                      tone: "danger" as const,
                      onSelect: () => setConfirming(true),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("drivers.deactivateTitle", { name: courier.name })}
        description={t("drivers.deactivateBody")}
        confirmLabel={t("drivers.deactivateConfirm")}
        tone="danger"
        onConfirm={() =>
          setActive.mutateAsync({
            id: courier.id,
            active: false,
            name: courier.name,
          })
        }
      />
    </li>
  );
}
