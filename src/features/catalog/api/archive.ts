import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { PAGE } from "@/lib/limits";
import { likeAny } from "@/lib/search";
import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

import type { TagInk, TagTone } from "./tags";

/**
 * What the catalogue as a whole has put away.
 *
 * ## The shop archive is the same idea one level down
 *
 * `features/catalog/api/menu.ts` holds the archive for *one shop* — its
 * sections, its dishes, its withdrawn questions and choices. This is the tier
 * above: the shops themselves, and the three things that are true across all of
 * them at once. An operator who archives a shop and then wants it back has
 * nowhere to look otherwise, and the same was true of a category, a tag and a
 * promotion.
 *
 * ## Everything here is a `deleted_at`
 *
 * All four tables carry one — `stores`, `categories`, `menu_item_tags` (0077)
 * and `discounts` — so unlike the shop-level archive there is only one kind of
 * absence to show, and the word on screen is "archived" throughout.
 *
 * ## A shop remembers which category it belongs to
 *
 * `stores.category_id` is `not null`, so a shop always has one, and restoring a
 * shop into an archived category would put it on a shelf the app does not draw.
 * The same refusal the menu archive makes about a dish and its section, for the
 * same reason — see {@link restoreStore}.
 *
 * ## Four lists, four queries, and none of them unbounded
 *
 * This used to be one function returning all four in full: every archived shop,
 * category, tag and promotion, on every visit to the tab. That is the shape
 * that is fine for a year and then is not — an archive only ever grows, because
 * nothing in this product is deleted, so it is the one list in the catalogue
 * guaranteed to outgrow a screen.
 *
 * So each kind is its own paged read. The screen runs the one its filter is
 * showing and leaves the others alone, which is also what stops opening the
 * Archive tab from fetching four lists to draw one.
 *
 * ## The cursor is a pair, not a timestamp
 *
 * Keyset, like every other paged list here: `deleted_at` descending, and the
 * page after a row is everything older than it. But `deleted_at` is **not
 * unique** — archiving three tags in one go writes three rows within the same
 * millisecond — and a plain `lt` on a repeated value skips every row that
 * shares the boundary. Rows silently missing from page two is the worst kind of
 * paging bug: nothing errors and nobody counts.
 *
 * So the cursor carries the id as well, and the filter is "older, or the same
 * instant and a lower id". `id` is a uuid and its order is arbitrary — which is
 * all a tiebreak has to be, as long as it is *stable*, and the same `order` is
 * applied on every page.
 */

export type ArchivedStore = {
  id: string;
  name: Localized;
  imageUrl: string | null;
  archivedAt: string;
  categoryName: Localized;
  /** Whether the category it would return to is itself archived. */
  categoryArchived: boolean;
};

export type ArchivedCategory = {
  id: string;
  name: Localized;
  archivedAt: string;
};

export type ArchivedTag = {
  id: string;
  name: Localized;
  /** The palette role, so an archived tag is drawn as the chip it was. */
  tone: TagTone;
  /** Null for the tone's own — see `Tag.ink`. */
  ink: TagInk | null;
  /** Null for the tone's own colour — see `Tag.color`. */
  color: string | null;
  archivedAt: string;
};

export type ArchivedPromotion = {
  id: string;
  /** A promotion has no customer-facing name — the slug is the operator's. */
  slug: string;
  imageUrl: string | null;
  archivedAt: string;
};

/** Which of the four lists. Also the tab key on the screen. */
export type ArchiveKind = "stores" | "categories" | "tags" | "promotions";

/**
 * Where the next page starts: the last row's archival instant and its id.
 *
 * Both halves, for the reason in the header — a timestamp alone drops rows that
 * share it.
 */
export type ArchiveCursor = { archivedAt: string; id: string };

export type ArchivePage<Row> = {
  rows: Row[];
  /** Null when this was the last page. Never guessed from the row count. */
  cursor: ArchiveCursor | null;
};

type PageOptions = {
  /** What the operator typed, or null for the whole list. */
  search?: string | null;
  /** Where to continue from, or null for the first page. */
  after?: ArchiveCursor | null;
  limit?: number;
};

/** How many are in each list — the numbers on the tab strip. */
export type ArchiveCounts = Record<ArchiveKind, number> & { all: number };

