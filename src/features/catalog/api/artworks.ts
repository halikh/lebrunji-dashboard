import { PAGE } from "@/lib/limits";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

/**
 * Artwork — the pictures the app draws, apart from what anything costs.
 *
 * ## Why this is not part of a promotion any more
 *
 * `0129` split them. Until then the only place a picture could live was
 * `discounts.image_url`, and a row in `discounts` takes money off at checkout —
 * so a brand tile ("وصلنا!") stored there would have been a free-delivery code
 * nobody meant to issue. Now a discount is what `discount_for_order` charges,
 * and an artwork is what a screen draws. One discount may have a banner *and* a
 * tile, or neither.
 *
 * ## Linked or not
 *
 * `discount_id` set makes the picture an advert for that promotion, and the app
 * shows it only while the promotion itself is live — switched on, not archived,
 * inside its dates — *and* the artwork is inside its own. On a shop's page a
 * linked picture also respects the promotion's scopes. Null is pure artwork,
 * governed by its own switch and window alone, and on every shop's page.
 *
 * ## Hard delete
 *
 * No `deleted_at`. Nothing points at an artwork — no order, no redemption — so
 * there is no history an archive would be protecting, and it stays out of the
 * catalogue's archive tab.
 */

/** Mirrors `artworks_format_known`. */
export const ARTWORK_FORMATS = ["banner", "tile"] as const;

export type ArtworkFormat = (typeof ARTWORK_FORMATS)[number];

/**
 * The screens a picture can be drawn on. Mirrors `artworks_placements_known`.
 *
 * Advertising, not eligibility: `discount_for_order` never reads this. An
 * empty list is a draft — a picture shown nowhere, which the constraint allows
 * on purpose.
 */
export const PLACEMENTS = ["home", "store", "cart"] as const;

export type Placement = (typeof PLACEMENTS)[number];

export type Artwork = {
  id: string;
  format: ArtworkFormat;
  /** English required, the rest optional (`artworks_image_url_locales`). */
  imageUrl: Localized;
  placements: Placement[];
  /**
   * The promotion it advertises, or null for pure artwork.
   *
   * `archived` is carried because an archived promotion takes its pictures
   * down with it in the app while the rows stay here — which a list reading
   * "Live" would otherwise hide.
   */
  discount: { id: string; slug: string; archived: boolean } | null;
  isActive: boolean;
  /** ISO instants, or null for open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  /** Ascending, per screen and format. */
  sortOrder: number;
};

const COLUMNS = `id, format, image_url, placements, discount_id, is_active,
   starts_at, ends_at, sort_order,
   discount:discounts ( id, slug, deleted_at )`;

/**
 * Every artwork, banners and tiles together.
 *
 * No search: an artwork has no text column — the words are in the picture —
 * and the only handle on one is its linked promotion, which the list shows.
 * Grouping by format is done by the screen over this one capped read; it is a
 * partition of the whole set rather than a filter over a page of it, so the
 * rule about filtering in the query does not bite.
 */
export async function fetchArtworks(): Promise<Artwork[]> {
  const { data, error } = await getClient()
    .from("artworks")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    // Capped, not paged — the order is what the operator arranges, and a
    // position within a page is not one. See `fetchPromotions`.
    .limit(PAGE.cap);

  if (error) throw new Error(`Could not read the artwork: ${error.message}`);

  return (data ?? []).map((row) => toArtwork(row as Record<string, unknown>));
}

/** A row as PostgREST returns it, to the shape the screens use. */
export function toArtwork(row: Record<string, unknown>): Artwork {
  const linked = firstOf(row.discount);

  return {
    id: row.id as string,
    format: row.format === "tile" ? "tile" : "banner",
    imageUrl: (row.image_url as Localized | null) ?? {},
    placements: knownPlacements(row.placements),
    discount: linked
      ? {
          id: linked.id as string,
          slug: linked.slug as string,
          archived: linked.deleted_at != null,
        }
      : null,
    isActive: Boolean(row.is_active),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    sortOrder: (row.sort_order as number | null) ?? 0,
  };
}

