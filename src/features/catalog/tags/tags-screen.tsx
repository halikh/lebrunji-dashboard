"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Tags,
} from "lucide-react";
import { useCallback, useState } from "react";

import {
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
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import type { Tag } from "../api/tags";
import { useArchiveTag, useTags, useUpdateTag } from "../use-tags";
import { TagChip } from "./tag-chip";
import { TagSheet } from "./tag-sheet";

/**
 * The tag vocabulary — the chips a dish can carry.
 *
 * Newest first, with no ordering: the app shows two or three chips on a dish,
 * never the vocabulary end to end, and the tag an operator opens this for is
 * almost always the one just added.
 *
 * A tag can be retired while in use — nothing references it from a dish row —
 * so every row says how many dishes carry it, and the confirmations repeat the
 * number. "Archive Spicy" and "Archive Spicy, on 34 dishes" are different
 * questions. The links survive, so bringing it back restores every chip.
 *
 * Like Linear's labels or Shopify's tag manager: the vocabulary as one list,
 * each with how often it is used, and an Unused tab, which is where a tidy-up
 * starts.
 */
type Filter = "all" | "live" | "hidden" | "unused";
const FILTERS: Filter[] = ["all", "live", "hidden", "unused"];

function matches(row: Tag, key: Filter): boolean {
  if (key === "live") return row.isActive;
  if (key === "hidden") return !row.isActive;
  if (key === "unused") return row.usedBy === 0;
  return true;
}

export function TagsScreen() {
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

  const tags = useTags(searching ? search : "");
  const update = useUpdateTag();
  const archive = useArchiveTag();
  const all = tags.data ?? [];
  const rows = all.filter((row) => matches(row, filter));

  const [archiving, setArchiving] = useState<Tag | null>(null);

  return (
    <Page>
      <PageHeader
        title={t("tags.tab")}
        description={t("tags.blurb")}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus />
            {t("tags.add")}
          </Button>
        }
      />

      <ListCard
        tabs={
          <Tabs
            items={FILTERS.map((key) => ({
              key,
              label: tags.isSuccess
                ? t(`tags.filters.${key}`, {
                    count: all.filter((row) => matches(row, key)).length,
                  })
                : t(`tags.filterNames.${key}`),
            }))}
            value={filter}
            onChange={setFilter}
          />
        }
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("tags.search")}
          />
        }
      >
        {tags.isPending ? (
          <ListSkeleton rows={6} />
        ) : tags.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("tags.failedTitle")}
            description={t("common.loadFailed")}
            action={
              <Button onClick={() => void tags.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          all.length > 0 ? (
            <EmptyState icon={<SearchX />} title={t("tags.noneInFilter")} />
          ) : searching ? (
            <EmptyState
              icon={<SearchX />}
              title={t("tags.searchNone", { term: search.trim() })}
              description={t("tags.searchNoneBody")}
            />
          ) : (
            <EmptyState
              icon={<Tags />}
              title={t("tags.emptyTitle")}
              description={t("tags.emptyBody")}
              action={
                <Button variant="primary" onClick={() => setEditing("new")}>
                  <Plus />
                  {t("tags.add")}
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const name = pickLocalized(row.name);
              return (
                <li
                  key={row.id}
                  className={cx(
                    "flex items-center gap-3 px-4 py-2.5",
                    editing === row.id && "bg-accent-soft/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md py-0.5 text-start sm:flex-row sm:items-center sm:gap-4"
                  >
                    <TagChip label={name} iconUrl={row.iconUrl} size="lg" />
                    <span
                      className={cx(
                        "truncate text-[12.5px]",
                        row.usedBy === 0 ? "text-ink-4" : "text-ink-3",
                      )}
                    >
                      {row.usedBy === 0
                        ? t("tags.unused")
                        : t("tags.usedBy", { count: row.usedBy })}
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
                      labelOn={t("tags.live")}
                      labelOff={t("tags.hidden")}
                      params={{ name, count: row.usedBy }}
                      whenTurningOn={{
                        titleKey: "tags.showTitle",
                        bodyKey: "tags.showBody",
                        confirmKey: "tags.showConfirm",
                      }}
                      whenTurningOff={{
                        titleKey: "tags.hideTitle",
                        bodyKey: "tags.hideBody",
                        confirmKey: "tags.hideConfirm",
                      }}
                    />
                    <Menu
                      label={name}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("tags.actionsFor", { name })}
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
                          label: t("tags.archive"),
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
        )}
      </ListCard>

      <TagSheet editing={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        tone="danger"
        title={t("tags.archiveTitle", {
          name: pickLocalized(archiving?.name),
        })}
        description={t("tags.archiveBody", { count: archiving?.usedBy ?? 0 })}
        confirmLabel={t("tags.archiveConfirm")}
        onConfirm={async () => {
          if (!archiving) return;
          if (editing === archiving.id) setEditing(null);
          await archive
            .mutateAsync({ id: archiving.id, name: archiving.name })
            .catch(() => undefined);
        }}
      />
    </Page>
  );
}
