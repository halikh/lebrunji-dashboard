import { PAGE } from "@/lib/limits";
import { likeAny, searchTerm } from "@/lib/search";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { formatLocalized } from "@/lib/text-format";
import type { Localized } from "@/lib/validation";

/**
 * Categories — the tiles on the app's home screen.
 *
 * A category is what a customer picks before they pick a shop, so the list is
 * short, changes rarely, and every row is seen by everyone. That combination is
 * why the dashboard edits them at all: getting one wrong is cheap to do and
 * expensive to leave.
 *
 * ## `sort_order` is the whole point of the row
 *
 * The app orders by it — as the primary order on a browse screen, and as the
 * tiebreak everywhere else, because the seed created its rows in one migration
 * with identical timestamps and without it the grid would reshuffle between
 * loads. So reordering here is not decoration; it is the only thing that
 * decides what a customer sees first.
 *
 * ## And it is now the only thing that decides
 *
 * `is_featured` used to promote a category ahead of the drag order. Migration
 * 0086 dropped it: two levers on one outcome have to be read together to
 * predict anything, and this one was set on a row whose effect showed up on
 * another screen. Dragging shows the result while it happens; a switch did not.
 */

export type CategoryKind = {
  id: string;
  name: Localized;
};

export type Category = {
  id: string;
  slug: string;
  kindId: string;
  name: Localized;
  isActive: boolean;
  /**
   * Whether a shop in this category shows its menu's section tabs.
   *
   * Off for the ones that are booked rather than browsed — laundry, a car wash
   * — whose "menu" is a handful of lines that fit on one screen. Defaults on,
   * because the flag exists to switch off the exceptions.
   */
  hasMenuNav: boolean;
  sortOrder: number;
  /**
   * The category's own artwork, or null for the app's.
   *
   * `0117`. The app keeps a table of a tint, an ink and a glyph per slug, and
   * these three override it — a category added in the database used to render
   * in a derived colour with a generic glyph until the next app release, and an
   * app release goes through a store review.
   *
   * Null is a **live reference** to the app's own table rather than a missing
   * value, which is why nothing here is defaulted: a category left alone still
   * follows the palette if the palette moves.
   */
  /**
   * The glyph a dish with no photograph falls back to — `0124`.
   *
   * A name out of the shared vocabulary, not a URL: this is drawn at 22pt in
   * one colour beside type, which is a glyph rather than a picture. See
   * `lib/category-icons.ts`.
   *
   * Null means the app's own table decides, which is what every category did
   * before the column existed.
   */
  emptyIcon: string | null;
  emptyBackgroundColor: string | null;
  storeTextColor: string | null;
  /**
   * The category's own mark, in the app's category strip — `0123`.
   *
   * A real picture, shown at 36pt as itself — unlike `emptyIcon`, which is a
   * glyph the app strokes in the category's accent. The two are different kinds
   * of answer to different questions, which is why `0124` made one a name and
   * left this one a file.
   */
  iconUrl: string | null;
  /**
   * How many live shops are in this category.
   *
   * Read with the row rather than on demand, for the reason `archiveCategory`
   * below already half-implements: `stores.category_id` is `not null` and
   * references this row, so archiving one that still has shops is *refused*.
   * The count was therefore a fact the operator could only discover by trying
   * — an error message where a label would have done. On the row it is
   * something to plan around instead of something to be stopped by.
   *
   * Archived shops are excluded, because they are what the refusal excludes:
   * the number on the row and the number in the refusal have to be the same
   * number, or the label is worse than nothing.
   */
  usedBy: number;
};

// `stores ( count )` is an aggregate embed — one row per category carrying how
// many stores point at it. The `deleted_at` filter on the embed is applied to
// the *stores* before they are counted, which is what keeps archived shops out
// of the total without dropping empty categories from the list (an inner join
// would have done exactly that).
const COLUMNS = `id, slug, category_kind_id, name,
   is_active, has_menu_nav, sort_order,
   empty_icon, empty_background_color, store_text_color, icon_url,
   stores ( count )`;

/**
 * There is no picture, deliberately.
 *
 * `0010` added an `image_url` override for the day a merchant supplied
 * something better than the app's drawn artwork; `0075` removed it, for the
 * reason `0010` had already written down — a photograph at seventy points reads
 * as a smudge, and twelve of them read as noise. The drawn set is the designed
 * artwork, not a placeholder. An uploader here would have offered a decision
 * with no visible consequence anywhere.
 */

/**
 * Every category, or the ones matching a term.
 *
 * The term goes into the query rather than filtering the rows already here.
 * This list is short enough that either would find the same thing today, and
 * that is exactly why it is worth doing properly: a client-side filter is a
 * habit that is wrong on every list that pages, where it searches what has been
 * *downloaded* and silently cannot find the rest.
 *
 * Both languages, because an operator who knows a tile as مطاعم should find it
 * by typing مطاعم.
 */
