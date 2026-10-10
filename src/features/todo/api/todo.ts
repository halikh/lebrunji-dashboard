import { getClient } from "@/lib/supabase/client";
import { PAGE } from "@/lib/limits";
import type { Localized } from "@/lib/validation";

/**
 * What the catalogue is still missing before it looks finished to a customer.
 *
 * Three reads, each a plain "where is it empty" over live rows — nothing
 * archived, because a picture missing from a shop nobody can see is not work
 * anybody needs to do. Hidden shops and items *are* counted: hidden is
 * usually "not ready yet", which is exactly what this list is for, and the row
 * says it is hidden so it can be put last.
 *
 * Each read is capped at `PAGE.cap` like every other list here, and says so
 * when it hit the cap rather than presenting the first page as the whole job.
 */

export type StoreTodo = {
  id: string;
  name: Localized;
  isActive: boolean;
};

export type ItemTodo = {
  id: string;
  name: Localized;
  isActive: boolean;
  storeId: string;
  storeName: Localized;
};

export type HoursTodo = {
  storeId: string;
  storeName: Localized;
  storeActive: boolean;
  /** The branches with no opening hours at all. */
  branches: { id: string; name: Localized }[];
  /** How many branches the shop has, so "1 of 3" can be said. */
  branchCount: number;
};

export type TodoList<T> = { rows: T[]; truncated: boolean };

/** Live shops with no picture. */
export async function fetchStoresWithoutImage(): Promise<TodoList<StoreTodo>> {
  const { data, error } = await getClient()
    .from("stores")
    .select("id, name, is_active")
    .is("deleted_at", null)
    // `null` is the only empty: every writer stores `trim() || null`.
    .is("image_url", null)
    .order("admin_sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(PAGE.cap + 1);

  if (error) throw new Error(`Could not read shops: ${error.message}`);
  const rows = data ?? [];

  return {
    rows: rows.slice(0, PAGE.cap).map((row) => ({
      id: row.id as string,
      name: (row.name as Localized) ?? {},
      isActive: row.is_active as boolean,
    })),
    truncated: rows.length > PAGE.cap,
  };
}

/**
 * Live dishes with no picture, with the shop each belongs to.
 *
 * `!inner` on both embeds, so the archived-section and archived-shop filters
 * remove the *item* rather than returning it with a null parent — an item in a
 * deleted section is not on any menu, and is not anybody's job.
 */
export async function fetchItemsWithoutImage(): Promise<TodoList<ItemTodo>> {
  const { data, error } = await getClient()
    .from("menu_items")
    .select(
      `id, name, is_active,
       menu_sections!inner ( deleted_at,
         stores!inner ( id, name, deleted_at ) )`,
    )
    .is("deleted_at", null)
    .is("image_url", null)
    .is("menu_sections.deleted_at", null)
    .is("menu_sections.stores.deleted_at", null)
    .order("id", { ascending: true })
    .limit(PAGE.cap + 1);

  if (error) throw new Error(`Could not read menu items: ${error.message}`);
  const rows = data ?? [];

  return {
    rows: rows.slice(0, PAGE.cap).map((row) => {
      const section = one(row.menu_sections) as {
        stores: unknown;
      } | null;
      const store = one(section?.stores) as {
        id: string;
        name: Localized | null;
      } | null;
      return {
        id: row.id as string,
        name: (row.name as Localized) ?? {},
        isActive: row.is_active as boolean,
        storeId: store?.id ?? "",
        storeName: store?.name ?? {},
      };
    }),
    truncated: rows.length > PAGE.cap,
  };
}

/**
 * Live shops with at least one live branch that has no opening hours.
 *
 * Hours belong to the branch since `0101`, and a branch with no
 * `branch_hours` rows is closed every day of the week — the app reads a
 * missing day as closed — so a shop like that can never be ordered from.
 */
export async function fetchStoresWithoutHours(): Promise<TodoList<HoursTodo>> {
  const { data, error } = await getClient()
    .from("branches")
    .select(
      `id, name, store_id, branch_hours ( count ),
       stores!inner ( id, name, is_active, deleted_at )`,
    )
    .is("deleted_at", null)
    .is("stores.deleted_at", null)
    .order("store_id", { ascending: true })
    .order("sort_order", { ascending: true })
    // Branches, not shops, so the cap is on the larger number; a shop is
    // only ever split across the cap, never silently dropped, because the
    // flag below goes up whenever anything was left out.
    .limit(PAGE.cap + 1);

  if (error) throw new Error(`Could not read branches: ${error.message}`);
  const rows = data ?? [];

  const byStore = new Map<string, HoursTodo>();
  for (const row of rows.slice(0, PAGE.cap)) {
    const store = one(row.stores) as {
      id: string;
      name: Localized | null;
      is_active: boolean;
    } | null;
    if (!store) continue;

    const entry = byStore.get(store.id) ?? {
      storeId: store.id,
      storeName: store.name ?? {},
      storeActive: store.is_active,
      branches: [],
      branchCount: 0,
    };
    entry.branchCount += 1;

    const hours = one(row.branch_hours) as { count: number } | null;
    if ((hours?.count ?? 0) === 0) {
      entry.branches.push({
        id: row.id as string,
        name: (row.name as Localized) ?? {},
      });
    }
    byStore.set(store.id, entry);
  }

  return {
    rows: [...byStore.values()].filter((entry) => entry.branches.length > 0),
    truncated: rows.length > PAGE.cap,
  };
}

/** PostgREST hands back a to-one embed as an object, or as a one-row array. */
function one(value: unknown): unknown {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
