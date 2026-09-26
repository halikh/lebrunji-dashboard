import { oneShopRate } from "@/features/reference/shop-rate";
import { getClient } from "@/lib/supabase/client";
import {
  isFinishedSlug,
  ORDER_STATUS_SLUGS,
  statusName,
  statusProgress,
} from "@/lib/order-status";
import { startOfBusinessDay } from "@/lib/time";
import { unitNumber } from "@/lib/units";

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
  /**
   * The options' share of `unitPrice` — added once to a line sold by amount
   * rather than scaled with it. `0` on every line placed before `0122`, which
   * is right: those lines are counted, and `linePrice` never reads it.
   */
  optionsPrice: number;
  /**
   * What this line was sold by, snapshotted at placement — `0122`.
   *
   * Not read live off `menu_items`, unlike the picture above: a line is the
   * record of what was agreed, and repricing it against a menu that has since
   * changed its step would restate somebody's bill.
   */
  priceUnit: string | null;
  unitQuantity: number | null;
  unitStep: number | null;
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
  /**
   * The rate this order's figures are **read** at, or null for the platform's.
   *
   * `stores.exchange_rate` — `0120` — when exactly one shop is on the order,
   * because that is the shop whose menu the customer read and whose door they
   * will settle at. More than one shop and it is null: two shops quoting two
   * rates give a cross-shop total no single rate is right for, and picking one
   * would be the dashboard deciding whose dollar is the real one.
   *
   * Display only, like every conversion. What was charged is `total` in
   * `currencyCode`, and `0120` left the money path alone.
   */
  shopRate: number | null;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  stores: OrderStore[];
};

export type { OrderStatus } from "@/lib/order-status";

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
  search?: string | null;
  before?: string | null;
  limit?: number;
  locale?: string;
}): Promise<OrderPage> {
  const {
    scope = "live",
    statusSlug = null,
    search = null,
    before = null,
    limit = 50,
    locale = "en",
  } = options;

  // The scope decides which statuses are in play before the tab narrows it
  // further. `live` is the set that still needs somebody — every status that
  // is not finished.
  const filterSlugs = statusSlug
    ? [statusSlug]
    : scope === "live"
      ? liveStatusSlugs()
      : null;

  // `!inner` on the portions is what makes the tab filter work.
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
  // `exchange_rate` is the shop's own rate — `0120`. Read wherever an order
  // is, because `toOrder` resolves the rate its figures are read at and the
  // queue and the panel must not disagree about that.
  const embed = filterSlugs
    ? `order_stores!inner ( id, store_id, subtotal, status,
         stores ( name, exchange_rate ) )`
    : `order_stores ( id, store_id, subtotal, status,
         stores ( name, exchange_rate ) )`;

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
    query = query.in("order_stores.status", filterSlugs);
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
       order_stores ( id, store_id, subtotal, status,
         stores ( name, image_url, whatsapp_phone, exchange_rate ),
         order_lines ( id, menu_item_id, name, quantity, unit_price, note,
           options_price, price_unit, unit_quantity, unit_step,
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
        optionsPrice: (line.options_price as number | null) ?? 0,
        priceUnit: (line.price_unit as string | null) ?? null,
        // `numeric` arrives from PostgREST as a string — arbitrary precision,
        // which JSON has no type for. Parsed here rather than at each screen.
        unitQuantity: unitNumber(line.unit_quantity as string | number | null),
        unitStep: unitNumber(line.unit_step as string | number | null),
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
  scope: Scope = "all",
): Promise<Record<string, number>> {
  const since = scope === "today" ? startOfBusinessDay().toISOString() : null;

  const results = await Promise.all(
    ORDER_STATUS_SLUGS.map(async (slug) => {
      let query = getClient()
        .from("orders")
        .select("id, order_stores!inner(status)", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null)
        .eq("order_stores.status", slug);

      if (since) query = query.gte("placed_at", since);

      const { count, error } = await query;
      if (error) throw new Error(`Could not count ${slug}: ${error.message}`);
      return [slug, count ?? 0] as const;
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
    shopRate: oneShopRate(asArray(row.order_stores)),
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    discount: row.discount as number,
    total: row.total as number,
    stores: asArray(row.order_stores).map((store) => {
      const slug = (store.status as string | null) ?? "";
      return {
        id: store.id as string,
        storeId: store.store_id as string,
        storeName: localized(asRecord(store.stores)?.name, locale),
        storeWhatsapp:
          (asRecord(store.stores)?.whatsapp_phone as string | null) ?? null,
        storeImageUrl:
          (asRecord(store.stores)?.image_url as string | null) ?? null,
        statusSlug: slug,
        statusName: statusName(slug),
        progress: statusProgress(slug),
        subtotal: store.subtotal as number,
      };
    }),
  };
}

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
 * ## "Live" is every status that is not finished
 *
 * `liveStatusSlugs` derives it from the hardcoded path, so the badge, the
 * queue's Live scope and `live_order_count()` in the database mean the same
 * thing by it.
 */
export async function fetchLiveOrderCount(): Promise<number> {
  const { count, error } = await getClient()
    .from("orders")
    .select("id, order_stores!inner(status)", {
      count: "exact",
      head: true,
    })
    .is("deleted_at", null)
    .in("order_stores.status", liveStatusSlugs());

  if (error) throw new Error(`Could not count live orders: ${error.message}`);
  return count ?? 0;
}

/**
 * The statuses an order can still be moved on from — everything but delivered
 * and cancelled, in path order.
 */
export function liveStatusSlugs(): string[] {
  return ORDER_STATUS_SLUGS.filter((slug) => !isFinishedSlug(slug));
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
