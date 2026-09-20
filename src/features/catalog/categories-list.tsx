"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { ListHeader } from "@/components/ui/list-header";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { PreviewImage } from "@/components/ui/image-preview";
import { useRowFocus } from "@/components/ui/row-focus";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { CATEGORY_ICONS, type CategoryIconName } from "@/lib/category-icons";

import { applyOrder } from "./api/menu";
import type { Category } from "./api/categories";
import {
  useArchiveCategory,
  useCategories,
  useReorderCategories,
  useUpdateCategory,
} from "./use-categories";

/**
 * The tiles on the app's home screen.
 *
 * ## Why the order matters more than anything else here
 *
 * A category is what a customer picks before they pick a shop, and the app
 * orders by `sort_order` — as the primary order when browsing, and as the
 * tiebreak everywhere else. So dragging a row is not decoration: it is the one
 * control on this screen that decides what a customer sees first.
 *
 * That is why the list is the screen and the form is a panel beside it, rather
 * than the other way round.
 *
 * ## The form is a page, and used to be a panel
 *
 * The flow study called for editing inline, in the row. A category carries two
 * languages of name, a kind and three switches, and growing a row to fit that
 * reflows every row beneath it — so it moved out, first into a panel beside the
 * list and now onto a route of its own.
 *
 * What the panel was protecting was never editing *within* the row: it was not
 * losing your place. That is kept without it — the editor hands back the id it
 * was working on and `useRowFocus` brings the row into view. What is gained is
 * a URL: a link that can be sent, a refresh that lands where it left off, and a
 * back button that means what it says.
 */
