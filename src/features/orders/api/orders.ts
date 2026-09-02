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
  storeImageUrl: string | null;
  /**
   * Where this kitchen is sent its half of the order, or null.
   *
   * On the portion rather than fetched separately: the panel already joins
   * `stores` for the name and the picture, and a second query for one column
   * would be a round trip to answer a question the first one was already
   * asking.
   */
  storeWhatsapp: string | null;
  statusSlug: string;
  statusName: string;
  /** Position on the path. `null` is terminal and off it — cancelled. */
  progress: number | null;
  subtotal: number;
};

export type OrderLine = {
  id: string;
  orderStoreId: string;
  /** Which dish this was, for offering a substitute that is not the same one. */
  menuItemId: string;
  name: string;
  /**
   * Today's picture, not a snapshot.
   *
   * The *name* and the *price* on a line are snapshots — they are what was
   * agreed. The image is not stored on the line, so this is whatever the item
   * carries now, and it is null for an item since deleted. That is acceptable
   * for a picture whose only job is helping somebody check a bag, and it is
   * worth knowing before anyone treats it as evidence.
   */
  imageUrl: string | null;
  quantity: number;
  /**
   * How many are actually coming, when that is not what was ordered.
   *
   * `null` is the ordinary case and means "as ordered" — which is why it is a
   * separate column rather than an edit to `quantity`. `quantity` is the
   * snapshot of what the customer asked for and must stay readable after the
   * fact; this is what the kitchen could fill. `0` is a line that is not coming
   * at all, and it stays on the receipt struck through, because a vanished line
   * tells the customer nothing.
   */
  fulfilledQuantity: number | null;
  /** The line this one arrived instead of, for a substitution. */
  replacesLineId: string | null;
  /** Why this line differs. See migration 0082 for the vocabulary. */
  amendmentReason: string | null;
  unitPrice: number;
  note: string | null;
  options: string[];
};

export type Order = {
  id: string;
  code: string;
  placedAt: string;
  /**
   * When the order was last changed after being placed, if it ever was.
   *
   * On the header rather than worked out from the lines, so the queue can mark
   * an amended order without fetching them.
   */
  amendedAt: string | null;
  /**
   * Who placed it, so a receipt can lead to their profile.
   *
   * `orders.user_id` rather than a lookup by name: two customers can share a
   * name, and a link that guessed would open the wrong person's history.
   */
  customerId: string;
  customerName: string;
  customerPhone: string;
  addressLine: string;
  courierNote: string | null;
  /**
   * Where the address is, if it is known.
   *
   * Read from `addresses`, not from the order: `orders` snapshots the address
   * *line* (migration 0024) and never the coordinates. So this is the pin as it
   * stands **now** — null for a one-time address with no `address_id`, and
   * stale if the customer has since moved the pin. The line is the record; this
   * is only a convenience for finding the door.
   */
  latitude: number | null;
  longitude: number | null;
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
       subtotal, delivery_fee, discount, total, amended_at,
       user_id,
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
       subtotal, delivery_fee, discount, total, amended_at,
       user_id,
       users:user_id ( name, phone ),
       addresses:address_id ( latitude, longitude ),
       order_stores ( id, store_id, subtotal,
         stores ( name, image_url, whatsapp_phone ),
         order_statuses ( slug, name, progress ),
         order_lines ( id, menu_item_id, name, quantity, unit_price, note,
           fulfilled_quantity, replaces_line_id, amendment_reason,
           menu_items ( image_url ),
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
        menuItemId: line.menu_item_id as string,
        // The snapshot taken at purchase, not today's name: this is a record of
        // what was sold, and the item may since have been renamed or deleted.
        name: localized(line.name, locale),
        quantity: line.quantity as number,
        fulfilledQuantity: (line.fulfilled_quantity as number | null) ?? null,
        replacesLineId: (line.replaces_line_id as string | null) ?? null,
        amendmentReason: (line.amendment_reason as string | null) ?? null,
        unitPrice: line.unit_price as number,
        note: (line.note as string | null) ?? null,
        imageUrl:
          (asRecord(line.menu_items)?.image_url as string | null) ?? null,
        options: asArray(line.order_line_options).map((o) =>
          localized(asRecord(o.item_options)?.name, locale),
        ),
      });
    }
  }

  return { ...order, lines };
}

