"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CircleHelp, Plus, SearchX } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  EmptyState,
  ListSkeleton,
  SearchInput,
  Section,
  cx,
} from "@/components/ui";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { applyOrder } from "@/features/catalog/api/menu";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import { RowMenu, VisibilitySwitch } from "./content-rows";
import { useReturnFocus } from "./settings-parts";
import {
  useDeleteHelpTopic,
  useHelpTopics,
  useReorderHelpTopics,
  useUpdateHelpTopic,
} from "./use-content";

/**
 * The FAQ customers read in the app's Help screen.
 *
 * Searching and reordering cannot both be on: a position among matches is not
 * a position in the FAQ, so dragging while filtered would write a `sort_order`
 * nobody chose. While a search is active the grips go away and the hint with
 * them.
 */
export function HelpTab() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const topics = useHelpTopics(searching ? search : "");
  const update = useUpdateHelpTopic();
  const remove = useDeleteHelpTopic();
  const reorder = useReorderHelpTopics();

  const rows = topics.data ?? [];
  const focus = useReturnFocus(topics.isSuccess);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { updates } = applyOrder(rows, ids);
      reorder.mutate({ updates });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.question ?? {}),
    disabled: searching,
  });

  const count = rows.length;

  return (
    <Section
      title={t("content.helpListTitle")}
      actions={
        <Button asChild variant="primary">
          <Link href="/settings/help/new">
            <Plus />
            {t("content.addTopic")}
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-col gap-1.5 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("content.searchHelp")}
            className="w-full sm:max-w-sm"
          />
          {topics.isSuccess && count > 0 && (
            <span className="text-[12.5px] text-ink-3 tabular-nums sm:ms-auto">
              {count === 1
                ? t("content.helpCountOne")
                : t("content.helpCount", { count })}
            </span>
          )}
        </div>
        {/* Gone when there is nothing to sort — one row, or a filtered list.
            An instruction nobody can follow reads as a broken control. */}
        {order.sortable && (
          <p className="text-[12.5px] text-ink-4">{t("content.reorderHint")}</p>
        )}
      </div>

      {order.instructions}

      {topics.isPending && <ListSkeleton rows={4} />}

      {topics.isError && (
        <EmptyState
          icon={<AlertCircle />}
          title={t("content.failed")}
          action={
            <Button onClick={() => void topics.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      )}

      {topics.isSuccess &&
        count === 0 &&
        (searching ? (
          <EmptyState
            icon={<SearchX />}
            title={t("content.searchNone", { term: search.trim() })}
          />
        ) : (
          <EmptyState
            icon={<CircleHelp />}
            title={t("content.helpEmptyTitle")}
            description={t("content.helpEmptyBody")}
            action={
              <Button asChild variant="primary">
                <Link href="/settings/help/new">
                  <Plus />
                  {t("content.addTopic")}
                </Link>
              </Button>
            }
          />
        ))}

      {count > 0 && (
        <ul className="divide-y divide-line">
          {order
            .ordered(rows, (row) => row.id)
            .map((topic) => {
              const name = pickLocalized(topic.question);
              const href = `/settings/help/${topic.id}`;
              return (
                <li
                  key={topic.id}
                  {...order.rowProps(
                    topic.id,
                    cx(
                      "relative flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-subtle sm:px-5",
                      focus === topic.id && "bg-accent-soft/60",
                    ),
                  )}
                >
                  <button {...order.handleProps(topic.id)}>
                    <GripIcon />
                  </button>

                  <Link
                    href={href}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm"
                  >
                    <span
                      className={cx(
                        "truncate text-[14px] font-medium",
                        topic.isActive ? "text-ink" : "text-ink-3",
                      )}
                    >
                      {name}
                    </span>
                    <span className="truncate text-[12.5px] text-ink-3">
                      {pickLocalized(topic.groupName)}
                    </span>
                  </Link>

                  {!topic.isActive && (
                    <Badge className="max-sm:hidden">
                      {t("content.hidden")}
                    </Badge>
                  )}

                  <VisibilitySwitch
                    name={name}
                    on={topic.isActive}
                    onChange={(next) =>
                      update.mutate({
                        id: topic.id,
                        patch: { isActive: next },
                        name,
                      })
                    }
                  />

                  <RowMenu
                    name={name}
                    onEdit={() => router.push(href)}
                    removeTitle={t("content.removeTopicTitle", { name })}
                    // Says "cannot be undone" and means it: `help_topics` has
                    // no `deleted_at`, so this is a real delete.
                    removeBody={t("content.removeTopicBody")}
                    onRemove={() => remove.mutateAsync({ id: topic.id, name })}
                  />
                </li>
              );
            })}
        </ul>
      )}
    </Section>
  );
}
