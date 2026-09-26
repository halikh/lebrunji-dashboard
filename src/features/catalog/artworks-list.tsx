"use client";

import { useRouter } from "next/navigation";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { ListHeader } from "@/components/ui/list-header";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { useRowFocus } from "@/components/ui/row-focus";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import {
  ARTWORK_FORMATS,
  artworkState,
  reorderUpdates,
  type Artwork,
  type ArtworkFormat,
} from "./api/artworks";
import {
  useArtworks,
  useDeleteArtwork,
  useReorderArtworks,
  useUpdateArtwork,
} from "./use-artworks";

/**
 * The pictures the app draws — banners in the carousel, tiles three to a row.
 *
 * ## Two lists, not one
 *
 * Banners and tiles are drawn in different places, so a tile's position among
 * banners means nothing. Each format is its own section with its own drag
 * order, and `sort_order` is renumbered within the format only.
 *
 * ## A picture can be on and invisible
 *
 * The app shows one only while it is switched on and inside its dates — and,
 * when it advertises a promotion, only while that promotion is live too. The
 * row says which of those it is, because nothing else on the screen would.
 */
export function ArtworksList() {
  const router = useRouter();
  const artworks = useArtworks();
  const rows = artworks.data ?? [];

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <ListHeader
          title={t("artworks.tab")}
          hint={rows.length > 1 ? t("artworks.reorderHint") : undefined}
          action={
            <Button onClick={() => router.push("/catalogue/artworks/new")}>
              {t("artworks.add")}
            </Button>
          }
        />

        <div className="flex min-h-0 flex-grow flex-col gap-xl overflow-y-auto scroll-hint p-xxl">
          {artworks.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[90px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}
          {artworks.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {artworks.error instanceof Error
                ? artworks.error.message
                : t("common.somethingWentWrong")}
            </p>
          )}

          {artworks.isSuccess && rows.length === 0 && (
            <EmptyState
              titleKey="artworks.empty"
              bodyKey="artworks.emptyBody"
            />
          )}

          {artworks.isSuccess &&
            rows.length > 0 &&
            ARTWORK_FORMATS.map((format) => (
              <FormatSection key={format} format={format} all={rows} />
            ))}
        </div>
      </div>
    </div>
  );
}

