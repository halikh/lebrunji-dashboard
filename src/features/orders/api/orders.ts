import { getClient } from "@/lib/supabase/client";
import { startOfBusinessDay } from "@/lib/time";

/**
 * Reading and advancing orders.
 *
 * Organised by feature rather than by technical role, following
 * `src/features/README.md` in the app: a change to ordering touches one folder
 * instead of four.
 *
 * ## The shapes here are the dashboard's, not the database's
 *
 * These functions return `Order`, not a row. Column names stay inside this
 * file, so renaming `orders.placed_at` is one edit here rather than a sweep
 * through every screen — the same reason the app moved its menu read behind
 * `api_v1_store_menu`.
 */

/** One shop's portion of an order. The status lives here, not on the order. */
export type OrderStore = {
  id: string;
  storeId: string;
  storeName: string;
  statusSlug: string;
  statusName: string;
  /** Position on the path. `null` is terminal and off it — cancelled. */
  progress: number | null;
  subtotal: number;
};

export type OrderLine = {
  id: string;
  orderStoreId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
  options: string[];
};

export type Order = {
  id: string;
  code: string;
  placedAt: string;
  customerName: string;
  customerPhone: string;
  addressLine: string;
  courierNote: string | null;
  currencyCode: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  stores: OrderStore[];
};

export type OrderStatus = {
  id: string;
  slug: string;
  name: string;
  progress: number | null;
};

/**
 * Every status, in path order.
 *
 * `order_statuses` is a lookup table rather than an enum precisely so a
 * merchant can insert a step without an app release, so the queue's tabs are
 * built from this rather than from a hardcoded list.
 *
 * Cancelled has `progress: null` and sorts last — it is off the path, not at
 * the end of it.
 */
export async function fetchOrderStatuses(
  locale = "en",
): Promise<OrderStatus[]> {
  const { data, error } = await getClient()
    .from("order_statuses")
    .select("id, slug, name, progress")
    .order("progress", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Could not read order statuses: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: localized(row.name, locale),
    progress: row.progress as number | null,
  }));
}

/**
 * Which orders the queue is looking at.
 *
 * Deliberately **not** a date filter with "today" as the default. An order
 * placed at 23:50 last night and still unconfirmed is the most urgent thing on
 * the screen, and a date filter is precisely what would hide it. So the primary
 * split is by whether an order still needs somebody.
 */
export type Scope = "live" | "today" | "all";

export type OrderPage = {
  orders: Order[];
  /** Feed back as `before` for the next page; `null` when the list is exhausted. */
  cursor: string | null;
};

/**
 * A page of orders, newest first.
 *
 * ## Keyset, not offset
 *
 * `before` is the last row's `placed_at`, so the database seeks straight to it.
 * `offset` would make every page cost more than the last, and on a live queue
 * an order arriving mid-scroll shifts every subsequent page by one — so an
 * offset pager both slows down and starts duplicating rows exactly when it is
 * busiest. Served by `orders_placed_at_idx` (migration 0067).
 */