export async function fetchCategories(
  search?: string | null,
): Promise<Category[]> {
  let query = getClient()
    .from("categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    // On the embed, not on this row — see `COLUMNS`.
    .is("stores.deleted_at", null);

  // `likeAny` rather than an interpolated string: a category called
  // "Cafes, bakeries" would otherwise end the condition at the comma and the
  // whole filter would be refused. See `lib/search.ts`.
  const term = searchTerm(search);
  if (term) query = query.or(likeAny(["name->>en", "name->>ar", "slug"], term));

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    // Capped, not paged — the order is `sort_order`, which an operator sets by
    // dragging, and a position within a page is not a position on the home
    // screen. `fetchStores` writes the argument out in full.
    .limit(PAGE.cap);

  if (error) throw new Error(`Could not read the categories: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    kindId: row.category_kind_id as string,
    name: (row.name as Localized) ?? {},
    isActive: row.is_active as boolean,
    hasMenuNav: row.has_menu_nav as boolean,
    sortOrder: row.sort_order as number,
    emptyIcon: (row.empty_icon as string | null) ?? null,
    iconUrl: (row.icon_url as string | null) ?? null,
    emptyBackgroundColor: (row.empty_background_color as string | null) ?? null,
    storeTextColor: (row.store_text_color as string | null) ?? null,
    usedBy: countOf(row.stores),
  }));
}

/**
 * PostgREST returns an aggregate embed as `[{ count: n }]`, and as `[]` when
 * there is nothing to count — so the empty case is an absent row rather than a
 * zero. Read defensively: a shape mismatch here would put "On undefined shops"
 * on a row, which looks like the screen is broken rather than like the data is.
 *
 * The same helper `api/tags.ts`, `api/menu.ts` and `api/promotions.ts` each
 * carry, and for the same reason. Four copies is a smell; extracting it is a
 * change to three files nobody asked about, and this is not the commit for it.
 */
function countOf(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0] as { count?: number } | undefined;
    return first?.count ?? 0;
  }
  if (value && typeof value === "object") {
    return (value as { count?: number }).count ?? 0;
  }
  return 0;
}

/** The kinds a category can belong to. A handful of rows, changed by migration. */
export async function fetchCategoryKinds(): Promise<CategoryKind[]> {
  const { data, error } = await getClient()
    .from("category_kinds")
    .select("id, name")
    .order("slug", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as Localized) ?? {},
  }));
}

/*
 * The house style, applied here as well as in the field.
 *
 * Not a duplicate of the form's rule — a second layer under it. `LocalizedField`
 * formats as somebody types, which is the half that makes the rule *visible*;
 * this is the half that makes it *true*. Bulk paste, the wizard, a future
 * import and any screen written next all arrive here, and a rule enforced only
 * by a component is a rule the next component does not have.
 *
 * See `lib/text-format.ts` for what the formats are and why.
 */
const NAME_FORMAT = "sentence" as const;

export type CategoryDraft = {
  kindId: string;
  name: Localized;
  isActive: boolean;
  hasMenuNav: boolean;
  /** See `Category` — null means the app's own table decides. */
  /**
   * The glyph a dish with no photograph falls back to — `0124`.
   *
   * A name out of the shared vocabulary, not a URL: this is drawn at 22pt in
   * one colour beside type, which is a glyph rather than a picture. See
   * `lib/category-icons.ts`.
   *
   * Null means the app's own table decides, which is what every category did
   * before the column existed.
   */
  emptyIcon: string | null;
  iconUrl: string | null;
  emptyBackgroundColor: string | null;
  storeTextColor: string | null;
};

export async function createCategory(
  draft: CategoryDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient()
    .from("categories")
    .insert({
      category_kind_id: draft.kindId,
      name: formatLocalized(draft.name, NAME_FORMAT),
      is_active: draft.isActive,
      has_menu_nav: draft.hasMenuNav,
      empty_icon: draft.emptyIcon,
      icon_url: draft.iconUrl,
      empty_background_color: draft.emptyBackgroundColor,
      store_text_color: draft.storeTextColor,
      sort_order: sortOrder,
      // No `slug`: the trigger from migration 0071 derives one from the English
      // name and makes it unique, which a client cannot do without racing.
    });

  if (error) throw new Error(friendly(error.message));
}

export type CategoryPatch = Partial<CategoryDraft> & { sortOrder?: number };

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.kindId !== undefined) row.category_kind_id = patch.kindId;
  if (patch.name !== undefined)
    row.name = formatLocalized(patch.name, NAME_FORMAT);
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.hasMenuNav !== undefined) row.has_menu_nav = patch.hasMenuNav;
  // Written when present, `null` included — clearing one is how a category is
  // put back to following the app's own table.
  if (patch.emptyIcon !== undefined) row.empty_icon = patch.emptyIcon;
  if (patch.iconUrl !== undefined) row.icon_url = patch.iconUrl;
  if (patch.emptyBackgroundColor !== undefined)
    row.empty_background_color = patch.emptyBackgroundColor;
  if (patch.storeTextColor !== undefined)
    row.store_text_color = patch.storeTextColor;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("categories")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Archives a category.
 *
 * Soft, like every lifecycle table here — and with more reason than most:
 * `stores.category_id` is `not null` and references this, so a hard delete
 * would either be refused by the database or take shops with it. Archiving
 * removes the tile from the app and leaves every shop where it was.
 *
 * The shops are the thing to say out loud, and the count is read back rather
 * than assumed from a list that may be a minute old.
 */
export async function archiveCategory(id: string): Promise<void> {
  const client = getClient();

  const { count, error: countError } = await client
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);

  if (countError) throw new Error(countError.message);
  if (count && count > 0) {
    throw new Error(t("categories.stillHasShops", { count }));
  }

  const { error } = await client
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * Writes a new `sort_order` to each row that needs one.
 *
 * The same shape as the menu's, and for the same reasons — see `setSortOrder`
 * in `api/menu.ts` for why this is several requests rather than one, and why
 * that is acceptable for a column that decides presentation and nothing else.
 */
export async function setCategoryOrder(
  updates: { id: string; sortOrder: number }[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      client.from("categories").update({ sort_order: sortOrder }).eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

/** Turns a constraint violation into a sentence the operator can act on. */
function friendly(message: string): string {
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  return message;
}
