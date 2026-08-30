import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

/**
 * A store's menu: sections holding items.
 *
 * ## Why this reads the tables rather than `api_v1_store_menu`
 *
 * The app reads its menu through that function, and should — it is a versioned
 * contract so the tables underneath can move without breaking shipped binaries.
 *
 * This does not, for a reason that is the mirror of it: the function returns
 * the menu **as a customer sees it**. Inactive items are filtered out, text is
 * already resolved to one locale, and there is no `sort_order` to edit. The
 * dashboard needs the opposite — everything, in every language, with the
 * columns a merchant sets. It is the editor of the thing the contract exposes,
 * so it works against the thing itself.
 */

export type MenuItem = {
  id: string;
  sectionId: string;
  slug: string;
  name: Localized;
  description: Localized;
  /** Minor units. Integer, always — see `lib/money.ts`. */
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type MenuSection = {
  id: string;
  slug: string;
  title: Localized;
  sortOrder: number;
  items: MenuItem[];
};

/**
 * One store's whole menu.
 *
 * Not paginated, and for the same reason the store list is not: it is ordered
 * by `sort_order`, which a merchant sets by dragging, and reordering across a
 * page boundary is not a gesture that exists. A menu is also a bounded thing —
 * a shop with two thousand items has a different problem.
 */
export async function fetchMenu(storeId: string): Promise<MenuSection[]> {
  const { data, error } = await getClient()
    .from("menu_sections")
    .select(
      `id, slug, title, sort_order,
       menu_items ( id, menu_section_id, slug, name, description, price,
                    image_url, is_active, sort_order, deleted_at )`,
    )
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the menu: ${error.message}`);

  return (data ?? []).map((section) => ({
    id: section.id as string,
    slug: section.slug as string,
    title: (section.title as Localized) ?? {},
    sortOrder: section.sort_order as number,
    items: asArray(section.menu_items)
      // Filtered here rather than in the query: a `deleted_at` filter on an
      // embedded table removes the *child*, and PostgREST would happily return
      // a section with its archived items missing and no way to tell that from
      // a section with none.
      .filter((item) => item.deleted_at === null)
      .map(toItem)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export type MenuItemDraft = {
  storeId: string;
  sectionId: string;
  name: Localized;
  description: Localized;
  price: number;
  isActive: boolean;
};

/**
 * Adds an item.
 *
 * `sort_order` is computed here rather than defaulted, because the column has
 * no default and "where it goes" is a question the caller can answer and the
 * database cannot: a new item belongs at the end of the section it was added
 * to.
 */
export async function createMenuItem(
  draft: MenuItemDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient().from("menu_items").insert({
    store_id: draft.storeId,
    menu_section_id: draft.sectionId,
    // No `slug`. The trigger from migration 0070 derives it from the English
    // name and makes it unique inside the shop — which a client cannot do
    // without racing another tab.
    name: draft.name,
    description: draft.description,
    price: draft.price,
    is_active: draft.isActive,
    sort_order: sortOrder,
  });

  if (error) throw new Error(friendly(error.message));
}

export type MenuItemPatch = Partial<
  Omit<MenuItemDraft, "storeId" | "sectionId">
> & {
  sortOrder?: number;
};

export async function updateMenuItem(
  id: string,
  patch: MenuItemPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("menu_items")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/** Soft, like everything with a `deleted_at`: order lines reference items. */
export async function archiveMenuItem(id: string): Promise<void> {
  const { error } = await getClient()
    .from("menu_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Turns a constraint violation into a sentence.
 *
 * The form checks these first and this should rarely be seen — but "rarely" is
 * not "never": a second tab, a stale list, an imported row. When it happens the
 * operator gets what to do rather than `menu_items_store_id_slug_key`.
 *
 * The constraint names are from migrations 0066 and 0067, and they are matched
 * loosely on purpose: a renamed constraint should degrade to the raw message,
 * not to a wrong explanation.
 */
function friendly(message: string): string {
  if (message.includes("slug_live_idx") || message.includes("store_id_slug")) {
    return "Another item in this shop already uses that slug.";
  }
  if (message.includes("_locales")) {
    return "Every language needs a value before this can be saved.";
  }
  if (message.includes("price_positive")) {
    return "A price cannot be negative.";
  }
  if (message.includes("slug_shape")) {
    return "Use lower-case letters, numbers and single hyphens in the slug.";
  }
  if (message.includes("_len")) {
    return "That is longer than the field allows.";
  }
  return message;
}

function toItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    sectionId: row.menu_section_id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    description: (row.description as Localized) ?? {},
    price: row.price as number,
    imageUrl: (row.image_url as string | null) ?? null,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}