export function CategoriesList() {
  const router = useRouter();
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering are different jobs on one list and cannot both be
   * on: a position among matches is not a position on the home screen, so
   * dragging while filtered would write a `sort_order` nobody chose. The
   * handles go away and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const categories = useCategories(searching ? search : "");
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const reorder = useReorderCategories();

  const rows = categories.data ?? [];

  /**
   * Which row to bring back into view.
   *
   * Set by the editor on its way out — see `useRowFocus`. It is what replaces
   * the one thing the side panel was genuinely good at: not losing your place.
   */
  const focus = useRowFocus();

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = applyOrder(rows, ids);
      reorder.mutate({ updates, next });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The action is repeated here and at the end of the list: the end is
            where a new row appears, and the bar is how it stays reachable while
            the end is out of sight. */}
        <ListHeader
          title={t("categories.tab")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("categories.search"),
          }}
          // Gone when there is nothing to sort — one row, or a filtered
          // list. See `sortable` on `useReorder`.
          hint={order.sortable ? t("categories.reorderHint") : undefined}
          action={
            <Button onClick={() => router.push("/catalogue/categories/new")}>
              {t("categories.add")}
            </Button>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {categories.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="h-[66px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {categories.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <h2 className="text-[18px]">{t("categories.failedTitle")}</h2>
              <Button
                variant="secondary"
                onClick={() => void categories.refetch()}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          {order.instructions}

          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                category={row}
                open={focus.isFocused(row.id)}
                anchor={focus.attach(row.id)}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => router.push(`/catalogue/categories/${row.id}`)}
                onToggleActive={() =>
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  })
                }
                onArchive={async () => {
                  await archive.mutateAsync({ id: row.id, name: row.name });
                }}
              />
            ))}

          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="categories.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}
        </div>
      </div>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function Row({
  category,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  category: Category;
  /** Whether this is the row just returned from. Draws the ring. */
  open: boolean;
  /** Scrolls this row back into view when it is the one returned to. */
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const row = rowProps(
    category.id,
    cx(
      ROW,
      // Marked, not dimmed — fading a row takes its controls with it, and a
      // faded button reads as a disabled one.
      !category.isActive && "border-danger-wash bg-danger-wash/30",
      category.isActive && "border-border",
      category.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(category.id)}>
        <GripIcon />
      </button>

      {/* Above it too, so the picture still opens its own lightbox rather than
          the editor — a preview is a different intent from an edit. */}
      <span className={ROW_ABOVE}>
        <Artwork category={category} name={pickLocalized(category.name)} />
      </span>

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` makes the whole row the hit area while this button stays
        // the control, so the accessible name is the category's and there is
        // one tab stop. See `row.ts`.
        className={cx(
          "flex min-w-0 flex-grow items-center gap-md text-left",
          ROW_TARGET,
        )}
      >
        <span className="truncate text-[15px] font-semibold">
          {pickLocalized(category.name)}
        </span>

        {/* How many shops are in it — the same line the tags list puts beside a
            chip, and here it answers the question the Archive button is about
            to refuse on. `stillHasShops` says the number after the attempt;
            this says it before. */}
        <span className="shrink-0 truncate text-[12px] text-text-faint">
          {category.usedBy === 0
            ? t("categories.unused")
            : t("categories.usedBy", { count: category.usedBy })}
        </span>
      </button>

      {/* Under each other, so a row stays one line high whatever the labels
          say — the same arrangement the shop list uses. `ROW_ABOVE` keeps them
          above the name's stretched hit area. */}
      <div className={cx(ROW_ABOVE, "flex shrink-0 flex-col gap-xs")}>
        <ConfirmToggle
          on={category.isActive}
          onChange={onToggleActive}
          labelOn={t("categories.live")}
          labelOff={t("categories.hidden")}
          params={{ name: pickLocalized(category.name) }}
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
          className="w-[104px]"
        />
      </div>

      {/* Above the stretched target as well — archiving is the one action on
          this row that must never be reached by a stray click on the row. */}
      <span className={ROW_ABOVE}>
        <ConfirmButton
          onConfirm={onArchive}
          titleKey="categories.archiveTitle"
          bodyKey="categories.archiveBody"
          confirmKey="categories.archiveConfirm"
          params={{ name: pickLocalized(category.name) }}
          variant="danger"
          triggerVariant="danger"
          size="sm"
        >
          {t("categories.archive")}
        </ConfirmButton>
      </span>
    </div>
  );
}

/**
 * What this category looks like in the app, at a glance down the list.
 *
 * Two marks, because the editor sets two different things and they are easy to
 * confuse until you see them side by side:
 *
 *   1. **The category icon** — `icon_url`, the picture in the app's category
 *      strip. Drawn bare, on no ground, exactly as the strip draws it.
 *   2. **The empty state** — the glyph a dish with no photograph of its own
 *      falls back to, on the ground the category sets for it.
 *
 * ## The glyph's colour here is an approximation, deliberately
 *
 * The app strokes it in the category's `accent`, which lives only in the app's
 * own theme table — it is not a column and the dashboard cannot know it. So
 * this draws the glyph in `store_text_color`, the one colour of the
 * category's the dashboard *does* hold. The shape, the ground and the fact
 * that a glyph is chosen at all are all exact; only the stroke is stood in
 * for, and it is the one part of the pair the operator cannot set anyway.
 */
function Artwork({
  category,
  name,
}: {
  /** What the picture is of, for the lightbox `PreviewImage` opens. */
  name: string;
  category: {
    iconUrl: string | null;
    emptyIcon: string | null;
    emptyBackgroundColor: string | null;
    storeTextColor: string | null;
  };
}) {
  // Indexed rather than called — a function returning a component is what the
  // React Compiler reads as creating one during render. See `IconPicker`.
  const Glyph = category.emptyIcon
    ? CATEGORY_ICONS[category.emptyIcon as CategoryIconName]
    : undefined;

  return (
    <div className="flex shrink-0 items-center gap-sm">
      {/* The strip's mark. A dashed well when there is none, so an empty slot
          reads as "nothing uploaded" rather than as a picture that failed. */}
      {category.iconUrl ? (
        <PreviewImage
          src={category.iconUrl}
          name={name}
          className="size-[32px] shrink-0 object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="size-[32px] shrink-0 rounded-md border border-dashed border-border"
        />
      )}

      {/* The empty-state well, at the app's own proportions: a rounded square
          with the glyph centred in it. */}
      <span
        className="flex size-[32px] shrink-0 items-center justify-center rounded-md"
        style={{ background: category.emptyBackgroundColor ?? "#f0eae1" }}
      >
        {Glyph ? (
          <Glyph
            size={17}
            strokeWidth={1.8}
            color={category.storeTextColor ?? "#1e1b18"}
            aria-hidden
          />
        ) : null}
      </span>
    </div>
  );
}
