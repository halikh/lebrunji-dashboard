"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ListCard,
  ListSkeleton,
  Menu,
  SearchInput,
  Tabs,
  Thumb,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import { offSaleItems, separatePrice, type Bundle } from "../api/bundles";
import { describeDates, useNow } from "../promotions/schedule";
import {
  useArchiveBundle,
  useBundles,
  useReorderBundles,
  useToggleBundle,
} from "../use-bundles";
import {
  BUNDLE_TONE,
  bundleState,
  describeContents,
  type BundleState,
} from "./bundle-status";

type Filter = "all" | BundleState;
// "Not showing" next to All: it is the one that needs somebody to act.
const FILTERS: Filter[] = [
  "all",
  "notShowing",
  "live",
  "scheduled",
  "paused",
  "ended",
];

/**
 * Bundles — several of a shop's dishes sold together for one price.
 *
 * Used twice: on `/bundles` across every shop (optionally narrowed to one),
 * and on a shop's own Bundles tab (`storeId` fixed, `fromShop` set, so the
 * editor returns there).
 *
 * The row's badge is the truth for a customer, not the switch: a bundle that
 * is on but holds a dish taken off the menu is not in the app (QA-021), and
 * it says so in warning colour with the dishes named — the fix is on the menu
 * or in the bundle, and the row says which dishes.
 *
 * Shaped like an offers list in Uber Eats Manager or Deliveroo Hub: status
 * tabs with counts (the empty ones drop out, so the strip only names states
 * that exist), and on each row the price, what it would cost separately, and
 * the saving as a percentage — the number a customer decides on.
 */
