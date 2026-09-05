import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
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
};

const COLUMNS = `id, slug, category_kind_id, name,
   is_active, has_menu_nav, sort_order`;

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
    .is("deleted_at", null);

  const term = search?.trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      [
        `name->>en.ilike.${like}`,
        `name->>ar.ilike.${like}`,
        `slug.ilike.${like}`,
      ].join(","),
    );
  }

  const { data, error } = await query.order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the categories: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    kindId: row.category_kind_id as string,
    name: (row.name as Localized) ?? {},
    isActive: row.is_active as boolean,
    hasMenuNav: row.has_menu_nav as boolean,
    sortOrder: row.sort_order as number,
  }));
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

export type CategoryDraft = {
  kindId: string;
  name: Localized;
  isActive: boolean;
  hasMenuNav: boolean;
};

export async function createCategory(
  draft: CategoryDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient().from("categories").insert({
    category_kind_id: draft.kindId,
    name: draft.name,
    is_active: draft.isActive,
    has_menu_nav: draft.hasMenuNav,
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
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.hasMenuNav !== undefined) row.has_menu_nav = patch.hasMenuNav;
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
