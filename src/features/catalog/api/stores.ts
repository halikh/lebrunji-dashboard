import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

/**
 * Stores — the shops a customer browses.
 *
 * As with orders, the shapes here are the dashboard's rather than the
 * database's: column names stay in this file, so a rename is one edit.
 */

export type Store = {
  id: string;
  slug: string;
  name: Localized;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  currencyCode: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  /**
   * Where the shop is.
   *
   * Null until a merchant drops the pin, and that is not cosmetic: with no pin
   * `delivery_quote` cannot work out a distance, and `delivery_fee_for_km`
   * charges an unknown distance at the **top band**. So an unpinned store
   * silently overcharges every customer, which is why the list flags it.
   */
  latitude: number | null;
  longitude: number | null;
  prepMinMinutes: number;
  prepMaxMinutes: number;
};

/**
 * Every store, in the merchant's own order.
 *
 * **Not paginated, deliberately** — the one list in the dashboard that is not.
 * Two reasons, and both have to hold or this becomes a bug:
 *
 * 1. The order is `sort_order`, which a merchant sets by dragging. Reordering
 *    across a page boundary is not a thing anybody can do, so a paged list
 *    would break the feature it is sorted for.
 * 2. A marketplace has tens of shops, not thousands. `limit` below is not
 *    decoration: it is the assumption, made checkable. If it is ever hit, this
 *    needs a virtualised list and a different reordering gesture — and the
 *    caller is told rather than silently shown a truncated catalogue.
 */
export async function fetchStores(
  options: { search?: string | null } = {},
): Promise<{
  stores: Store[];
  /** True when the cap was reached — see above. The UI says so. */
  truncated: boolean;
}> {
  const limit = 200;

  let query = getClient()
    .from("stores")
    .select(
      `id, slug, name, image_url, category_id, currency_code, is_active, is_featured,
       sort_order, latitude, longitude, prep_min_minutes, prep_max_minutes,
       categories ( name )`,
    )
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(limit + 1);

  if (options.search) {
    // `search_text` is the trigram-indexed, normalised name maintained by the
    // trigger from migration 0012 — the same column the app's own store search
    // uses, so the dashboard finds a shop by whatever the customer would type.
    query = query.ilike("search_text", `%${normalise(options.search)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not read stores: ${error.message}`);

  const rows = data ?? [];
  const truncated = rows.length > limit;

  return {
    stores: rows.slice(0, limit).map(toStore),
    truncated,
  };
}

/** One store, for a screen that is about that store. */
export async function fetchStore(id: string): Promise<Store> {
  const { data, error } = await getClient()
    .from("stores")
    .select(
      `id, slug, name, image_url, category_id, currency_code, is_active, is_featured,
       sort_order, latitude, longitude, prep_min_minutes, prep_max_minutes,
       categories ( name )`,
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(`Could not read the shop: ${error.message}`);
  return toStore(data);
}

export type StorePatch = {
  name?: Localized;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
};

/**
 * Changes one store.
 *
 * A direct update rather than an RPC: unlike an order's status, there is no
 * column here that staff must not touch — migration 0063 grants the whole row,
 * and the CHECK constraints from 0066 are the backstop. So the narrower gate an
 * RPC would provide has nothing to narrow.
 */
export async function updateStore(
  id: string,
  patch: StorePatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) row.is_featured = patch.isFeatured;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient().from("stores").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Archives a store.
 *
 * Soft, always. `deleted_at` is what every lifecycle table in this schema uses,
 * and the reason is visible in the data: orders reference stores, so a hard
 * delete would either fail on the foreign key or take the order history with
 * it. Archiving keeps the record of what was sold and removes the shop from the
 * storefront, which is what "delete this store" actually means.
 */
export async function archiveStore(id: string): Promise<void> {
  const { error } = await getClient()
    .from("stores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function toStore(row: Record<string, unknown>): Store {
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    imageUrl: (row.image_url as string | null) ?? null,
    categoryId: row.category_id as string,
    categoryName: pick((category as Record<string, unknown> | null)?.name),
    currencyCode: row.currency_code as string,
    isActive: row.is_active as boolean,
    isFeatured: row.is_featured as boolean,
    sortOrder: row.sort_order as number,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    prepMinMinutes: row.prep_min_minutes as number,
    prepMaxMinutes: row.prep_max_minutes as number,
  };
}

/** One readable string out of a translated column, for a label. */
function pick(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const candidate of [record.en, ...Object.values(record)]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}

/**
 * The same normalisation `store_search_text` applies.
 *
 * Lower case and collapsed whitespace — matching what the trigger stored, so a
 * search for "Aurora  Bakery" finds the row it wrote as "aurora bakery".
 */
function normalise(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}