export type ArtworkDraft = {
  format: ArtworkFormat;
  imageUrl: Localized;
  placements: Placement[];
  /** Null for pure artwork. */
  discountId: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type ArtworkPatch = Partial<ArtworkDraft> & { sortOrder?: number };

export async function createArtwork(
  draft: ArtworkDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient()
    .from("artworks")
    .insert({ ...toColumns(draft), sort_order: sortOrder });
  if (error) throw new Error(friendly(error.message));
}

export async function updateArtwork(
  id: string,
  patch: ArtworkPatch,
): Promise<void> {
  const row = toColumns(patch);
  if (Object.keys(row).length === 0) return;

  const { error } = await getClient().from("artworks").update(row).eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/** For good — see the header. The files stay in the bucket, as everywhere. */
export async function deleteArtwork(id: string): Promise<void> {
  const { error } = await getClient().from("artworks").delete().eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

export async function setArtworkOrder(
  updates: { id: string; sortOrder: number }[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      client.from("artworks").update({ sort_order: sortOrder }).eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

// ---------------------------------------------------------------------------
// Pure helpers — tested in `artworks.test.ts`
// ---------------------------------------------------------------------------

/**
 * A draft or patch to the columns it writes.
 *
 * Tests the key being absent rather than the value being falsy: `null` is a
 * value here — no promotion, no start, no end — and dropping it would make
 * "unlink this picture" a save that silently did nothing.
 */
export function toColumns(patch: ArtworkPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.format !== undefined) row.format = patch.format;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.placements !== undefined) {
    row.placements = orderPlacements(patch.placements);
  }
  if (patch.discountId !== undefined) row.discount_id = patch.discountId;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  return row;
}

/** Whatever came back, narrowed to the screens this build knows. */
export function knownPlacements(value: unknown): Placement[] {
  if (!Array.isArray(value)) return [];
  return orderPlacements(
    value.filter((one): one is Placement =>
      (PLACEMENTS as readonly string[]).includes(one as string),
    ),
  );
}

/**
 * Placements in the declared order, each once.
 *
 * So the value written does not depend on the order the operator happened to
 * press the switches in — two saves of the same choice are the same array.
 */
export function orderPlacements(placements: readonly Placement[]): Placement[] {
  return PLACEMENTS.filter((one) => placements.includes(one));
}

/** One switch flicked: on if it was off, off if it was on. */
export function togglePlacement(
  placements: readonly Placement[],
  option: Placement,
): Placement[] {
  return placements.includes(option)
    ? orderPlacements(placements.filter((one) => one !== option))
    : orderPlacements([...placements, option]);
}

/**
 * Where a new picture goes in its format's list: last.
 *
 * Per format, because banners and tiles are ordered separately — they are
 * drawn in different places, and a tile's position among banners means
 * nothing.
 */
export function nextSortOrder(
  rows: readonly Pick<Artwork, "format" | "sortOrder">[],
  format: ArtworkFormat,
): number {
  const same = rows.filter((row) => row.format === format);
  if (same.length === 0) return 0;
  return Math.max(...same.map((row) => row.sortOrder)) + 1;
}

/**
 * The writes a drag within one format needs.
 *
 * Renumbered from zero, so the stored order is always the order on screen, and
 * only the rows whose number changed are written.
 */
export function reorderUpdates(
  rows: readonly Artwork[],
  ids: readonly string[],
): { next: Artwork[]; updates: { id: string; sortOrder: number }[] } {
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
  return { next, updates };
}

/**
 * The window in one word, for the row.
 *
 * `live` needs the switch on and today inside the dates — and, for a linked
 * picture, the promotion not archived. The promotion's own switch and window
 * are not read here: the list does not load them, and the row names the
 * promotion so the operator can look.
 */
export function artworkState(
  artwork: Pick<Artwork, "isActive" | "startsAt" | "endsAt" | "discount">,
  now: number,
): "off" | "scheduled" | "ended" | "promotionArchived" | "live" {
  if (!artwork.isActive) return "off";
  if (artwork.discount?.archived) return "promotionArchived";
  if (artwork.endsAt && new Date(artwork.endsAt).getTime() < now) {
    return "ended";
  }
  if (artwork.startsAt && new Date(artwork.startsAt).getTime() > now) {
    return "scheduled";
  }
  return "live";
}

function firstOf(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

/** A constraint name, to a sentence. */
export function friendly(message: string): string {
  if (message.includes("artworks_window_ordered")) {
    return t("artworks.windowBackwards");
  }
  if (message.includes("artworks_image_url_locales")) {
    return t("artworks.imageNeedsEnglish");
  }
  if (message.includes("artworks_placements_known")) {
    return t("artworks.placementsUnknown");
  }
  if (message.includes("artworks_format_known")) {
    return t("artworks.formatUnknown");
  }
  if (message.includes("artworks_discount_id_fkey")) {
    return t("artworks.promotionGone");
  }
  return message;
}
