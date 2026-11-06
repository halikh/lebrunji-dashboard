"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

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
  Tabs,
  Thumb,
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import type { Promotion } from "../api/promotions";
import { useCategories } from "../use-categories";
import {
  useArchivePromotion,
  usePromotions,
  useReorderPromotions,
  useUpdatePromotion,
} from "../use-promotions";
import { useStores } from "../use-stores";
import {
  SCHEDULE_TONE,
  describeDates,
  scheduleState,
  useNow,
  type ScheduleState,
} from "./schedule";
import { describeTerms } from "./summary";

type Filter = "all" | ScheduleState;
const FILTERS: Filter[] = ["all", "live", "scheduled", "paused", "ended"];

/**
 * Every promotion, in priority order — the order the engine tries them in, so
 * dragging a row is a real decision, not decoration.
 *
 * Each row says, in this order: what it does (one plain sentence), whether it
 * is running (Live / Scheduled / Paused / Ended), its dates, and how often it
 * has been used — the only number that says whether it is *working*.
 *
 * There are no codes: a promotion applies on its own when a basket qualifies.
 *
 * Reordering is off while searching or filtering by status, because a
 * position among a subset is not a priority.
 *
 * Laid out the way Shopify's discount list is: status tabs with counts across
 * the top of one card, search under them, and a row per discount whose title
 * line is its terms. The tab is in the URL (`?status=`), so "everything that
 * has ended" is a link that can be sent and a reload that lands back on it.
 */
