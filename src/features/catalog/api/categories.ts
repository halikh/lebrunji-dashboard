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
 * ## `is_featured` is nullable, and that is not an accident
 *
 * A null reads as "not featured", and the app sorts with `nullsFirst: false` to
 * keep it that way. The dashboard writes a real boolean so the column stops
 * accumulating a third state nobody meant.
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
  tagline: Localized;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
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

const COLUMNS = `id, slug, category_kind_id, name, tagline, image_url,
   is_active, is_featured, has_menu_nav, sort_order`;

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await getClient()
    .from("categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the categories: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    kindId: row.category_kind_id as string,
    name: (row.name as Localized) ?? {},
    tagline: (row.tagline as Localized) ?? {},
    imageUrl: (row.image_url as string | null) ?? null,
    isActive: row.is_active as boolean,
    // Null is "not featured" — the app sorts it last deliberately. Read as a
    // real boolean here so nothing downstream has to keep remembering that.
    isFeatured: Boolean(row.is_featured),
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
  tagline: Localized;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  hasMenuNav: boolean;
};

export async function createCategory(
  draft: CategoryDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient().from("categories").insert({
    category_kind_id: draft.kindId,
    name: draft.name,
    tagline: draft.tagline,
    image_url: draft.imageUrl,
    is_active: draft.isActive,
    is_featured: draft.isFeatured,
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
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  // `null` is a value here — it is how a picture is removed — so what is tested
  // is the key being absent, not the value.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) row.is_featured = patch.isFeatured;
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
