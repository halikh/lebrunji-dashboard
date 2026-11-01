import { PAGE } from "@/lib/limits";
import { likeAny } from "@/lib/search";
import { getClient } from "@/lib/supabase/client";
import { cleanLocalized, titleLocalized } from "@/lib/text-format";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { localizedOrNull, type Localized } from "@/lib/validation";

/**
 * Bundles — several of a shop's dishes sold together at one price (`0204`).
 *
 * A bundle is a `menu_items` row with `is_bundle` set and no section, so from
 * the basket onwards it is a dish: the app adds it, prices it per branch and
 * orders it the way it does any other. What makes it a bundle is the list of
 * dishes inside it, `bundle_items`, which the app shows, sums for the
 * struck-through "bought separately" figure, and copies onto the order line.
 *
 * Having no section is what keeps it off the menu tabs — the app's and this
 * dashboard's — so bundles are listed and edited here, on their own tab.
 */

/** One dish inside a bundle. */
export type BundleItem = {
  menuItemId: string;
  /** Its name, for the row and the picker. */
  label: string;
  /** Its brand price, minor units of the shop's currency. */
  price: number;
  quantity: number;
};

export type Bundle = {
  id: string;
  storeId: string;
  storeName: string;
  /** The shop's currency — every price here is in it. */
  currencyCode: string;
  name: Localized;
  description: Localized | null;
  imageUrl: string | null;
  /** The bundle's own price, which is what a customer is charged. */
  price: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  items: BundleItem[];
};

export type BundleDraft = {
  storeId: string;
  name: Localized;
  description: Localized | null;
  imageUrl: string | null;
  price: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  items: { menuItemId: string; quantity: number }[];
};

const COLUMNS = `id, store_id, name, description, image_url, price, is_active,
   starts_at, ends_at, sort_order,
   stores ( name, currency_code ),
   bundle_items!bundle_items_bundle_id_fkey ( menu_item_id, quantity, sort_order,
     dish:menu_items!bundle_items_menu_item_id_fkey ( name, price ) )`;

/**
 * Every live bundle, every shop — or those matching a term.
 *
 * Capped, not paged, for the same reason promotions are: the order is the
 * operator's, and a position within a page is not one.
 */
