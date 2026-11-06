"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ChevronRight,
  Clock,
  CornerDownRight,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ListCard,
  ListSkeleton,
  Menu,
  Page,
  PageHeader,
  SearchInput,
  Skeleton,
  Tabs,
  Thumb,
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "../api/branches";
import { applyOrder } from "../api/menu";
import type { Store } from "../api/stores";
import { useBranches } from "../use-branches";
import {
  useArchiveStore,
  useReorderStores,
  useStores,
  useUpdateStore,
} from "../use-stores";

import type { DayHours } from "../api/hours";

import { BranchLiveToggle, BranchStatusLine } from "./branch-status";
import { useNow } from "./hours";
import { nextChangeAt, shopChange, type NextChange } from "./next-change";
import { StatusLine, useDescribeChange } from "./open-status";
import {
  NoPinWarning,
  NoWhatsappWarning,
  ShopThumb,
  shopMeta,
} from "./shop-identity";
import { useHoursForBranches } from "./use-hours";

type Filter = "all" | "live" | "hidden" | "openNow" | "closedNow";
const FILTERS: Filter[] = ["all", "live", "hidden", "openNow", "closedNow"];

/**
 * Where a shop stands for a customer opening the app now — Uber Eats
 * Manager's store state, with Google's "closes 23:00" after it.
 */
type ShopState =
  | { kind: "hidden" }
  | { kind: "noBranch" }
  | { kind: "loading" }
  | {
      kind: "hours";
      change: NextChange & { openCount: number };
      trading: number;
      unset: boolean;
    };

function stateOf(
  store: Store,
  weeks: Map<string, DayHours[]> | undefined,
  now: Date,
): ShopState {
  if (!store.isActive) return { kind: "hidden" };
  if (store.tradingBranchIds.length === 0) return { kind: "noBranch" };
  if (!weeks) return { kind: "loading" };
  const each = store.tradingBranchIds.map((id) => weeks.get(id) ?? []);
  return {
    kind: "hours",
    change: shopChange(each.map((week) => nextChangeAt(week, now))),
    trading: each.length,
    unset: each.every((week) => week.length === 0),
  };
}

function isOpen(state: ShopState): boolean {
  return state.kind === "hours" && state.change.open;
}

/**
 * The shops.
 *
 * Rare to create, edited occasionally, read constantly — so a list that shows
 * *state* rather than a form. What an operator comes here for is almost always
 * one of three things: take a shop off the storefront, put it back, or notice
 * that something is wrong with one. The third is why the pin and phone
 * warnings are on the row: an unpinned shop charges every customer the top
 * delivery band, and a shop with no number takes orders it cannot send.
 *
 * ## Searching, filtering and reordering
 *
 * The order here is the app's order (`0206`): dragging a row moves the shop in
 * Featured, Open now and every list. A position among *matches* is not a
 * position in the list, so a drag while searching or filtered would write an
 * order nobody chose — the handles go away while either is on.
 *
 * `?q=` seeds the search, so the command palette can land here with a term.
 *
 * ## Open now
 *
 * Every row says whether a customer could order there this minute and until
 * when, and "Open now" / "Closed now" are filters — what a delivery desk most
 * often asks of its catalogue in the evening. Every trading branch's week
 * comes in one request (`fetchHoursForBranches`), read on Beirut's clock.
 *
 * ## A chain's branches, under it
 *
 * Uber Eats Manager and Shopify list every location; here a shop with two or
 * more branches shows them as rows indented under the brand, each with its own
 * open line, its own Live switch and the way to its page — so "is Hamra
 * open?" and "shut Verdun for the night" are answered without opening the
 * shop. Expanded by default, folded per chain, and the fold is remembered in
 * this browser. They are not dragged: the order here is the shops', and a
 * branch's place is within its shop (the Branches tab). Carried, a chain is
 * only its brand row, so what moves under the cursor is a strip.
 *
 * Bulk hide/show is deliberately not offered: taking a shop off the
 * storefront is customer-visible and asks first, one shop at a time, and a
 * catalogue of tens of shops does not need twenty hidden at once.
 */
