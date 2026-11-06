"use client";

import { Sheet, cx } from "@/components/ui";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import {
  ARTWORK_FORMATS,
  reorderUpdates,
  type Artwork,
  type ArtworkFormat,
} from "../api/artworks";
import { useReorderArtworks } from "../use-artworks";
import { artworkName, describePlacements } from "./artwork-status";

/**
 * The order pictures come in, per format — banners and tiles are drawn in
 * different places, so each is its own list and `sort_order` is renumbered
 * within the format only. Saved on drop, like every reorder here.
 */
export function ReorderArtworksSheet({
  open,
  onOpenChange,
  all,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  all: Artwork[];
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("artworks.reorderTitle")}
      description={t("artworks.reorderHint")}
    >
      <div className="flex flex-col gap-6">
        {ARTWORK_FORMATS.map((format) => (
          <FormatOrder key={format} format={format} all={all} />
        ))}
      </div>
    </Sheet>
  );
}

function FormatOrder({
  format,
  all,
}: {
  format: ArtworkFormat;
  all: Artwork[];
}) {
  const reorder = useReorderArtworks();
  const rows = all
    .filter((row) => row.format === format)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = reorderUpdates(rows, ids);
      // The whole cache with only this format's rows replaced, so the other
      // list does not blink while this one settles.
      const byId = new Map(next.map((row) => [row.id, row]));
      reorder.mutate({
        updates,
        next: all.map((row) => byId.get(row.id) ?? row),
      });
    },
    labelOf: (id) => {
      const row = rows.find((one) => one.id === id);
      return row ? artworkName(row) : "";
    },
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-ink">
        {t(`artworks.sections.${format}`)}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          {t(`artworks.sectionsEmpty.${format}`)}
        </p>
      ) : (
        <>
          {order.instructions}
          <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
            {order
              .ordered(rows, (row) => row.id)
              .map((row, index) => {
                const src = pickLocalized(row.imageUrl);
                return (
                  <li
                    key={row.id}
                    {...order.rowProps(
                      row.id,
                      "flex items-center gap-3 bg-surface px-3 py-2",
                    )}
                  >
                    <span className="relative flex w-7 shrink-0 justify-center">
                      <button {...order.handleProps(row.id)}>
                        <GripIcon />
                      </button>
                    </span>
                    <span className="w-5 shrink-0 text-end text-[12px] text-ink-4 tabular-nums">
                      {index + 1}
                    </span>
                    <span
                      className={cx(
                        "shrink-0 overflow-hidden rounded border border-line bg-subtle",
                        format === "banner" ? "h-8 w-[75px]" : "h-10 w-8",
                      )}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13.5px] font-medium text-ink">
                        {artworkName(row)}
                      </span>
                      <span className="truncate text-[12px] text-ink-3">
                        {describePlacements(row)}
                      </span>
                    </span>
                  </li>
                );
              })}
          </ol>
        </>
      )}
    </section>
  );
}