/**
 * How many orders sit at each status, **within the current scope**.
 *
 * Scoped, because a count that ignores the scope contradicts the list beside
 * it: Today showing four orders under a tab labelled thirty-nine is not a
 * detail, it is the screen disagreeing with itself.
 *
 * ## What is being counted
 *
 * Orders, not portions — the order is the operator's unit. An order counts
 * toward a status when **any** of its shops is at it, so a two-shop order split
 * across two statuses appears under both. That is the honest reading of "this
 * status has work at N orders", and the alternative — deriving one status per
 * order in SQL — would need a function for a number beside a tab.
 *
 * One `head` request per status, counted in the database. Never a select whose
 * rows are counted in the browser: `delivered` only grows, so that would mean
 * transferring the whole order history to draw a number, getting slower every
 * week the business succeeds.
 */
export async function fetchStatusCounts(
  statuses: readonly OrderStatus[],
  scope: Scope = "all",
): Promise<Record<string, number>> {
  const since = scope === "today" ? startOfBusinessDay().toISOString() : null;

  const results = await Promise.all(
    statuses.map(async (status) => {
      let query = getClient()
        .from("orders")
        .select("id, order_stores!inner(order_statuses!inner(slug))", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null)
        .eq("order_stores.order_statuses.slug", status.slug);

      if (since) query = query.gte("placed_at", since);

      const { count, error } = await query;
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

/**
 * Sets a whole order's status.
 *
 * **The order is the unit, not the shop.** A customer who orders from two shops
 * places one order: they are told one status, they wait for one delivery, and
 * it arrives on one courier run — `place_order` prices the delivery from the
 * farthest shop precisely because the basket is one journey. "Half confirmed"
 * is not a state anybody outside the schema can act on.
 *
 * One call, not a loop over the portions. A loop that fails on its third
 * request leaves an order half-moved, with no record of what was intended; the
 * function is atomic, so either the order moved or it did not. It is also
 * idempotent, which is what makes the optimistic UI safe to retry.
 */
export async function advanceOrder(
  orderId: string,
  statusSlug: string,
): Promise<number> {
  const { data, error } = await getClient().rpc("api_v1_advance_order", {
    p_order_id: orderId,
    p_status_slug: statusSlug,
  });

  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
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
  const address = asRecord(row.addresses);

  return {
    id: row.id as string,
    code: row.code as string,
    amendedAt: (row.amended_at as string | null) ?? null,
    placedAt: row.placed_at as string,
    // An account that never finished setup has an empty name — that is the flag
    // the app routes on. Rendering it blank would read as a data fault.
    customerId: row.user_id as string,
    customerName: ((user?.name as string) ?? "").trim(),
    customerPhone: (user?.phone as string) ?? "",
    addressLine: row.address_line as string,
    courierNote: (row.courier_note as string | null) ?? null,
    latitude: (address?.latitude as number | null) ?? null,
    longitude: (address?.longitude as number | null) ?? null,
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
        storeWhatsapp:
          (asRecord(store.stores)?.whatsapp_phone as string | null) ?? null,
        storeImageUrl:
          (asRecord(store.stores)?.image_url as string | null) ?? null,
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
/**
 * How many orders still need somebody, for the rail's badge.
 *
 * ## One request, and a count of *orders*
 *
 * Not `fetchStatusCounts` summed. That returns a count per status, and an order
 * spanning two shops at two different steps is counted under both — so adding
 * them up reports more orders than exist, on the one number that is on screen
 * all day. Filtering `orders` by an `!inner` embed counts orders, once each,
 * however many shops are on them.
 *
 * A `head` request, so nothing is transferred: the badge wants a number, and
 * the plan's rule is that a count is never a select whose rows are counted in
 * the browser.
 *
 * ## "Live" is read from the data
 *
 * `liveStatusSlugs` derives it from `progress` rather than a hardcoded list of
 * slugs, because `order_statuses` exists to be added to and a new step would
 * silently fall outside a hardcoded set. An order nobody can see is the worst
 * bug this screen could have, and a badge that undercounts is the quiet version
 * of it.
 */
export async function fetchLiveOrderCount(
  statuses: readonly OrderStatus[],
): Promise<number> {
  const slugs = liveStatusSlugs(statuses);
  if (slugs.length === 0) return 0;

  const { count, error } = await getClient()
    .from("orders")
    .select("id, order_stores!inner(order_statuses!inner(slug))", {
      count: "exact",
      head: true,
    })
    .is("deleted_at", null)
    .in("order_stores.order_statuses.slug", slugs);

  if (error) throw new Error(`Could not count live orders: ${error.message}`);
  return count ?? 0;
}

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
