import type { BadgeTone } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import { artworkState, windowOf, type Artwork } from "../api/artworks";

/*
 * How a picture reads in a list: what to call it, whether it is showing, and
 * why not. Shared by the gallery, the reorder sheet and the editor's header.
 */

export type ArtworkState = ReturnType<typeof artworkState>;

export const ARTWORK_TONE: Record<ArtworkState, BadgeTone> = {
  live: "success",
  scheduled: "info",
  ended: "neutral",
  off: "neutral",
  promotionArchived: "warning",
  bundleArchived: "warning",
};

/**
 * A picture has no name of its own — the words are in the image — so it
 * borrows what it advertises, or says it stands alone.
 */
export function artworkName(artwork: Artwork): string {
  if (artwork.discount) {
    return t("artworks.linkedTo", { slug: artwork.discount.slug });
  }
  if (artwork.bundle) {
    return t("artworks.linkedToBundle", {
      name: pickLocalized(artwork.bundle.name),
    });
  }
  return t("artworks.artworkOnly");
}

export function describePlacements(artwork: Artwork): string {
  if (artwork.placements.length === 0) return t("artworks.draft");
  return t("artworks.shownOn", {
    screens: artwork.placements
      .map((one) => t(`artworks.placements.${one}`))
      .join(", "),
  });
}

/** The window in words, or why it is not showing when that is the news. */
export function describeArtworkWindow(
  artwork: Artwork,
  state: ArtworkState,
): string {
  if (state === "off") return t("artworks.stateOff");
  if (state === "promotionArchived") return t("artworks.promotionArchived");
  if (state === "bundleArchived") return t("artworks.bundleArchived");
  if (state === "ended") return t("artworks.ended");
  // A linked picture runs on its deal's dates — `0136`. See `windowOf`.
  const { startsAt, endsAt } = windowOf(artwork);
  if (state === "scheduled" && startsAt) {
    return t("artworks.startsOn", { when: formatDate(startsAt) });
  }
  if (startsAt && endsAt) {
    return t("artworks.between", {
      from: formatDate(startsAt),
      to: formatDate(endsAt),
    });
  }
  if (endsAt) return t("artworks.until", { to: formatDate(endsAt) });
  if (artwork.discount) return t("artworks.whilePromotion");
  if (artwork.bundle) return t("artworks.whileBundle");
  return t("artworks.always");
}
