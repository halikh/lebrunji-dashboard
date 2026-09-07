"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { ListHeader } from "@/components/ui/list-header";
import { ROW } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { useRowFocus } from "@/components/ui/row-focus";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import type { Tag } from "./api/tags";
import { TagChip } from "./tag-chip";
import { useArchiveTag, useTags, useUpdateTag } from "./use-tags";

/**
 * The tag vocabulary — the chips a dish can be given.
 *
 * ## Why there is no ordering here
 *
 * There used to be: rows were dragged, and a tag's position was a property of
 * the vocabulary rather than of a dish. It was removed because the result was
 * never visible. The app shows two or three chips on one dish, never the
 * vocabulary end to end, so an operator arranging fifty tags was doing careful
 * work whose only effect was which of two chips came first.
 *
 * Newest first instead. The reason to open this screen is almost always a tag
 * just added — to check it, rename it, fix its tone — so the row wanted is the
 * one at the top rather than one to be found. See `fetchTags`.
 *
 * ## Retiring one is safe, and the count is what makes that clear
 *
 * Unlike a category, a tag can be retired while it is in use — nothing
 * references it from `menu_items`, so the only effect is chips disappearing.
 * The row carries "on 34 dishes" and the confirmation repeats it, because
 * "Archive Spicy" and "Archive Spicy, which is on 34 dishes" are different
 * questions and only the second one can be answered.
 *
 * The links survive the retirement, so switching a tag back on restores it to
 * every dish that had it rather than asking for thirty-four re-tags.
 */
export function TagsList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const tags = useTags(searching ? search : "");
  const update = useUpdateTag();
  const archive = useArchiveTag();

  /**
   * The row the panel is editing, or `"new"` while one is being added.
   *
   * Any action on a row closes it — the rule every list here follows. A form
   * open beside the list holds a copy of a row as it was when it opened, so one
   * left open after a switch is flipped is either showing a row that has
   * changed or is about to save values from before it.
   */
  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const rows = tags.data ?? [];

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The action is repeated here and at the end of the list: the end is
            where a new row appears, and the bar is how it stays reachable while
            the end is out of sight. */}
        <ListHeader
          title={t("tags.tab")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("tags.search"),
          }}
          action={
            <Button onClick={() => router.push("/catalogue/tags/new")}>
              {t("tags.add")}
            </Button>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {/* What the list is for, said once at the top. A vocabulary screen
              with no explanation reads as a settings table; the sentence is
              what makes "Popular" here and a chip on a phone the same thing. */}
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("tags.blurb")}
          </p>

          {tags.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="h-[58px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {tags.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <h2 className="text-[18px]">{t("tags.failedTitle")}</h2>
              <Button variant="secondary" onClick={() => void tags.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {rows.map((row) => (
            <Row
              key={row.id}
              tag={row}
              open={focus.isFocused(row.id)}
              anchor={focus.attach(row.id)}
              onEdit={() => router.push(`/catalogue/tags/${row.id}`)}
              onToggleActive={() => {
                update.mutate({
                  id: row.id,
                  patch: { isActive: !row.isActive },
                });
              }}
              onArchive={async () => {
                await archive.mutateAsync({ id: row.id, name: row.name });
              }}
            />
          ))}

          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="tags.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  tag,
  open,
  anchor,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  tag: Tag;
  /** Whether this is the row just returned from. Draws the ring. */
  open: boolean;
  /** Scrolls this row back into view when it is the one returned to. */
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
}) {
  const name = pickLocalized(tag.name);

  const className = cx(
    ROW,
    // Marked, not dimmed — fading a row takes its controls with it, and a
    // faded button reads as a disabled one.
    !tag.isActive && "border-danger-wash bg-danger-wash/30",
      tag.isActive && "border-border",
    tag.isActive && open && "border-active",
  );

  return (
    <div className={className} ref={anchor}>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow items-center gap-md text-left"
      >
        {/* The chip itself, at the size a phone draws it. The row shows the
            thing rather than describing it — a tone named in words would ask
            the operator to picture the result of their own setting. */}
        <TagChip label={name} tone={tag.tone} ink={tag.ink} color={tag.color} />

        <span className="truncate text-[12px] text-text-faint">
          {tag.usedBy === 0
            ? t("tags.unused")
            : t("tags.usedBy", { count: tag.usedBy })}
        </span>
      </button>

      <ConfirmToggle
        on={tag.isActive}
        onChange={onToggleActive}
        labelOn={t("tags.live")}
        labelOff={t("tags.hidden")}
        params={{ name, count: tag.usedBy }}
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
        className="w-[104px]"
      />

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="tags.archiveTitle"
        bodyKey="tags.archiveBody"
        confirmKey="tags.archiveConfirm"
        params={{ name, count: tag.usedBy }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("tags.archive")}
      </ConfirmButton>
    </div>
  );
}
