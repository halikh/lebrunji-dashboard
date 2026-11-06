"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
} from "lucide-react";
import { useCallback, useState } from "react";

import {
  Button,
  ConfirmDialog,
  Dialog,
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
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import type { Category } from "../api/categories";
import { applyOrder } from "../api/menu";
import {
  useArchiveCategory,
  useCategories,
  useCategoryKinds,
  useReorderCategories,
  useUpdateCategory,
} from "../use-categories";
import { CategorySheet } from "./category-sheet";

/**
 * The tiles on the app's home screen.
 *
 * The order is the point of this screen: the app sorts categories by
 * `sort_order`, so dragging a row decides what a customer sees first. That is
 * why the list is the page and editing happens in a sheet over it — a category
 * is a short record (a name, a kind, an icon, two switches), and the operator
 * should not lose their place in the order to change one.
 *
 * Searching and reordering cannot both be on: a position among matches is not
 * a position on the home screen. The handles go while a term is typed, and the
 * hint says so before anyone tries.
 *
 * The open sheet lives in the URL (`?edit=<id>` or `?edit=new`), so a link to
 * one category opens it and a refresh lands where it left off.
 *
 * Like Square's item categories and Shopify's collections: one row per
 * category with how much is in it, Live/Hidden tabs with counts so the hidden
 * ones can be found without scanning, and the order set by dragging.
 */
type Filter = "all" | "live" | "hidden";
const FILTERS: Filter[] = ["all", "live", "hidden"];

export function CategoriesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editing = params.get("edit");

  const setEditing = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?edit=${id}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const searching = search.trim().length >= SEARCH.minTerm;

  const categories = useCategories(searching ? search : "");
  const kinds = useCategoryKinds();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const reorder = useReorderCategories();

  const rows = categories.data ?? [];
  const counts: Record<Filter, number> = {
    all: rows.length,
    live: rows.filter((row) => row.isActive).length,
    hidden: rows.filter((row) => !row.isActive).length,
  };
  const keep = (row: Category) =>
    filter === "all" || (filter === "live") === row.isActive;
  const kindName = (id: string) =>
    pickLocalized(kinds.data?.find((kind) => kind.id === id)?.name);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = applyOrder(rows, ids);
      reorder.mutate({ updates, next });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
    disabled: searching || filter !== "all",
  });

  const [archiving, setArchiving] = useState<Category | null>(null);

  return (
    <Page>
      <PageHeader
        title={t("categories.tab")}
        description={t("categories.blurb")}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus />
            {t("categories.add")}
          </Button>
        }
      />

      <ListCard
        tabs={
          <Tabs
            items={FILTERS.map((key) => ({
              key,
              label: categories.isSuccess
                ? t(`categories.filters.${key}`, { count: counts[key] })
                : t(`categories.filterNames.${key}`),
            }))}
            value={filter}
            onChange={setFilter}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("categories.search")}
          />
        }
        filters={
          <p className="text-[12.5px] text-ink-3">
            {searching || filter !== "all"
              ? t("categories.reorderOffFiltered")
              : order.sortable
                ? t("categories.reorderHint")
                : null}
          </p>
        }
      >
        {categories.isPending ? (
          <ListSkeleton rows={5} />
        ) : categories.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("categories.failedTitle")}
            description={t("common.loadFailed")}
            action={
              <Button onClick={() => void categories.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : rows.filter(keep).length === 0 ? (
          rows.length > 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={t("categories.noneInFilter")}
            />
          ) : searching ? (
            <EmptyState
              icon={<SearchX />}
              title={t("categories.searchNone", { term: search.trim() })}
              description={t("categories.searchNoneBody")}
            />
          ) : (
            <EmptyState
              icon={<FolderTree />}
              title={t("categories.emptyTitle")}
              description={t("categories.emptyBody")}
              action={
                <Button variant="primary" onClick={() => setEditing("new")}>
                  <Plus />
                  {t("categories.add")}
                </Button>
              }
            />
          )
        ) : (
          <>
            {order.instructions}
            <ul className="divide-y divide-line">
              {order
                .ordered(rows, (row) => row.id)
                .filter(keep)
                .map((row) => {
                  const name = pickLocalized(row.name);
                  const props = order.rowProps(
                    row.id,
                    cx(
                      "flex items-center gap-3 bg-surface px-3 py-2.5 sm:px-4",
                      editing === row.id && "bg-accent-soft/50",
                    ),
                  );
                  return (
                    <li key={row.id} {...props}>
                      <span className="relative flex w-7 shrink-0 justify-center">
                        <button {...order.handleProps(row.id)}>
                          <GripIcon />
                        </button>
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditing(row.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start focus-visible:outline-offset-4"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-subtle">
                          {row.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.iconUrl}
                              alt=""
                              className="size-7 object-contain"
                            />
                          ) : (
                            <Thumb src={null} size={28} />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-[14px] font-medium text-ink">
                            {name}
                          </span>
                          <span className="truncate text-[12.5px] text-ink-3">
                            {[
                              kindName(row.kindId),
                              row.usedBy === 0
                                ? t("categories.unused")
                                : t("categories.usedBy", {
                                    count: row.usedBy,
                                  }),
                              row.hasMenuNav
                                ? null
                                : t("categories.noMenuTabs"),
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                        <ConfirmToggle
                          className="max-sm:[&>span:last-child]:hidden sm:min-w-[96px]"
                          on={row.isActive}
                          onChange={() =>
                            update.mutate({
                              id: row.id,
                              patch: { isActive: !row.isActive },
                            })
                          }
                          labelOn={t("categories.live")}
                          labelOff={t("categories.hidden")}
                          params={{ name }}
                          whenTurningOn={{
                            titleKey: "categories.showTitle",
                            bodyKey: "categories.showBody",
                            confirmKey: "categories.showConfirm",
                          }}
                          whenTurningOff={{
                            titleKey: "categories.hideTitle",
                            bodyKey: "categories.hideBody",
                            confirmKey: "categories.hideConfirm",
                          }}
                        />
                        <Menu
                          label={name}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("categories.actionsFor", {
                                name,
                              })}
                            >
                              <MoreHorizontal />
                            </Button>
                          }
                          items={[
                            {
                              label: t("common.edit"),
                              icon: <Pencil />,
                              onSelect: () => setEditing(row.id),
                            },
                            "separator",
                            {
                              label: t("categories.archive"),
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

      <CategorySheet
        editing={editing}
        sortOrder={rows.length}
        onClose={() => setEditing(null)}
      />

      {/* A category with shops in it cannot be archived — `stores.category_id`
          is not null. Said before the attempt rather than as a refusal after
          it, with nothing to confirm. */}
      {archiving && archiving.usedBy > 0 ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setArchiving(null)}
          size="sm"
          title={t("categories.cannotArchiveTitle", {
            name: pickLocalized(archiving.name),
          })}
          description={t("categories.stillHasShops", {
            count: archiving.usedBy,
          })}
          footer={
            <Button onClick={() => setArchiving(null)}>
              {t("common.close")}
            </Button>
          }
        />
      ) : (
        <ConfirmDialog
          open={archiving !== null}
          onOpenChange={(open) => !open && setArchiving(null)}
          tone="danger"
          title={t("categories.archiveTitle", {
            name: pickLocalized(archiving?.name),
          })}
          description={t("categories.archiveBody")}
          confirmLabel={t("categories.archiveConfirm")}
          onConfirm={async () => {
            if (!archiving) return;
            if (editing === archiving.id) setEditing(null);
            // A refusal is toasted by the hook; the dialog closes either way.
            await archive
              .mutateAsync({ id: archiving.id, name: archiving.name })
              .catch(() => undefined);
          }}
        />
      )}
    </Page>
  );
}