/**
 * The keyset predicate: everything strictly after a cursor, in this ordering.
 *
 * "Older, **or** the same instant with a lower id" — the pair ordering said as
 * a filter. Written once because four copies of it is four chances to spell one
 * of them `lte` and quietly repeat a row on every page boundary.
 *
 * Both values are quoted. A timestamp carries colons and a `+`, and a filter
 * value that is read as syntax rather than as data is the failure `lib/search`
 * exists for.
 */
function afterCursor(cursor: ArchiveCursor): string {
  const at = `"${cursor.archivedAt}"`;
  return (
    `deleted_at.lt.${at},` + `and(deleted_at.eq.${at},id.lt."${cursor.id}")`
  );
}

/**
 * The cursor for the page just read, or null because it was the last one.
 *
 * Null when the page came back short: a page shorter than the limit is the end
 * of the list, and that is the only signal worth trusting — asking for one more
 * row to find out costs a round trip on every page.
 *
 * The other direction is the trap the customers list documents: a full page is
 * *not* proof there is another, so this can hand back a cursor whose page turns
 * out to be empty. One wasted request at the very end beats a list that stops a
 * page early whenever the total happens to be a multiple of the limit.
 */
function cursorOf<Row extends { id: string; archivedAt: string }>(
  rows: Row[],
  limit: number,
): ArchiveCursor | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return last ? { archivedAt: last.archivedAt, id: last.id } : null;
}

/** The columns a translated, slugged row is searched by. */
const NAMED = ["name->>en", "name->>ar", "slug"] as const;

/** Archived shops, newest first. */
export async function fetchArchivedStores(
  options: PageOptions = {},
): Promise<ArchivePage<ArchivedStore>> {
  const { search = null, after = null, limit = PAGE.size } = options;

  let query = getClient()
    .from("stores")
    .select(
      "id, name, image_url, deleted_at, categories!inner ( name, deleted_at )",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  // Both languages and the slug: an operator looking for a shop they archived
  // knows it by whatever they called it, and the slug is what a URL or an
  // import file would have said.
  if (search) query = query.or(likeAny(NAMED, search));
  // A second `or` rather than one combined string — PostgREST ANDs repeated
  // `or` parameters, which is exactly the relationship these two have.
  if (after) query = query.or(afterCursor(after));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the archive: ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const category = one(row.categories);
    return {
      id: row.id as string,
      name: (row.name as Localized) ?? {},
      imageUrl: (row.image_url as string | null) ?? null,
      archivedAt: row.deleted_at as string,
      categoryName: (category?.name as Localized) ?? {},
      categoryArchived: category?.deleted_at != null,
    };
  });

  return { rows, cursor: cursorOf(rows, limit) };
}

/** Archived categories, newest first. */
export async function fetchArchivedCategories(
  options: PageOptions = {},
): Promise<ArchivePage<ArchivedCategory>> {
  const { search = null, after = null, limit = PAGE.size } = options;

  let query = getClient()
    .from("categories")
    .select("id, name, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (search) query = query.or(likeAny(NAMED, search));
  if (after) query = query.or(afterCursor(after));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the archive: ${error.message}`);

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as Localized) ?? {},
    archivedAt: row.deleted_at as string,
  }));

  return { rows, cursor: cursorOf(rows, limit) };
}

/** Archived tags, newest first. */
export async function fetchArchivedTags(
  options: PageOptions = {},
): Promise<ArchivePage<ArchivedTag>> {
  const { search = null, after = null, limit = PAGE.size } = options;

  let query = getClient()
    .from("menu_item_tags")
    .select("id, name, tone, ink, color, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (search) query = query.or(likeAny(NAMED, search));
  if (after) query = query.or(afterCursor(after));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the archive: ${error.message}`);

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as Localized) ?? {},
    tone: (row.tone as TagTone) ?? "neutral",
    ink: (row.ink as TagInk | null) ?? null,
    color: (row.color as string | null) ?? null,
    archivedAt: row.deleted_at as string,
  }));

  return { rows, cursor: cursorOf(rows, limit) };
}