export function BundlesList({
  storeId = "",
  fromShop = false,
  toolbarEnd,
}: {
  /** Narrows to one shop. Empty for every shop. */
  storeId?: string;
  /** Inside a shop page: links carry `?store=` so Save returns to the tab. */
  fromShop?: boolean;
  /** Extra controls at the end of the toolbar — the shop filter on `/bundles`. */
  toolbarEnd?: ReactNode;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searching = search.trim().length >= SEARCH.minTerm;
  const now = useNow();
  const { format } = useMoney();

  const bundles = useBundles(searching ? search : "", storeId);
  const toggle = useToggleBundle();
  const archive = useArchiveBundle();
  const reorder = useReorderBundles();

  const rows = useMemo(() => bundles.data ?? [], [bundles.data]);
  const suffix = fromShop && storeId ? `?store=${storeId}` : "";
  const newHref = storeId
    ? `/bundles/new?${fromShop ? "store" : "shop"}=${storeId}`
    : "/bundles/new";

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, sortOrder: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.sortOrder === row.sortOrder
          ? []
          : [{ id: row.id, sortOrder: row.sortOrder }];
      });
      reorder.mutate({ updates, next, storeId });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
    disabled: searching || filter !== "all",
  });

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = {
      all: rows.length,
      live: 0,
      scheduled: 0,
      ended: 0,
      paused: 0,
      notShowing: 0,
    };
    for (const row of rows) tally[bundleState(row, now)] += 1;
    return tally;
  }, [rows, now]);
  const notShowing = counts.notShowing;
  const visible = order
    .ordered(rows, (row) => row.id)
    .filter((row) => filter === "all" || bundleState(row, now) === filter);

  const [archiving, setArchiving] = useState<Bundle | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ListCard
        tabs={
          rows.length > 0 ? (
            <Tabs
              items={FILTERS.filter(
                (key) => key === "all" || key === filter || counts[key] > 0,
              ).map((key) => ({
                key,
                label: t("bundles.filterCount", {
                  label:
                    key === "all"
                      ? t("bundles.filterAll")
                      : t(`bundles.status.${key}`),
                  count: counts[key],
                }),
              }))}
              value={filter}
              onChange={setFilter}
            />
          ) : undefined
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("bundles.search")}
          />
        }
        filters={
          <>
            {toolbarEnd}
            {fromShop && (
              <Button variant="primary" asChild>
                <Link href={newHref}>
                  <Plus />
                  {t("bundles.add")}
                </Link>
              </Button>
            )}
          </>
        }
        footer={
          rows.length > 1 || notShowing > 0 ? (
            <>
              <span>
                {searching || filter !== "all"
                  ? t("bundles.reorderOffFiltered")
                  : order.sortable
                    ? t("bundles.reorderHint")
                    : t("bundles.intro")}
              </span>
              {notShowing > 0 && filter !== "notShowing" && (
                <button
                  type="button"
                  onClick={() => setFilter("notShowing")}
                  className="inline-flex items-center gap-1.5 font-medium text-warning-ink hover:underline"
                >
                  <TriangleAlert className="size-3.5" />
                  {t("bundles.notShowingCount", { count: notShowing })}
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {bundles.isPending ? (
          <ListSkeleton rows={4} />
        ) : bundles.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("bundles.failedTitle")}
            description={
              bundles.error instanceof Error
                ? bundles.error.message
                : t("common.loadFailed")
            }
            action={
              <Button onClick={() => void bundles.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          rows.length > 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={t("bundles.noneInFilter")}
              description={t("bundles.noneInFilterBody")}
            />
          ) : searching ? (
            <EmptyState
              icon={<SearchX />}
              title={t("bundles.searchNone", { term: search.trim() })}
              description={t("bundles.searchNoneBody")}
            />
          ) : (
            <EmptyState
              icon={<Package />}
              title={t("bundles.emptyTitle")}
              description={t("bundles.none")}
              action={
                <Button variant="primary" asChild>
                  <Link href={newHref}>
                    <Plus />
                    {t("bundles.add")}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            {order.instructions}
            <ul className="divide-y divide-line">
              {visible.map((row) => {
                const name = pickLocalized(row.name);
                const state = bundleState(row, now);
                const href = `/bundles/${row.id}${suffix}`;
                const separately = separatePrice(row.items);
                const offSale = offSaleItems(row);
                return (
                  <li
                    key={row.id}
                    {...order.rowProps(
                      row.id,
                      "flex items-start gap-3 bg-surface px-3 py-3 sm:px-4",
                    )}
                  >
                    <span className="relative mt-2.5 flex w-7 shrink-0 justify-center">
                      <button {...order.handleProps(row.id)}>
                        <GripIcon />
                      </button>
                    </span>

                    <Link
                      href={href}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-md"
                    >
                      <Thumb src={row.imageUrl} size={48} />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-[14px] font-medium text-ink">
                            {name}
                          </span>
                          {!storeId && (
                            <span className="truncate text-[13px] text-ink-3">
                              {row.storeName}
                            </span>
                          )}
                          <Badge tone={BUNDLE_TONE[state]} dot>
                            {t(`bundles.status.${state}`)}
                          </Badge>
                        </span>
                        <span className="line-clamp-2 text-[12.5px] text-ink-2">
                          {describeContents(row)}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
                          <span className="font-medium text-ink tabular-nums">
                            {format(row.price, row.currencyCode)}
                          </span>
                          {separately > row.price && (
                            <>
                              <span className="tabular-nums line-through">
                                {format(separately, row.currencyCode)}
                              </span>
                              <Badge tone="danger">
                                {t("bundles.savePercent", {
                                  percent: Math.round(
                                    ((separately - row.price) / separately) *
                                      100,
                                  ),
                                })}
                              </Badge>
                            </>
                          )}
                          {/* Pulled back across the gap so it hugs the price. */}
                          <span aria-hidden className="-ms-2">
                            ,
                          </span>
                          <span>
                            {describeDates(row, {
                              between: "bundles.between",
                              until: "bundles.until",
                              from: "bundles.from",
                              always: "bundles.always",
                            })}
                          </span>
                        </span>
                        {row.isActive && offSale.length > 0 && (
                          <span className="text-[12.5px] font-medium text-warning-ink">
                            {t("bundles.offSale", {
                              dishes: offSale
                                .map((item) => item.label)
                                .join(", "),
                            })}
                          </span>
                        )}
                      </span>
                    </Link>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      <ConfirmToggle
                        className="[&>span:last-child]:hidden"
                        on={row.isActive}
                        onChange={() =>
                          toggle.mutate({
                            id: row.id,
                            isActive: !row.isActive,
                          })
                        }
                        labelOn={t("bundles.live")}
                        labelOff={t("bundles.hidden")}
                        params={{ name }}
                        whenTurningOn={{
                          titleKey: "bundles.showTitle",
                          bodyKey: "bundles.showBody",
                          confirmKey: "bundles.showConfirm",
                        }}
                        whenTurningOff={{
                          titleKey: "bundles.hideTitle",
                          bodyKey: "bundles.hideBody",
                          confirmKey: "bundles.hideConfirm",
                        }}
                      />
                      <Menu
                        label={name}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("bundles.actionsFor", { name })}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                        items={[
                          {
                            label: t("common.edit"),
                            icon: <Pencil />,
                            onSelect: () => router.push(href),
                          },
                          "separator",
                          {
                            label: t("bundles.archive"),
                            icon: <Archive />,
                            tone: "danger",
                            onSelect: () => setArchiving(row),
                          },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ListCard>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        tone="danger"
        title={t("bundles.archiveTitle", {
          name: pickLocalized(archiving?.name),
        })}
        description={t("bundles.archiveBody")}
        confirmLabel={t("bundles.archiveConfirm")}
        onConfirm={async () => {
          if (!archiving) return;
          await archive
            .mutateAsync({
              id: archiving.id,
              name: pickLocalized(archiving.name),
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
