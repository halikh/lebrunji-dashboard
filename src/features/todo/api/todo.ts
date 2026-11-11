import { fetchCouriers } from "@/features/drivers/api/couriers";
import { fetchAppSettings } from "@/features/settings/api/app-settings";
import { getClient } from "@/lib/supabase/client";
import { PAGE } from "@/lib/limits";
import type { Localized } from "@/lib/validation";
import { clipToOurHours, daysOutsideOurHours } from "@/lib/week";

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
  /** Set when the gap is one branch's (a branch on markup under a shop on commission). */
  branchId?: string;
  branchName?: Localized;
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

/** A live branch with no street address (required since `0198`). */
export type AddressTodo = {
  branchId: string;
  branchName: Localized;
  storeId: string;
  storeName: Localized;
  storeActive: boolean;
  /** How many live branches the shop has: one is edited on the shop's Details. */
  branchCount: number;
};

export type TodoList<T> = { rows: T[]; truncated: boolean };

/**
 * Live shops on commission with no rate entered (`0262`): commission chosen
 * and the rate left empty, or nothing chosen at all, which is commission.
 *
 * Either way it is commission at 0%: every order from the shop records
 * nothing for us, and the driver hands the shop the whole of its part. A shop
 * on markup is set — its margin is in its store prices, not a rate.
 */
export async function fetchStoresWithoutCommission(): Promise<
  TodoList<StoreTodo>