/** Archived promotions, newest first. */
export async function fetchArchivedPromotions(
  options: PageOptions = {},
): Promise<ArchivePage<ArchivedPromotion>> {
  const { search = null, after = null, limit = PAGE.size } = options;

  let query = getClient()
    .from("discounts")
    .select("id, slug, image_url, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  // The slug alone, because that is the whole of a promotion's name — it has
  // no customer-facing title to search instead.
  if (search) query = query.or(likeAny(["slug"], search));
  if (after) query = query.or(afterCursor(after));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the archive: ${error.message}`);

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    imageUrl: (row.image_url as string | null) ?? null,
    archivedAt: row.deleted_at as string,
  }));

  return { rows, cursor: cursorOf(rows, limit) };
}

/**
 * How many archived things of each kind there are.
 *
 * Four `head` counts, never the length of what was fetched. A number on a tab
 * is only worth drawing because it describes a set the screen has *not* loaded
 * — counting the rows in hand would make every tab read "50", which is worse
 * than no number because it looks like an answer.
 *
 * The search term goes into the counts too. A strip saying "Shops 12" over a
 * list of two matches would be answering a different question from the one the
 * operator just asked.
 */
export async function fetchArchiveCounts(
  search: string | null = null,
): Promise<ArchiveCounts> {
  const client = getClient();

  function counter(table: string, columns: readonly string[]) {
    let query = client
      .from(table)
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null);
    if (search) query = query.or(likeAny(columns, search));
    return query;
  }

  const [stores, categories, tags, promotions] = await Promise.all([
    counter("stores", NAMED),
    counter("categories", NAMED),
    counter("menu_item_tags", NAMED),
    counter("discounts", ["slug"]),
  ]);

  for (const result of [stores, categories, tags, promotions]) {
    if (result.error) {
      throw new Error(`Could not read the archive: ${result.error.message}`);
    }
  }

  const counts = {
    stores: stores.count ?? 0,
    categories: categories.count ?? 0,
    tags: tags.count ?? 0,
    promotions: promotions.count ?? 0,
  };

  return {
    ...counts,
    all: counts.stores + counts.categories + counts.tags + counts.promotions,
  };
}

/**
 * Puts a shop back in the catalogue.
 *
 * **Refuses when its category is archived.** `stores.category_id` is `not
 * null`, so the shop would come back onto a shelf neither the dashboard nor the
 * app draws — restored in the column and invisible everywhere, which is worse
 * than staying archived because nothing reports it. The category is read back
 * rather than trusted from the list on screen, which may be a minute old.
 */
export async function restoreStore(id: string): Promise<void> {
  const client = getClient();

  const { data, error: lookup } = await client
    .from("stores")
    .select("categories!inner ( name, deleted_at )")
    .eq("id", id)
    .single();

  if (lookup) throw new Error(lookup.message);

  const category = one(data?.categories);
  if (category?.deleted_at != null) {
    throw new Error(
      t("archive.categoryGoneFirst", {
        name: pickLocalized((category.name as Localized) ?? {}),
      }),
    );
  }

  await clearDeletedAt("stores", id);
}

/**
 * Puts a category back.
 *
 * Nothing to check. A category can only be archived once no live shop points at
 * it, so what comes back is a shelf with nothing on it — and its shops are
 * restored one at a time, which is the only honest order: some of them were
 * archived deliberately before the category was.
 */
export async function restoreCategory(id: string): Promise<void> {
  await clearDeletedAt("categories", id);
}

/** Puts a tag back in the vocabulary. Nothing references it that can break. */
export async function restoreTag(id: string): Promise<void> {
  await clearDeletedAt("menu_item_tags", id);
}

/**
 * Puts a promotion back.
 *
 * It returns **as it was**, dates included — which may well be a window that
 * has already closed. That is deliberate: silently moving `ends_at` forward
 * would be the dashboard deciding a discount should run again, and the operator
 * can see the dates on the row and change them.
 */
export async function restorePromotion(id: string): Promise<void> {
  await clearDeletedAt("discounts", id);
}

/**
 * The one write all four restores make.
 *
 * A shared helper rather than four near-identical functions: they differ only
 * in a table name, and four copies is four places for the column to be spelled
 * differently the day somebody adds a fifth.
 */
async function clearDeletedAt(table: string, id: string): Promise<void> {
  const { error } = await getClient()
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * PostgREST hands an embedded to-one back as an object, and sometimes as an
 * array of one, depending on how it read the relationship. Both mean the same
 * thing here, and a caller should not have to know which it got.
 */
function one(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown>;
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  return undefined;
}