export async function fetchBundles(search: string): Promise<Bundle[]> {
  let query = getClient()
    .from("menu_items")
    .select(COLUMNS)
    .eq("is_bundle", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(PAGE.cap);

  const term = search.trim();
  if (term) query = query.or(likeAny(["name->>en", "name->>ar", "slug"], term));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the bundles: ${error.message}`);

  return (data ?? []).map((row) => toBundle(row as Record<string, unknown>));
}

/** A row as PostgREST returns it, to the shape the screens use. */
export function toBundle(row: Record<string, unknown>): Bundle {
  const store = firstOf(row.stores);
  const links = Array.isArray(row.bundle_items)
    ? (row.bundle_items as Record<string, unknown>[])
    : [];

  return {
    id: row.id as string,
    storeId: row.store_id as string,
    storeName: store ? pickLocalized((store.name as Localized) ?? {}) : "",
    currencyCode: (store?.currency_code as string | undefined) ?? "",
    name: (row.name as Localized | null) ?? {},
    description: (row.description as Localized | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    price: (row.price as number | null) ?? 0,
    isActive: Boolean(row.is_active),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    sortOrder: (row.sort_order as number | null) ?? 0,
    items: [...links]
      .sort(
        (a, b) =>
          ((a.sort_order as number | null) ?? 0) -
          ((b.sort_order as number | null) ?? 0),
      )
      .map((link) => {
        const dish = firstOf(link.dish);
        return {
          menuItemId: link.menu_item_id as string,
          label: dish ? pickLocalized((dish.name as Localized) ?? {}) : "",
          price: (dish?.price as number | null) ?? 0,
          quantity: (link.quantity as number | null) ?? 1,
        };
      }),
  };
}

/** What the dishes inside cost one by one — the figure the app strikes through. */
export function separatePrice(
  items: readonly { price: number; quantity: number }[],
): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** The bundle's own columns, from a draft. */
export function toColumns(draft: BundleDraft): Record<string, unknown> {
  return {
    name: titleLocalized(draft.name),
    // Null when blank, never `{}` — see `localizedOrNull`.
    description: cleanLocalized(localizedOrNull(draft.description ?? {})),
    image_url: draft.imageUrl?.trim() || null,
    price: draft.price,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
  };
}

/**
 * A new bundle: the row, then its dishes, then switched on.
 *
 * Written hidden first, the way a promotion is, so a bundle is never on offer
 * without its contents: the app would refuse it anyway (`bundle_is_sellable`),
 * but a row that is "Live" here and missing in the app is a puzzle for whoever
 * reads the list. A failure on the dishes archives the half-made row.
 */
export async function createBundle(
  draft: BundleDraft,
  sortOrder: number,
): Promise<string> {
  const client = getClient();

  const { data, error } = await client
    .from("menu_items")
    .insert({
      ...toColumns(draft),
      store_id: draft.storeId,
      menu_section_id: null,
      is_bundle: true,
      is_active: false,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) throw new Error(friendly(error.message));

  const id = data.id as string;
  try {
    await setBundleItems(id, draft.items);
  } catch (failure) {
    await client
      .from("menu_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    throw failure;
  }

  if (draft.isActive) {
    const { error: liveError } = await client
      .from("menu_items")
      .update({ is_active: true })
      .eq("id", id);
    if (liveError) throw new Error(friendly(liveError.message));
  }

  return id;
}

export async function updateBundle(id: string, draft: BundleDraft): Promise<void> {
  const { error } = await getClient()
    .from("menu_items")
    .update({ ...toColumns(draft), is_active: draft.isActive })
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));

  await setBundleItems(id, draft.items);
}

/** The switch in the row, on its own. */
export async function setBundleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getClient()
    .from("menu_items")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/** The whole list in one call — `api_v1_set_bundle_items`, atomic. */
async function setBundleItems(
  id: string,
  items: BundleDraft["items"],
): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_bundle_items", {
    p_bundle_id: id,
    p_items: items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    })),
  });
  if (error) throw new Error(friendly(error.message));
}

/** Soft, like a dish: order lines reference it. */
export async function archiveBundle(id: string): Promise<void> {
  const { error } = await getClient()
    .from("menu_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setBundleOrder(
  updates: readonly { id: string; sortOrder: number }[],
): Promise<void> {
  const client = getClient();
  for (const update of updates) {
    const { error } = await client
      .from("menu_items")
      .update({ sort_order: update.sortOrder })
      .eq("id", update.id);
    if (error) throw new Error(error.message);
  }
}

/** A dish that can go in a bundle, for the picker. */
export type BundleDish = { id: string; label: string; price: number };

/**
 * One shop's dishes matching a term — never another bundle, which `0204`
 * refuses inside a bundle.
 */
export async function searchBundleDishes(
  term: string,
  storeId: string,
): Promise<BundleDish[]> {
  let query = getClient()
    .from("menu_items")
    .select("id, name, price")
    .eq("store_id", storeId)
    .eq("is_bundle", false)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(50);

  const cleaned = term.trim();
  if (cleaned) query = query.or(likeAny(["name->>en", "name->>ar"], cleaned));

  const { data, error } = await query;
  if (error) throw new Error(`Could not search dishes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: pickLocalized((row.name as Localized) ?? {}),
    price: (row.price as number | null) ?? 0,
  }));
}

/** What each branch charges for this bundle where it says anything — `branch_item_prices`. */
export async function fetchBundleBranchPrices(
  id: string,
): Promise<Record<string, number>> {
  const { data, error } = await getClient()
    .from("branch_item_prices")
    .select("branch_id, price")
    .eq("menu_item_id", id);
  if (error) throw new Error(`Could not read branch prices: ${error.message}`);

  return Object.fromEntries(
    (data ?? []).map((row) => [row.branch_id as string, row.price as number]),
  );
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
  if (message.includes("menu_items_window_ordered")) {
    return t("bundles.windowBackwards");
  }
  if (message.includes("bundle_items_quantity_sane")) {
    return t("bundles.quantityRange");
  }
  if (message.includes("bundle_items_same_store")) {
    return t("bundles.sameShop");
  }
  if (message.includes("bundle_items_no_nesting")) {
    return t("bundles.noNesting");
  }
  if (message.includes("bundle_items_once_idx")) {
    return t("bundles.dishTwice");
  }
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  return message;
}