export function PromotionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("status") as Filter | null;
  const filter: Filter =
    requested && FILTERS.includes(requested) ? requested : "all";
  const setFilter = (next: Filter) =>
    router.replace(next === "all" ? pathname : `${pathname}?status=${next}`, {
      scroll: false,
    });
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;
  const now = useNow();

  const promotions = usePromotions(searching ? search : "");
  const update = useUpdatePromotion();
  const archive = useArchivePromotion();
  const reorder = useReorderPromotions();
  const { format, baseCode } = useMoney();
  const stores = useStores("");
  const categories = useCategories("");

  const rows = useMemo(() => promotions.data ?? [], [promotions.data]);
  const counts = useMemo(() => {
    const tally: Record<Filter, number> = {
      all: rows.length,
      live: 0,
      scheduled: 0,
      paused: 0,
      ended: 0,
    };
    for (const row of rows) tally[scheduleState(row, now)] += 1;
    return tally;
  }, [rows, now]);

  const filtered = filter !== "all";
  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, priority: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.priority === row.priority
          ? []
          : [{ id: row.id, priority: row.priority }];
      });
      reorder.mutate({ updates, next });
    },
    labelOf: (id) => rows.find((row) => row.id === id)?.slug ?? "",
    disabled: searching || filtered,
  });

  const visible = order
    .ordered(rows, (row) => row.id)
    .filter((row) => !filtered || scheduleState(row, now) === filter);

  function targetNames(promotion: Promotion): string[] {
    return promotion.scopes.flatMap((scope) => {
      if (!scope.targetId) return [];
      if (scope.scopeType === "store") {
        const store = stores.data?.stores.find(
          (one) => one.id === scope.targetId,
        );
        return store ? [pickLocalized(store.name)] : [];
      }
      if (scope.scopeType === "category") {
        const category = categories.data?.find(
          (one) => one.id === scope.targetId,
        );
        return category ? [pickLocalized(category.name)] : [];
      }
      return [];
    });
  }

  function summary(promotion: Promotion): string {
    const types = [...new Set(promotion.scopes.map((s) => s.scopeType))];
    return describeTerms({
      minimum: promotion.minSubtotal
        ? format(promotion.minSubtotal, baseCode)
        : null,
      firstOrderOnly: promotion.isFirstOrderOnly,
      scopeType:
        types.length > 1 ? "mixed" : types.length === 1 ? types[0] : "order",
      targets: targetNames(promotion),
      targetCount: promotion.scopes.filter((scope) => scope.targetId).length,
      // The dates have their own column.
      startsAt: null,
      endsAt: null,
      perUser: null,
      total: null,
    });
  }

  const [archiving, setArchiving] = useState<Promotion | null>(null);

  return (
    <Page>
      <PageHeader
        title={t("promotions.tab")}
        description={t("promotions.blurb")}
        actions={
          <Button variant="primary" asChild>
            <Link href="/promotions/new">
              <Plus />
              {t("promotions.add")}
            </Link>
          </Button>
        }
      />

      <ListCard
        tabs={
          <Tabs
            items={FILTERS.map((key) => ({
              key,
              label: promotions.isSuccess
                ? t(`promotions.filters.${key}`, { count: counts[key] })
                : t(`promotions.status.${key}`),
            }))}
            value={filter}
            onChange={setFilter}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("promotions.search")}
          />
        }
        filters={
          <p className="text-[12.5px] text-ink-3">
            {searching || filtered
              ? t("promotions.reorderOff")
              : order.sortable
                ? t("promotions.reorderHint")
                : t("promotions.searchHint")}
          </p>
        }
      >
        {promotions.isPending ? (
          <ListSkeleton rows={4} />
        ) : promotions.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("promotions.failedTitle")}
            description={
              promotions.error instanceof Error
                ? promotions.error.message
                : t("common.loadFailed")
            }
            action={
              <Button onClick={() => void promotions.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : rows.length === 0 && !searching ? (
          <EmptyState
            icon={<Percent />}
            title={t("promotions.emptyTitle")}
            description={t("promotions.emptyBody")}
            action={
              <Button variant="primary" asChild>
                <Link href="/promotions/new">
                  <Plus />
                  {t("promotions.add")}
                </Link>
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={
              searching
                ? t("promotions.searchNone", { term: search.trim() })
                : t("promotions.noneInFilter")
            }
            description={t("promotions.noneInFilterBody")}
          />
        ) : (
          <>
            {order.instructions}
            <div className="hidden grid-cols-[28px_minmax(0,1fr)_120px_170px_110px_auto] items-center gap-4 border-b border-line bg-subtle px-4 py-2 text-[12px] font-medium text-ink-3 lg:grid">
              <span />
              <span>{t("promotions.columns.promotion")}</span>
              <span>{t("promotions.columns.status")}</span>
              <span>{t("promotions.columns.dates")}</span>
              <span className="text-end">{t("promotions.columns.used")}</span>
              <span className="w-[150px]" />
            </div>
            <ul className="divide-y divide-line">
              {visible.map((row) => {
                const state = scheduleState(row, now);
                const href = `/promotions/${row.id}`;
                const capped =
                  row.maxRedemptionsTotal !== null &&
                  row.redeemed >= row.maxRedemptionsTotal;
                return (
                  <li
                    key={row.id}
                    {...order.rowProps(
                      row.id,
                      "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface px-3 py-3 sm:px-4 lg:grid-cols-[28px_minmax(0,1fr)_120px_170px_110px_auto] lg:gap-x-4",
                    )}
                  >
                    <span className="relative flex w-7 justify-center">
                      <button {...order.handleProps(row.id)}>
                        <GripIcon />
                      </button>
                    </span>

                    <Link
                      href={href}
                      className="flex min-w-0 items-center gap-3 rounded-md"
                    >
                      <Thumb src={row.pictureUrl} size={44} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[14px] font-medium text-ink">
                          {row.slug}
                        </span>
                        <span className="line-clamp-2 text-[12.5px] text-ink-3">
                          {summary(row)}
                        </span>
                      </span>
                    </Link>

                    <div className="col-start-2 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:contents">
                      <span>
                        <Badge tone={SCHEDULE_TONE[state]} dot>
                          {t(`promotions.status.${state}`)}
                        </Badge>
                      </span>
                      <span className="text-[12.5px] text-ink-2">
                        {describeDates(row, {
                          between: "promotions.between",
                          until: "promotions.until",
                          from: "promotions.from",
                          always: "promotions.noEnd",
                        })}
                      </span>
                      <span
                        className={cx(
                          "text-[12.5px] tabular-nums lg:text-end",
                          capped
                            ? "font-medium text-warning-ink"
                            : "text-ink-3",
                        )}
                      >
                        {row.maxRedemptionsTotal
                          ? t("promotions.redeemedOf", {
                              count: row.redeemed,
                              cap: row.maxRedemptionsTotal,
                            })
                          : t("promotions.redeemed", {
                              count: row.redeemed,
                            })}
                      </span>
                    </div>

                    <div className="col-start-3 row-start-1 flex items-center justify-end gap-1 lg:col-start-auto lg:row-start-auto lg:w-[150px] lg:gap-2">
                      <ConfirmToggle
                        className="[&>span:last-child]:hidden"
                        on={row.isActive}
                        onChange={() =>
                          update.mutate({
                            id: row.id,
                            patch: { isActive: !row.isActive },
                          })
                        }
                        labelOn={t("promotions.live")}
                        labelOff={t("promotions.hidden")}
                        params={{ name: row.slug }}
                        whenTurningOn={{
                          titleKey: "promotions.showTitle",
                          bodyKey: "promotions.showBody",
                          confirmKey: "promotions.showConfirm",
                        }}
                        whenTurningOff={{
                          titleKey: "promotions.hideTitle",
                          bodyKey: "promotions.hideBody",
                          confirmKey: "promotions.hideConfirm",
                        }}
                      />
                      <Menu
                        label={row.slug}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("promotions.actionsFor", {
                              name: row.slug,
                            })}
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
                            label: t("promotions.archive"),
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
        title={t("promotions.archiveTitle", { name: archiving?.slug ?? "" })}
        description={t("promotions.archiveBody")}
        confirmLabel={t("promotions.archiveConfirm")}
        onConfirm={async () => {
          if (!archiving) return;
          await archive
            .mutateAsync({ id: archiving.id, name: archiving.slug })
            .catch(() => undefined);
        }}
      />
    </Page>
  );
}