export async function fetchOrders(options: {
  scope?: Scope;
  statusSlug?: string | null;
  /** Every status, so "live" can be derived rather than hardcoded. */
  statuses?: readonly OrderStatus[];
  search?: string | null;
  before?: string | null;
  limit?: number;
  locale?: string;
}): Promise<OrderPage> {
  const {
    scope = "live",
    statusSlug = null,
    statuses = [],
    search = null,
    before = null,
    limit = 50,
    locale = "en",
  } = options;

  // The scope decides which statuses are in play before the tab narrows it
  // further. `live` is the set that still needs somebody — read from the data,
  // never a hardcoded list of slugs, because `order_statuses` exists to be
  // added to and a new step would silently fall outside a hardcoded set. An
  // order nobody can see is the worst bug this screen could have.
  const liveSlugs = liveStatusSlugs(statuses);
  const filterSlugs = statusSlug
    ? [statusSlug]
    : scope === "live" && liveSlugs.length > 0
      ? liveSlugs
      : null;

  // `!inner` on the status is what makes the tab filter work.
  //
  // A plain embed filters the *child*: the order stays in the list with no
  // shops attached, so a tab shows rows that do not belong to it. An inner join
  // drops the parent when nothing matches, which is the question actually being
  // asked — and because it filters in the database, a full page is a full page
  // of that status rather than fifty rows of which four qualify.
  //
  // An order spanning two shops at different statuses legitimately appears
  // under both tabs. That is the schema's shape and the operator has to act on
  // each leg separately.
  const embed = filterSlugs
    ? `order_stores!inner ( id, store_id, subtotal,
         stores ( name ),
         order_statuses!inner ( slug, name, progress ) )`
    : `order_stores ( id, store_id, subtotal,
         stores ( name ),
         order_statuses ( slug, name, progress ) )`;

  let query = getClient()
    .from("orders")
    .select(
      `id, code, placed_at, address_line, courier_note, currency_code,
       subtotal, delivery_fee, discount, total,
       users:user_id ( name, phone ),
       ${embed}`,
    )
    .is("deleted_at", null)
    .order("placed_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("placed_at", before);

  if (filterSlugs) {
    query = query.in("order_stores.order_statuses.slug", filterSlugs);
  }

  if (scope === "today") {
    // Beirut's midnight — not UTC's, and not the machine's. A laptop still set
    // to another timezone would otherwise show a different day's orders from
    // the one beside it, and neither would be the shop's.
    query = query.gte("placed_at", startOfBusinessDay().toISOString());
  }

  if (search) {
    // The code is what a customer reads out over the phone, and they read out
    // the tail of it. A leading wildcard cannot use the index, but this is a
    // person waiting on another person, not a scan.
    query = query.ilike("code", `%${searchTerm(search)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not read orders: ${error.message}`);

  const orders = (data ?? []).map((row) => toOrder(row, locale));

  return {
    orders,
    cursor:
      orders.length === limit
        ? (orders[orders.length - 1]?.placedAt ?? null)
        : null,
  };
}

/** One order, with its lines. The queue does not need lines; the panel does. */
export async function fetchOrder(
  id: string,
  locale = "en",
): Promise<Order & { lines: OrderLine[] }> {
  const { data, error } = await getClient()
    .from("orders")
    .select(
      `id, code, placed_at, address_line, courier_note, currency_code,
       subtotal, delivery_fee, discount, total,
       users:user_id ( name, phone ),
       order_stores ( id, store_id, subtotal,
         stores ( name ),
         order_statuses ( slug, name, progress ),
         order_lines ( id, name, quantity, unit_price, note,
           order_line_options ( item_options ( name ) ) ) )`,
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(`Could not read order: ${error.message}`);

  const order = toOrder(data, locale);
  const lines: OrderLine[] = [];

  for (const store of asArray(data.order_stores)) {
    for (const line of asArray(store.order_lines)) {
      lines.push({
        id: line.id as string,
        orderStoreId: store.id as string,
        // The snapshot taken at purchase, not today's name: this is a record of
        // what was sold, and the item may since have been renamed or deleted.
        name: localized(line.name, locale),
        quantity: line.quantity as number,
        unitPrice: line.unit_price as number,
        note: (line.note as string | null) ?? null,
        options: asArray(line.order_line_options).map((o) =>
          localized(asRecord(o.item_options)?.name, locale),
        ),
      });
    }
  }

  return { ...order, lines };
}

/**
 * How many order-portions sit at each status. Drives the tab counts.
 *
 * One `head` request per status, counted in the database — never a select of
 * every row to be counted in the browser. `delivered` only grows, so reading it
 * all back would mean transferring the entire order history to draw a number
 * beside a tab, and it would get slower every week the business succeeds.
 *
 * Served by `order_stores_status_order_idx` (migration 0067), which carries
 * `order_id` after the status precisely so a count is answerable from the index.
 */
export async function fetchStatusCounts(
  statuses: readonly OrderStatus[],
): Promise<Record<string, number>> {
  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await getClient()
        .from("order_stores")
        .select("id", { count: "exact", head: true })
        .eq("order_status_id", status.id);

      if (error)
        throw new Error(`Could not count ${status.slug}: ${error.message}`);
      return [status.slug, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(results);
}

/**
 * Moves one shop's portion of an order.
 *
 * The RPC, not an update. `order_stores` carries the subtotal and the shop as
 * well as the status, and an `update` policy would grant all three — so
 * migration 0064 exposes exactly this one column, refuses a move off a terminal
 * status, and refuses an unknown slug rather than writing a null.
 */
export async function setOrderStatus(
  orderStoreId: string,
  statusSlug: string,
): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_order_status", {
    p_order_store_id: orderStoreId,
    p_status_slug: statusSlug,
  });

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Reads one language out of a translated column.
 *
 * Falls back to `en`, then to any non-empty value, then to an empty string —
 * the same rule `pickLocalized` applies in the app. A half-filled row degrades
 * to something readable rather than blanking the row.
 */
function localized(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const candidates = [record[locale], record.en, ...Object.values(record)];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0)
      return candidate;
  }
  return "";
}

