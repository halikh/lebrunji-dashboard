import { t } from "@/i18n/translations";

/**
 * Where a tap on a picture leads — `0137`.
 *
 * Shared by promotions (`discounts`) and artworks, which carry the same four
 * columns and the same check (`<table>_link_shape`): the kind decides which one
 * column is set, and the rest must be null, so a row can never point two ways.
 *
 * An artwork's own link wins over its promotion's; an artwork with none falls
 * back to the promotion's; with neither, a tap goes nowhere. That precedence is
 * the app's to apply — this file only says what each row holds.
 */

/** `link_kind`. Null is "nowhere" and is not in this list. */
export const LINK_KINDS = ["store", "category", "tab", "page"] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

/** The tab-bar screens `link_page` may name when the kind is `tab`. */
export const TAB_PAGES = [
  "home",
  "search",
  "cart",
  "orders",
  "account",
] as const;

/** The other screens `link_page` may name when the kind is `page`. */
export const OTHER_PAGES = [
  "checkout",
  "addresses",
  "address-new",
  "profile",
  "profile-details",
  "help",
] as const;

export type LinkPage =
  (typeof TAB_PAGES)[number] | (typeof OTHER_PAGES)[number];

/**
 * A destination, flat — the four columns as the screens use them.
 *
 * Flat rather than a union per kind because the form holds every half-chosen
 * answer while somebody changes their mind; `linkColumns` is what makes the
 * written row consistent.
 */
export type TapLink = {
  kind: LinkKind | null;
  storeId: string | null;
  categoryId: string | null;
  page: LinkPage | null;
};

export const NO_LINK: TapLink = {
  kind: null,
  storeId: null,
  categoryId: null,
  page: null,
};

/** The columns to select, for a `select` string. */
export const LINK_COLUMNS =
  "link_kind, link_store_id, link_category_id, link_page";

/** A row's four columns, read back. Anything unrecognised reads as nowhere. */
export function linkOf(row: Record<string, unknown>): TapLink {
  const kind = row.link_kind as string | null;
  if (kind === "store" && row.link_store_id) {
    return { ...NO_LINK, kind, storeId: row.link_store_id as string };
  }
  if (kind === "category" && row.link_category_id) {
    return { ...NO_LINK, kind, categoryId: row.link_category_id as string };
  }
  if (
    kind === "tab" &&
    (TAB_PAGES as readonly string[]).includes(row.link_page as string)
  ) {
    return { ...NO_LINK, kind, page: row.link_page as LinkPage };
  }
  if (
    kind === "page" &&
    (OTHER_PAGES as readonly string[]).includes(row.link_page as string)
  ) {
    return { ...NO_LINK, kind, page: row.link_page as LinkPage };
  }
  return NO_LINK;
}

/**
 * The four columns to write — **all four, every time**, with null in the ones
 * the kind does not use. That is the whole of `_link_shape`: writing only the
 * column that changed would leave a shop id behind on a link that now points at
 * a page, and the check would refuse the row.
 *
 * A kind chosen without its target yet (a shop not picked) is written as
 * nowhere rather than refused here; `missingTarget` is what the form checks
 * first, so that only happens if a caller skips it.
 */
export function linkColumns(link: TapLink): Record<string, unknown> {
  const tidy = normalise(link);
  return {
    link_kind: tidy.kind,
    link_store_id: tidy.storeId,
    link_category_id: tidy.categoryId,
    link_page: tidy.page,
  };
}

/** The link with only the column its kind uses — or nowhere, if that is empty. */
export function normalise(link: TapLink): TapLink {
  switch (link.kind) {
    case "store":
      return link.storeId
        ? { ...NO_LINK, kind: "store", storeId: link.storeId }
        : NO_LINK;
    case "category":
      return link.categoryId
        ? { ...NO_LINK, kind: "category", categoryId: link.categoryId }
        : NO_LINK;
    case "tab":
      return link.page && (TAB_PAGES as readonly string[]).includes(link.page)
        ? { ...NO_LINK, kind: "tab", page: link.page }
        : NO_LINK;
    case "page":
      return link.page && (OTHER_PAGES as readonly string[]).includes(link.page)
        ? { ...NO_LINK, kind: "page", page: link.page }
        : NO_LINK;
    default:
      return NO_LINK;
  }
}

/** Whether a kind has been chosen and its target has not — a form error. */
export function missingTarget(link: TapLink): boolean {
  return link.kind !== null && normalise(link).kind === null;
}

/** Two links that would write the same row. */
export function sameLink(a: TapLink, b: TapLink): boolean {
  const x = normalise(a);
  const y = normalise(b);
  return (
    x.kind === y.kind &&
    x.storeId === y.storeId &&
    x.categoryId === y.categoryId &&
    x.page === y.page
  );
}

/** `_link_shape` refusing a row, as a sentence — or null for anything else. */
export function linkRefusal(message: string): string | null {
  return message.includes("_link_shape") ? t("links.badShape") : null;
}