export function ShopsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const requested = params.get("show") as Filter | null;
  const filter: Filter =
    requested && FILTERS.includes(requested) ? requested : "all";

  const stores = useStores(search.trim());
  const update = useUpdateStore();
  const archive = useArchiveStore();
  const reorder = useReorderStores();
  const [collapsed, toggleChain] = useCollapsedChains();

  const [archiving, setArchiving] = useState<Store | null>(null);

  const all = stores.data?.stores ?? [];
  const weeks = useHoursForBranches(
    all.filter((row) => row.isActive).flatMap((row) => row.tradingBranchIds),
  );
  const now = useNow();
  const states = new Map(
    all.map((row) => [row.id, stateOf(row, weeks.data, now)]),
  );
  const stateFor = (row: Store): ShopState =>
    states.get(row.id) ?? { kind: "loading" };

  const matches: Record<Filter, (row: Store) => boolean> = {
    all: () => true,
    live: (row) => row.isActive,
    hidden: (row) => !row.isActive,
    openNow: (row) => isOpen(stateFor(row)),
    // Live and shut: a hidden shop is not "closed now", it is hidden.
    closedNow: (row) =>
      row.isActive &&
      stateFor(row).kind !== "loading" &&
      !isOpen(stateFor(row)),
  };
  const rows = all.filter(matches[filter]);
  const searching = search.trim().length > 0;

  const counts = Object.fromEntries(
    FILTERS.map((key) => [key, all.filter(matches[key]).length]),
  ) as Record<Filter, number>;

  function setFilter(next: Filter) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("show");
    else query.set("show", next);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  /**
   * Dragging, on the dashboard's own column.
   *
   * `applyOrder` numbers by `sortOrder`, so the rows go in with
   * `adminSortOrder` in that slot and come back the same way — one numbering
   * function for every list. `setStoreOrder` writes `admin_sort_order` and
   * `sort_order` together, since the order here is the order the app shows.
   */
  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = applyOrder(
        rows.map((row) => ({ ...row, sortOrder: row.adminSortOrder })),
        ids,
      );
      reorder.mutate({
        updates,
        next: {
          truncated: stores.data?.truncated ?? false,
          stores: next.map((row) => ({
            ...row,
            adminSortOrder: row.sortOrder,
            sortOrder: row.adminSortOrder,
          })),
        },
      });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
    disabled: searching || filter !== "all",
  });

  const newShop = (
    <Button variant="primary" asChild>
      <Link href="/shops/new">
        <Plus />
        {t("store.add")}
      </Link>
    </Button>
  );

  return (
    <Page>
      <PageHeader
        title={t("catalogue.shopsTitle")}
        description={t("catalogue.shopsDescription")}
        actions={newShop}
      />

      <ListCard
        tabs={
          <Tabs
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((key) => ({
              key,
              label:
                key === "openNow" || key === "closedNow"
                  ? t(`catalogue.filter2.${key}`, { count: counts[key] })
                  : t(`catalogue.filter.${key}`, { count: counts[key] }),
            }))}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("catalogue.searchPlaceholder")}
          />
        }
        filters={
          stores.isSuccess && (
            <p className="text-[13px] text-ink-3 tabular-nums">
              {t(rows.length === 1 ? "catalogue.countOne" : "catalogue.count", {
                count: rows.length,
              })}
            </p>
          )
        }
        footer={
          order.sortable ? (
            <span>{t("catalogue.reorderHint")}</span>
          ) : (searching || filter !== "all") && rows.length > 1 ? (
            <span>{t("catalogue.reorderOff")}</span>
          ) : undefined
        }
      >
        {stores.isPending && <ListSkeleton rows={6} />}

        {stores.isError && (
          <EmptyState
            icon={<AlertTriangle />}
            title={t("catalogue.failedTitle")}
            description={t("catalogue.failedBody")}
            action={
              <Button onClick={() => void stores.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        )}

        {stores.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={searching ? <SearchX /> : <StoreIcon />}
            title={
              searching
                ? t("catalogue.noMatchTitle")
                : filter !== "all" && all.length > 0
                  ? filter === "openNow" || filter === "closedNow"
                    ? t(`catalogue.filterEmpty2.${filter}`)
                    : t(`catalogue.filterEmpty.${filter}`)
                  : t("catalogue.emptyTitle")
            }
            description={
              searching
                ? t("catalogue.noMatchBody")
                : filter !== "all" && all.length > 0
                  ? undefined
                  : t("catalogue.emptyBody")
            }
            action={
              searching ? (
                <Button onClick={() => setSearch("")}>
                  {t("common.clear")}
                </Button>
              ) : filter !== "all" && all.length > 0 ? (
                <Button onClick={() => setFilter("all")}>
                  {t("catalogue.showAll")}
                </Button>
              ) : (
                newShop
              )
            }
          />
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-line">
            {order
              .ordered(rows, (row) => row.id)
              .map((store) => (
                <ShopRow
                  key={store.id}
                  store={store}
                  state={stateFor(store)}
                  weeks={weeks.data}
                  expanded={!collapsed.has(store.id)}
                  onToggleExpanded={() => toggleChain(store.id)}
                  carried={order.movingId === store.id}
                  rowProps={order.rowProps(store.id)}
                  handleProps={order.handleProps(store.id)}
                  onToggleActive={() =>
                    update.mutate({
                      id: store.id,
                      patch: { isActive: !store.isActive },
                    })
                  }
                  onToggleFeatured={() =>
                    update.mutate({
                      id: store.id,
                      patch: { isFeatured: !store.isFeatured },
                    })
                  }
                  onArchive={() => setArchiving(store)}
                />
              ))}
          </ul>
        )}
        {order.instructions}
      </ListCard>

      {/* Said out loud rather than silently truncating: a catalogue quietly
          missing shops is the kind of wrong nobody notices until a customer
          asks why they cannot find one. */}
      {stores.data?.truncated && (
        <p role="status" className="text-[13px] text-warning-ink">
          {t("catalogue.truncated")}
        </p>
      )}

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t("catalogue.archiveTitleNamed", {
          name: archiving ? pickLocalized(archiving.name) : "",
        })}
        description={t("catalogue.archiveBody")}
        confirmLabel={t("catalogue.archiveConfirm")}
        tone="danger"
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await archive.mutateAsync({
              id: archiving.id,
              name: archiving.name,
            });
          } catch {
            // Reported by the hook's toast.
          }
        }}
      />
    </Page>
  );
}