/**
 * PostgREST returns an embedded relation as an object or an array depending on
 * its cardinality, and the difference is not always visible from the select.
 * Normalising once here keeps that quirk out of every call site.
 */
function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value))
    return (value[0] as Record<string, unknown>) ?? null;
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  return null;
}

function toOrder(row: Record<string, unknown>, locale: string): Order {
  const user = asRecord(row.users);

  return {
    id: row.id as string,
    code: row.code as string,
    placedAt: row.placed_at as string,
    // An account that never finished setup has an empty name — that is the flag
    // the app routes on. Rendering it blank would read as a data fault.
    customerName: ((user?.name as string) ?? "").trim(),
    customerPhone: (user?.phone as string) ?? "",
    addressLine: row.address_line as string,
    courierNote: (row.courier_note as string | null) ?? null,
    currencyCode: row.currency_code as string,
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    discount: row.discount as number,
    total: row.total as number,
    stores: asArray(row.order_stores).map((store) => {
      const status = asRecord(store.order_statuses);
      return {
        id: store.id as string,
        storeId: store.store_id as string,
        storeName: localized(asRecord(store.stores)?.name, locale),
        statusSlug: (status?.slug as string) ?? "",
        statusName: localized(status?.name, locale),
        progress: (status?.progress as number | null) ?? null,
        subtotal: store.subtotal as number,
      };
    }),
  };
}

/**
 * The statuses an order can still be moved on from.
 *
 * Terminal is derived: `progress: null` is off the path (cancelled), and the
 * highest `progress` is the end of it (delivered). Everything else is live.
 *
 * Derived rather than listed because `order_statuses` is a lookup table
 * specifically so a merchant can insert a step (migration 0032 says so). A
 * hardcoded `['ordered', 'confirmed', 'driverSent']` would exclude any new one
 * from the default view — orders that exist and that nobody is shown.
 */
export function liveStatusSlugs(statuses: readonly OrderStatus[]): string[] {
  const onPath = statuses.filter((s) => s.progress !== null);
  if (onPath.length === 0) return [];

  const last = Math.max(...onPath.map((s) => s.progress as number));
  return onPath.filter((s) => (s.progress as number) < last).map((s) => s.slug);
}

/**
 * Normalises however a code was typed.
 *
 * Codes look like `#DL-260830-00042` and arrive read aloud, copied out of a
 * message, or with the hash left off. The hash and any spaces go; **the hyphens
 * stay**, because they are in the stored value — stripping them produced a term
 * that could never match anything, which is the kind of search bug that reads
 * as "there are no orders".
 *
 * So `#DL-260830-00042`, `DL-260830-00042` and `00042` all find it. Typing
 * across a hyphen without one does not, which is the acceptable half of the
 * trade.
 */
export function searchTerm(input: string): string {
  return input.trim().replace(/^#/, "").replace(/\s+/g, "");
}