> {
  const client = getClient();
  const [stores, earnings] = await Promise.all([
    client
      .from("stores")
      .select("id, name, is_active")
      .is("deleted_at", null)
      .order("admin_sort_order", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("store_earnings")
      .select("store_id, model, commission_percent")
      .is("branch_id", null),
  ]);

  if (stores.error)
    throw new Error(`Could not read shops: ${stores.error.message}`);
  if (earnings.error)
    throw new Error(`Could not read commission: ${earnings.error.message}`);

  const settled = new Set(
    (earnings.data ?? [])
      .filter((row) => row.model === "markup" || row.commission_percent != null)
      .map((row) => row.store_id as string),
  );
  const rows = (stores.data ?? []).filter(
    (row) => !settled.has(row.id as string),
  );

  return {
    rows: rows.slice(0, PAGE.cap).map((row) => ({
      id: row.id as string,
      name: (row.name as Localized) ?? {},
      isActive: row.is_active as boolean,
    })),
    truncated: rows.length > PAGE.cap,
  };
}

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
 * Dishes on markup with no markup filled in (`0262`): no price from the shop,
 * so the shop is paid the whole price and we keep nothing on it.
 *
 * Two kinds of place are on markup. A shop on markup: its dishes need the
 * shop's own price from the shop. A branch on markup under a shop on
 * commission: its dishes need the branch's own, since the shop-wide editors
 * do not ask for one there (`usesMarkup` reads the shop alone) — a shop row
 * left from an earlier spell on markup still counts. Bundles are dishes and
 * count too; dishes in an archived aisle do not, since nobody can order them.
 */
export async function fetchItemsWithoutMarkup(): Promise<TodoList<ItemTodo>> {
  const client = getClient();
  const places = await client
    .from("store_earnings")
    .select(
      `store_id, branch_id, model,
       stores!inner ( id, name, deleted_at ),
       branches ( id, name, deleted_at )`,
    )
    .is("stores.deleted_at", null);
  if (places.error)
    throw new Error(`Could not read markup shops: ${places.error.message}`);

  const names = new Map<string, Localized>();
  const shopModel = new Map<string, string | null>();
  for (const row of places.data ?? []) {
    const store = one(row.stores) as { id: string; name: Localized } | null;
    if (!store) continue;
    names.set(store.id, store.name ?? {});
    if (row.branch_id === null)
      shopModel.set(store.id, row.model as string | null);
  }
  /** Shops on markup themselves. */
  const markupShops = new Set(
    [...shopModel].filter(([, model]) => model === "markup").map(([id]) => id),
  );
  /** Live branches on markup whose shop is not. */
  const markupBranches = (places.data ?? []).flatMap((row) => {
    const branch = one(row.branches) as {
      id: string;
      name: Localized;
      deleted_at: string | null;
    } | null;
    if (!branch || branch.deleted_at !== null || row.model !== "markup")
      return [];
    if (markupShops.has(row.store_id as string)) return [];
    return [
      {
        storeId: row.store_id as string,
        id: branch.id,
        name: branch.name ?? {},
      },
    ];
  });
  const storeIds = [
    ...new Set([...markupShops, ...markupBranches.map((b) => b.storeId)]),
  ];
  if (storeIds.length === 0) return { rows: [], truncated: false };

  const [items, priced] = await Promise.all([
    client
      .from("menu_items")
      .select("id, name, is_active, store_id, menu_sections ( deleted_at )")
      .in("store_id", storeIds)
      .is("deleted_at", null)
      .order("id", { ascending: true }),
    client
      .from("item_store_prices")
      .select("menu_item_id, branch_id, menu_items!inner ( store_id )")
      .in("menu_items.store_id", storeIds),
  ]);
  if (items.error)
    throw new Error(`Could not read menu items: ${items.error.message}`);
  if (priced.error)
    throw new Error(
      `Could not read prices from shops: ${priced.error.message}`,
    );

  /** "item" for the shop's own row, "item:branch" for a branch's. */
  const done = new Set(
    (priced.data ?? []).map((row) =>
      row.branch_id === null
        ? (row.menu_item_id as string)
        : `${row.menu_item_id as string}:${row.branch_id as string}`,
    ),
  );
  const live = (items.data ?? []).filter((row) => {
    // No section is a bundle; an archived aisle is off every menu.
    const section = one(row.menu_sections) as {
      deleted_at: string | null;
    } | null;
    return !section || section.deleted_at === null;
  });

  const rows: ItemTodo[] = [];
  for (const row of live) {
    const id = row.id as string;
    const storeId = row.store_id as string;
    const base = {
      id,
      name: (row.name as Localized) ?? {},
      isActive: row.is_active as boolean,
      storeId,
      storeName: names.get(storeId) ?? {},
    };
    if (markupShops.has(storeId)) {
      if (!done.has(id)) rows.push(base);
      continue;
    }
    for (const branch of markupBranches) {
      if (branch.storeId !== storeId) continue;
      if (done.has(`${id}:${branch.id}`) || done.has(id)) continue;
      rows.push({ ...base, branchId: branch.id, branchName: branch.name });
    }
  }

  return {
    rows: rows.slice(0, PAGE.cap),
    truncated: rows.length > PAGE.cap,
  };
}

/**
 * Live shops with at least one live branch that has no opening hours.
 *
 * Hours belong to the branch since `0101`, and a branch with no
 * `branch_hours` rows is open around the clock (`0170` `branch_open_at`) — a
 * missing *day* reads as closed, a missing *week* as never closed — so a shop
 * like that takes orders at 4 a.m. and the kitchen is not there to cook them.
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

/**
 * Live branches with no address in English — the language every reader falls
 * back to, and the one `0198` requires.
 *
 * Every live branch is read rather than filtering on `address is null`, because
 * `{"ar": …}` alone is as missing as nothing, and because a one-branch shop is
 * fixed on a different page than a chain's branch — so the count is needed.
 */
export async function fetchBranchesWithoutAddress(): Promise<
  TodoList<AddressTodo>
> {
  const { data, error } = await getClient()
    .from("branches")
    .select(
      `id, name, address, store_id,
       stores!inner ( id, name, is_active, deleted_at )`,
    )
    .is("deleted_at", null)
    .is("stores.deleted_at", null)
    .order("store_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(PAGE.cap + 1);

  if (error) throw new Error(`Could not read branches: ${error.message}`);
  const rows = data ?? [];

  const counts = new Map<string, number>();
  for (const row of rows.slice(0, PAGE.cap)) {
    const storeId = row.store_id as string;
    counts.set(storeId, (counts.get(storeId) ?? 0) + 1);
  }

  const missing: AddressTodo[] = [];
  for (const row of rows.slice(0, PAGE.cap)) {
    const store = one(row.stores) as {
      id: string;
      name: Localized | null;
      is_active: boolean;
    } | null;
    if (!store) continue;
    const address = row.address as Localized | null;
    if ((address?.en ?? "").trim().length > 0) continue;
    missing.push({
      branchId: row.id as string,
      branchName: (row.name as Localized) ?? {},
      storeId: store.id,
      storeName: store.name ?? {},
      storeActive: store.is_active,
      branchCount: counts.get(store.id) ?? 1,
    });
  }

  return { rows: missing, truncated: rows.length > PAGE.cap };
}

/** PostgREST hands back a to-one embed as an object, or as a one-row array. */
function one(value: unknown): unknown {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * An active driver whose week does not fit our ordering hours (0280).
 *
 * - `none`: no working days at all, so they are never offered;
 * - `outside`: some days run past our hours. That time does not count — they
 *   are offered only while we are open — so the week says something that
 *   will not happen, and whoever reads it plans around it.
 *
 * `days` are the stored indexes (Sunday first) of the days that run past.
 */
export type DriverTodo = {
  id: string;
  name: string;
  reason: "none" | "outside";
  days: number[];
  /** Every working minute is outside our hours: never offered at all. */
  never: boolean;
};

export async function fetchDriversToFix(): Promise<TodoList<DriverTodo>> {
  const [couriers, settings] = await Promise.all([
    fetchCouriers(),
    fetchAppSettings(),
  ]);
  const ours = { openHour: settings.openHour, closeHour: settings.closeHour };
  const rows: DriverTodo[] = [];
  for (const courier of couriers) {
    if (!courier.isActive) continue;
    if (courier.hours.length === 0) {
      rows.push({
        id: courier.id,
        name: courier.name,
        reason: "none",
        days: [],
        never: true,
      });
      continue;
    }
    const days = daysOutsideOurHours(courier.hours, ours);
    if (days.length === 0) continue;
    rows.push({
      id: courier.id,
      name: courier.name,
      reason: "outside",
      days,
      never: clipToOurHours(courier.hours, ours).length === 0,
    });
  }
  // A handful of people, read whole: never truncated.
  return { rows, truncated: false };
}