function ShopRow({
  store,
  state,
  weeks,
  expanded,
  onToggleExpanded,
  carried,
  rowProps,
  handleProps,
  onToggleActive,
  onToggleFeatured,
  onArchive,
}: {
  store: Store;
  state: ShopState;
  /** Every trading branch's week, once read. */
  weeks: Map<string, DayHours[]> | undefined;
  /** A chain's branches are showing under it. */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Being dragged: drawn as the brand row alone. */
  carried: boolean;
  rowProps: ReturnType<ReturnType<typeof useReorder>["rowProps"]>;
  handleProps: ReturnType<ReturnType<typeof useReorder>["handleProps"]>;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onArchive: () => void;
}) {
  const router = useRouter();
  const describe = useDescribeChange();
  const name = pickLocalized(store.name);
  const href = `/shops/${store.id}`;
  const branches = store.branchIds.length;
  const chain = branches > 1;

  return (
    <li {...rowProps} className={cx(rowProps.className, "bg-surface")}>
      <div className="group relative flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-subtle sm:flex-nowrap sm:px-4">
        {/* Above the name's stretched hit area, like every control on the row. */}
        <button
          {...handleProps}
          className={cx(
            handleProps.className,
            "relative z-10 flex size-7 shrink-0 cursor-grab items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink-2 active:cursor-grabbing",
          )}
        >
          <GripIcon />
        </button>

        {/* A chain folds its branches away; a single-branch shop *is* its
          branch, so it has nothing to fold — the space keeps names aligned. */}
        {chain ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={t(
              expanded ? "branches.hideBranches" : "branches.showBranches",
              { name },
            )}
            className="relative z-10 -ms-1 flex size-7 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-hover hover:text-ink"
          >
            <ChevronRight
              aria-hidden
              className={cx(
                "size-4 transition-transform rtl:rotate-180",
                expanded && "rotate-90 rtl:rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden className="-ms-1 hidden size-7 shrink-0 sm:block" />
        )}

        {/* A live shop that is shut right now gets the dark veil delivery apps
          put over a closed restaurant, so it stands out down the list. */}
        <span className="relative shrink-0">
          <ShopThumb
            store={store}
            size={44}
            className={cx(!store.isActive && "opacity-60 grayscale")}
          />
          {state.kind === "hours" && !state.change.open && (
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-ink/60 text-[10px] font-semibold text-white">
              {t("hours.closedNow")}
            </span>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {/* The row is the link, by way of the name: `after:inset-0`
              stretches its hit area over the row while the accessible name
              stays the shop's, and it still opens in a new tab. */}
            <Link
              href={href}
              className={cx(
                "truncate text-[14.5px] font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent",
                store.isActive ? "text-ink" : "text-ink-2",
              )}
            >
              {name}
            </Link>
            {store.isFeatured && (
              <Star
                aria-label={t("catalogue.featured")}
                className="size-3.5 shrink-0 fill-warning text-warning"
              />
            )}
            {!store.isActive && (
              <Badge tone="neutral">{t("catalogue.inactive")}</Badge>
            )}
          </div>
          <p className="truncate text-[12.5px] text-ink-3">
            {branches > 1
              ? `${shopMeta(store)}, ${t("catalogue.branchCount", { count: branches })}`
              : shopMeta(store)}
          </p>
          {state.kind === "hidden" ? (
            <StatusLine tone="muted">{t("hours.status.hidden")}</StatusLine>
          ) : state.kind === "noBranch" ? (
            <StatusLine tone="warning">{t("hours.status.noBranch")}</StatusLine>
          ) : state.kind === "hours" ? (
            <StatusLine
              tone={
                state.unset ? "warning" : state.change.open ? "open" : "closed"
              }
            >
              {state.change.open &&
              state.trading > 1 &&
              state.change.openCount < state.trading
                ? t("hours.status.someOpen", {
                    open: state.change.openCount,
                    total: state.trading,
                  })
                : describe(state.change, { unset: state.unset })}
            </StatusLine>
          ) : null}
          {(store.unpinnedBranches > 0 || !store.orderPhone) && (
            <div className="flex flex-wrap gap-1.5">
              {store.unpinnedBranches > 0 && (
                <NoPinWarning count={store.unpinnedBranches} />
              )}
              {!store.orderPhone && <NoWhatsappWarning />}
            </div>
          )}
        </div>

        {/* Their own line under the name on a phone; beside it from `sm`. */}
        <div className="relative z-10 flex w-full shrink-0 items-center justify-end gap-4 ps-10 sm:w-auto sm:ps-0">
          <ConfirmToggle
            on={store.isActive}
            onChange={onToggleActive}
            labelOn={t("catalogue.active")}
            labelOff={t("catalogue.inactive")}
            params={{ name }}
            whenTurningOn={{
              titleKey: "catalogue.openTitle",
              bodyKey: "catalogue.openBody",
              confirmKey: "catalogue.openConfirm",
            }}
            whenTurningOff={{
              titleKey: "catalogue.closeTitle",
              bodyKey: "catalogue.closeBody",
              confirmKey: "catalogue.closeConfirm",
            }}
            className="w-[5.5rem]"
          />
          <ConfirmToggle
            on={store.isFeatured}
            onChange={onToggleFeatured}
            labelOn={t("catalogue.featured")}
            labelOff={t("store.notFeatured")}
            params={{ name }}
            whenTurningOn={{
              titleKey: "catalogue.featureTitle",
              bodyKey: "catalogue.featureBody",
              confirmKey: "catalogue.featureConfirm",
            }}
            whenTurningOff={{
              titleKey: "catalogue.unfeatureTitle",
              bodyKey: "catalogue.unfeatureBody",
              confirmKey: "catalogue.unfeatureConfirm",
            }}
            className="w-[8.5rem]"
          />
          <Menu
            label={name}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("catalogue.moreFor", { name })}
              >
                <MoreHorizontal />
              </Button>
            }
            items={[
              {
                label: t("catalogue.openShop"),
                icon: <ExternalLink />,
                onSelect: () => router.push(href),
              },
              // A chain's hours are each branch's, on its own page.
              ...(chain
                ? []
                : [
                    {
                      label: t("catalogue.editHours"),
                      icon: <Clock />,
                      onSelect: () => router.push(`${href}?tab=hours`),
                    },
                  ]),
              "separator",
              {
                label: t("catalogue.archiveShop"),
                icon: <Archive />,
                tone: "danger",
                onSelect: onArchive,
              },
            ]}
          />
        </div>
      </div>

      {chain && expanded && !carried && (
        <ChainBranches store={store} weeks={weeks} />
      )}
    </li>
  );
}

/**
 * Which chains are folded on the shops list, remembered in this browser.
 *
 * Expanded is the default and what the server draws, so a chain nobody has
 * folded never flickers. Stored as the folded ids rather than the open ones
 * for the same reason: a new chain arrives expanded.
 */
const FOLDED_KEY = "lebrunji.shops.foldedChains";
const NONE_FOLDED: ReadonlySet<string> = new Set();
let foldedCache: ReadonlySet<string> | null = null;
const foldedListeners = new Set<() => void>();

function readFolded(): ReadonlySet<string> {
  if (foldedCache) return foldedCache;
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(FOLDED_KEY) ?? "[]",
    );
    if (Array.isArray(parsed)) {
      ids = parsed.filter((one): one is string => typeof one === "string");
    }
  } catch {
    // Storage refused or garbled; every chain starts expanded.
  }
  foldedCache = new Set(ids);
  return foldedCache;
}