/** One format's pictures, reorderable among themselves. */
function FormatSection({
  format,
  all,
}: {
  format: ArtworkFormat;
  all: Artwork[];
}) {
  const router = useRouter();
  const update = useUpdateArtwork();
  const remove = useDeleteArtwork();
  const reorder = useReorderArtworks();
  const focus = useRowFocus();

  const rows = all.filter((row) => row.format === format);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = reorderUpdates(rows, ids);
      // The whole cache, with only this format's rows replaced — the other
      // section must not blink while this one settles.
      const byId = new Map(next.map((row) => [row.id, row]));
      reorder.mutate({
        updates,
        next: all.map((row) => byId.get(row.id) ?? row),
      });
    },
    labelOf: (id) => {
      const row = rows.find((one) => one.id === id);
      return row ? nameOf(row) : "";
    },
  });

  return (
    <section className="flex flex-col gap-sm">
      <h2 className="ps-md text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {t(`artworks.sections.${format}`)}
      </h2>
      <p className="ps-md pb-xs text-[13px] text-text-soft">
        {t(`artworks.sectionsHint.${format}`)}
      </p>

      {order.instructions}
      {order
        .ordered(rows, (row) => row.id)
        .map((row) => (
          <Row
            key={row.id}
            artwork={row}
            open={focus.isFocused(row.id)}
            anchor={focus.attach(row.id)}
            rowProps={order.rowProps}
            handleProps={order.handleProps}
            onEdit={() => router.push(`/catalogue/artworks/${row.id}`)}
            onToggleActive={() => {
              update.mutate({ id: row.id, patch: { isActive: !row.isActive } });
            }}
            onDelete={async () => {
              await remove.mutateAsync({ id: row.id });
            }}
          />
        ))}

      {rows.length === 0 && (
        <p className="ps-md text-[13px] text-text-faint">
          {t(`artworks.sectionsEmpty.${format}`)}
        </p>
      )}
    </section>
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
  artwork,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  artwork: Artwork;
  open: boolean;
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => Promise<void>;
} & ReorderProps) {
  const name = nameOf(artwork);
  const src = pickLocalized(artwork.imageUrl);
  const state = stateNow(artwork);
  const dimmed = state !== "live";

  const row = rowProps(
    artwork.id,
    cx(
      ROW,
      !artwork.isActive && "border-danger-wash bg-danger-wash/30",
      artwork.isActive && "border-border",
      artwork.isActive && open && "border-active",
    ),
  );

  // The shape it is in the app, so the row shows what a customer sees rather
  // than the middle of it: 21:9 for a banner, square for a tile.
  const frame =
    artwork.format === "banner" ? "h-[64px] w-[149px]" : "size-[64px]";

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(artwork.id)}>
        <GripIcon />
      </button>

      {src ? (
        <PreviewImage
          src={src}
          name={name}
          className={cx(
            frame,
            "shrink-0 rounded-md",
            dimmed && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className={cx(frame, "shrink-0 rounded-md")} />
      )}

      <button
        type="button"
        onClick={onEdit}
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left",
        )}
      >
        <span className="flex min-w-0 items-center gap-sm">
          <span
            className={cx(
              "shrink-0 rounded-sm px-xs text-[11px] font-semibold uppercase tracking-wide",
              artwork.format === "banner"
                ? "bg-primary-wash text-primary"
                : "bg-neutral-fill text-text-soft",
            )}
          >
            {t(`artworks.formats.${artwork.format}`)}
          </span>
          <span className="truncate text-[15px] font-semibold">{name}</span>
        </span>
        <span className="truncate text-[13px] text-text-soft">
          {describePlacements(artwork)}
        </span>
        <span
          className={cx(
            "truncate text-[12px]",
            state === "promotionArchived" ? "text-danger" : "text-text-faint",
          )}
        >
          {describeWindow(artwork, state)}
        </span>
      </button>

      <ConfirmToggle
        on={artwork.isActive}
        onChange={onToggleActive}
        labelOn={t("artworks.live")}
        labelOff={t("artworks.hidden")}
        params={{ name }}
        whenTurningOn={{
          titleKey: "artworks.showTitle",
          bodyKey: "artworks.showBody",
          confirmKey: "artworks.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "artworks.hideTitle",
          bodyKey: "artworks.hideBody",
          confirmKey: "artworks.hideConfirm",
        }}
        className={cx(ROW_ABOVE, "w-[104px]")}
      />

      <ConfirmButton
        className={ROW_ABOVE}
        onConfirm={onDelete}
        titleKey="artworks.deleteTitle"
        bodyKey="artworks.deleteBody"
        confirmKey="artworks.deleteConfirm"
        params={{ name }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("artworks.delete")}
      </ConfirmButton>
    </div>
  );
}

/**
 * What to call a picture. It has no name of its own — the words are in the
 * image — so it borrows its promotion's reference, or says it has none.
 */
function nameOf(artwork: Artwork): string {
  return artwork.discount
    ? t("artworks.linkedTo", { slug: artwork.discount.slug })
    : t("artworks.artworkOnly");
}

/** Where it stands at the moment the row is drawn. */
function stateNow(artwork: Artwork) {
  return artworkState(artwork, Date.now());
}

function describePlacements(artwork: Artwork): string {
  if (artwork.placements.length === 0) return t("artworks.draft");
  return t("artworks.shownOn", {
    screens: artwork.placements
      .map((one) => t(`artworks.placements.${one}`))
      .join(" · "),
  });
}

/** The window in words, and whether it is live *now*. */
function describeWindow(
  artwork: Artwork,
  state: ReturnType<typeof artworkState>,
): string {
  if (state === "off") return t("artworks.stateOff");
  if (state === "promotionArchived") return t("artworks.promotionArchived");
  if (state === "ended") return t("artworks.ended");
  if (state === "scheduled") {
    return t("artworks.startsOn", { when: formatDate(artwork.startsAt!) });
  }

  if (artwork.startsAt && artwork.endsAt) {
    return t("artworks.between", {
      from: formatDate(artwork.startsAt),
      to: formatDate(artwork.endsAt),
    });
  }
  if (artwork.endsAt) {
    return t("artworks.until", { to: formatDate(artwork.endsAt) });
  }
  return artwork.discount ? t("artworks.whilePromotion") : t("artworks.always");
}