function subscribeFolded(listener: () => void) {
  foldedListeners.add(listener);
  return () => {
    foldedListeners.delete(listener);
  };
}

function useCollapsedChains() {
  const folded = useSyncExternalStore(
    subscribeFolded,
    readFolded,
    () => NONE_FOLDED,
  );
  const toggle = useCallback((storeId: string) => {
    const next = new Set(readFolded());
    if (next.has(storeId)) next.delete(storeId);
    else next.add(storeId);
    foldedCache = next;
    try {
      window.localStorage.setItem(FOLDED_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered; the fold still holds for this visit.
    }
    foldedListeners.forEach((listener) => listener());
  }, []);
  return [folded, toggle] as const;
}

/** A chain's branches, as rows under its brand row. */
function ChainBranches({
  store,
  weeks,
}: {
  store: Store;
  weeks: Map<string, DayHours[]> | undefined;
}) {
  const branches = useBranches(store.id);
  const name = pickLocalized(store.name);

  return (
    <div className="border-t border-line bg-subtle/40">
      {branches.isPending ? (
        <div aria-busy className="flex flex-col gap-2 py-3 ps-14 pe-4 sm:ps-28">
          {store.branchIds.map((id) => (
            <Skeleton key={id} className="h-9 w-full max-w-md" />
          ))}
        </div>
      ) : branches.isError ? (
        <div className="flex flex-wrap items-center gap-3 py-2.5 ps-14 pe-4 sm:ps-28">
          <p className="text-[13px] text-danger-ink">{t("branches.failed")}</p>
          <Button size="sm" onClick={() => void branches.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <ul
          aria-label={t("branches.ofShop", { shop: name })}
          className="divide-y divide-line"
        >
          {(branches.data ?? []).map((branch) => (
            <BranchChildRow
              key={branch.id}
              store={store}
              branch={branch}
              // A trading branch the shops query has not caught up with yet
              // is "not read", never "no hours" — that would say open 24h.
              week={
                weeks && store.tradingBranchIds.includes(branch.id)
                  ? (weeks.get(branch.id) ?? [])
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BranchChildRow({
  store,
  branch,
  week,
}: {
  store: Store;
  branch: Branch;
  week: DayHours[] | undefined;
}) {
  const router = useRouter();
  const name = pickLocalized(branch.name);
  const address = branch.address ? pickLocalized(branch.address) : "";
  const href = `/shops/${store.id}/branches/${branch.id}`;

  return (
    <li className="group relative flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 ps-10 pe-3 transition-colors hover:bg-subtle sm:flex-nowrap sm:ps-[4.75rem] sm:pe-4">
      <CornerDownRight
        aria-hidden
        className="size-4 shrink-0 text-ink-4 rtl:-scale-x-100"
      />
      <Thumb
        src={branch.imageUrl ?? store.imageUrl}
        size={32}
        alt=""
        className={cx(!branch.isActive && "opacity-60 grayscale")}
      />
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            className={cx(
              "truncate text-[13.5px] font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent",
              branch.isActive ? "text-ink" : "text-ink-2",
            )}
          >
            {name}
          </Link>
          {branch.currencyCode && (
            <Badge tone="info">{branch.currencyCode}</Badge>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          {address && (
            <span className="max-w-full truncate text-[12.5px] text-ink-3">
              {address}
            </span>
          )}
          <BranchStatusLine
            branch={branch}
            shopActive={store.isActive}
            week={week}
          />
        </div>
      </div>

      <div className="relative z-10 flex w-full shrink-0 items-center justify-end gap-4 sm:w-auto">
        <BranchLiveToggle
          storeId={store.id}
          branch={branch}
          className="w-[7.5rem]"
        />
        <Menu
          label={name}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("catalogue.moreFor", { name })}
            >
              <MoreHorizontal />
            </Button>
          }
          items={[
            {
              label: t("branches.openBranch"),
              icon: <ExternalLink />,
              onSelect: () => router.push(href),
            },
            {
              label: t("branches.editHours"),
              icon: <Clock />,
              onSelect: () => router.push(`${href}?tab=hours`),
            },
            {
              label: t("branches.editDetails"),
              icon: <Pencil />,
              onSelect: () => router.push(`${href}?tab=details`),
            },
          ]}
        />
      </div>
    </li>
  );
}
