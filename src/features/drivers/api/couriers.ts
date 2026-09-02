import type { DayHours } from "@/features/catalog/api/hours";
import { SEARCH } from "@/lib/limits";
import { isOpenNow } from "@/lib/week";
import { getClient } from "@/lib/supabase/client";

/**
 * The drivers an order can be handed to.
 *
 * A small table (migration `0081`) with no customer-facing side: nothing in the
 * app reads it, and its RLS policy is operators only, because a driver's mobile
 * number is not part of what an order discloses.
 *
 * ## The phone is stored the way it is used
 *
 * Digits, international, no `+` — which is exactly what a `wa.me` link takes.
 * Normalising on the way *in* means no screen has to strip punctuation on the
 * way out, and there is one place where "05 12 34 56" becomes a number rather
 * than one per caller, each slightly different.
 */

export type Courier = {
  id: string;
  name: string;
  /** Digits only, international, no `+`. */
  phone: string;
  sortOrder: number;
  /**
   * When they work, one window per weekday they do.
   *
   * A day with no entry is a day off — the same rule `store_hours` follows, and
   * the reason there is no `isActive` here any more. Whether a driver is taking
   * orders is *read* from this against the clock (`isOpenAt`), not set by hand:
   * a switch somebody has to remember twice a day is one that is wrong at
   * exactly the hours it matters. See migration 0084.
   */
  hours: DayHours[];
  /** Still on the books. `false` is a driver who has left — never deleted. */
  isActive: boolean;
  /**
   * Overrules the rota for tonight, or `null` to follow it.
   *
   * Three states rather than two, and `null` is the point: it is the default,
   * and it is what a driver goes back to. A plain boolean would mean that the
   * first time anybody flipped a switch the rota stopped applying to that
   * person for ever — silently, until they were dispatched at four in the
   * morning. See migration 0085.
   */
  availableOverride: boolean | null;
};

// One literal, not a concatenation: supabase-js parses this string at the type
// level to work out the row shape, and a `+` between two halves defeats that —
// every read then comes back as an error union and the mappers stop compiling.
const COLUMNS =
  "id, name, phone, sort_order, available_override, deleted_at, courier_hours ( day_of_week, opens_at, closes_at )";

function toCourier(row: Record<string, unknown>): Courier {
  const hours = Array.isArray(row.courier_hours)
    ? (row.courier_hours as Record<string, unknown>[])
    : [];

  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    sortOrder: row.sort_order as number,
    availableOverride: (row.available_override as boolean | null) ?? null,
    isActive: row.deleted_at === null,
    hours: hours
      .map((day) => ({
        dayOfWeek: day.day_of_week as number,
        opensAt: day.opens_at as string,
        closesAt: day.closes_at as string,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  };
}

/**
 * Every driver on the books, archived ones excluded.
 *
 * Not paginated, and deliberately: this is an address book of a handful of
 * people, not a list. A screen that pages through three rows spends a query on
 * saying there are no more.
 *
 * ## The search still goes to the database
 *
 * Even here, where the whole list is already in the browser. Filtering the
 * loaded rows would work today and would be the wrong shape the moment a shop
 * runs a dozen drivers across two shifts — and the plan's rule exists precisely
 * because that failure is silent: a search that only finds what you can already
 * see shows nothing and reads as "we do not have that".
 *
 * **Punctuation in a number is ignored.** Somebody looking for a driver types
 * the number the way they say it — `70 123 456` — and the column holds digits.
 * Searching the raw term against a normalised column finds nothing at all,
 * which is the least helpful possible answer to a correct query.
 */
export async function fetchCouriers(search = ""): Promise<Courier[]> {
  const term = search.trim();

  // Inactive drivers are included and filtered on screen. They are not deleted
  // rows to be hidden — they are people who have left, and the list has a tab
  // for finding them again.
  let query = getClient()
    .from("couriers")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (term.length >= SEARCH.minTerm) {
    const digits = digitsOf(term);
    query = query.or(
      [
        `name.ilike.%${term}%`,
        // Only when the term contains digits at all: a bare `%%` matches every
        // row, so a name search would quietly return the whole table and look
        // like the filter had failed.
        ...(digits ? [`phone.ilike.%${digits}%`] : []),
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not read drivers: ${error.message}`);
  return (data ?? []).map(toCourier);
}

/** One driver, for their own page. Null when the id is not a live driver. */
export async function fetchCourier(id: string): Promise<Courier | null> {
  const { data, error } = await getClient()
    .from("couriers")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not read the driver: ${error.message}`);
  return data ? toCourier(data) : null;
}

/**
 * An order handed to a driver.
 *
 * Deliberately narrow about what it claims. See migration 0083: this says the
 * operator opened a chat about this order, not that the driver read it and not
 * that anything arrived. Whether it was *delivered* is what the order's status
 * says, and that is set by a person.
 */
export type Dispatch = {
  id: string;
  dispatchedAt: string;
  orderId: string;
  orderCode: string;
  orderTotal: number;
  currencyCode: string;
  statusSlug: string;
  statusName: string;
};

/** What this driver has been given, newest first. */
export async function fetchDispatches(
  courierId: string,
  limit = 50,
): Promise<Dispatch[]> {
  const { data, error } = await getClient()
    .from("order_dispatches")
    .select(
      `id, dispatched_at,
       orders ( id, code, total, currency_code,
         order_stores ( order_statuses ( slug, name ) ) )`,
    )
    .eq("courier_id", courierId)
    .order("dispatched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not read the handovers: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const order = asRecord(row.orders);
    if (!order) return [];

    // An order can span two shops and therefore two statuses. The row shows the
    // *least advanced* one, because "what still needs doing" is the question a
    // driver's page is being read to answer — and an order that is half
    // delivered is not delivered.
    const status = asArray(order.order_stores)
      .map((portion) => asRecord(portion.order_statuses))
      .find(Boolean);

    return [
      {
        id: row.id as string,
        dispatchedAt: row.dispatched_at as string,
        orderId: order.id as string,
        orderCode: order.code as string,
        orderTotal: Number(order.total),
        currencyCode: order.currency_code as string,
        statusSlug: (status?.slug as string) ?? "",
        statusName: localizedName(status?.name),
      },
    ];
  });
}

/**
 * Records that an order was handed over.
 *
 * Called as the WhatsApp link is followed rather than after it — there is no
 * "after". The chat opens in another tab or another application and nothing
 * comes back, so this is the only moment the dashboard knows anything happened.
 *
 * A failure here is swallowed by the caller on purpose: losing the record is
 * bad, and blocking the hand-off because the record could not be written is
 * worse. The food is going out either way.
 */
export async function recordDispatch(
  orderId: string,
  courierId: string,
): Promise<void> {
  const { error } = await getClient()
    .from("order_dispatches")
    .insert({ order_id: orderId, courier_id: courierId });

  if (error) throw new Error(error.message);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value))
    return (value[0] as Record<string, unknown>) ?? null;
  return (value as Record<string, unknown>) ?? null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/** A jsonb name, in English or whatever there is. */
function localizedName(value: unknown): string {
  if (typeof value === "string") return value;
  const record = value as Record<string, string> | null;
  if (!record) return "";
  return record.en ?? Object.values(record)[0] ?? "";
}

export type CourierDraft = {
  name: string;
  phone: string;
  /** The week. Omitted on an edit that is only changing the name or number. */
  hours?: DayHours[];
  /**
   * `undefined` leaves it alone; `null` clears it back to the rota.
   *
   * The distinction matters because "do not touch this" and "stop overruling
   * the rota" are different instructions and both have to be expressible — a
   * patch that treated them the same would either be unable to clear an
   * override or would clear one every time somebody renamed a driver.
   */
  availableOverride?: boolean | null;
};

export async function createCourier(draft: CourierDraft): Promise<Courier> {
  const { data, error } = await getClient()
    .from("couriers")
    .insert({ name: draft.name.trim(), phone: digitsOf(draft.phone) })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  const created = toCourier(data);
  if (draft.hours) await saveCourierHours(created.id, draft.hours);
  return created;
}

export async function updateCourier(
  id: string,
  patch: Partial<CourierDraft>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.phone !== undefined) row.phone = digitsOf(patch.phone);
  if (patch.availableOverride !== undefined)
    row.available_override = patch.availableOverride;

  if (Object.keys(row).length > 0) {
    const { error } = await getClient()
      .from("couriers")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (patch.hours) await saveCourierHours(id, patch.hours);
}

/**
 * Writes a driver's week.
 *
 * The same two-step `saveStoreHours` does, and for the same reasons: a closed
 * day is the **absence** of a row, so saving has to delete as well as insert,
 * and the delete covers days that were already closed because that is a no-op
 * and cheaper than working out which ones changed.
 *
 * Not atomic. PostgREST has no transaction and a `security definer` function
 * taking arbitrary rows is a wider hole than this fixes — a half-applied week
 * is a wrong timetable rather than a broken one, the caller refetches on
 * success *and* failure so the screen shows what actually landed, and running
 * it again fixes it.
 */
export async function saveCourierHours(
  courierId: string,
  week: DayHours[],
): Promise<void> {
  const client = getClient();

  const working = week.filter((day) => day.opensAt && day.closesAt);
  const off = [0, 1, 2, 3, 4, 5, 6].filter(
    (day) => !working.some((one) => one.dayOfWeek === day),
  );

  if (off.length > 0) {
    const { error } = await client
      .from("courier_hours")
      .delete()
      .eq("courier_id", courierId)
      .in("day_of_week", off);
    if (error) throw new Error(error.message);
  }

  if (working.length > 0) {
    const { error } = await client.from("courier_hours").upsert(
      working.map((day) => ({
        courier_id: courierId,
        day_of_week: day.dayOfWeek,
        opens_at: day.opensAt,
        closes_at: day.closesAt,
      })),
      { onConflict: "courier_id,day_of_week" },
    );
    if (error) throw new Error(error.message);
  }
}

/**
 * Whether a driver is still on the books.
 *
 * **There is no delete.** A driver who has left still appears on every order
 * they carried, and a row removed from under `order_dispatches` would leave a
 * history pointing at a name nobody can look up — which is the history somebody
 * reads precisely when an old order is being questioned.
 *
 * So it is `deleted_at`, used as an on/off rather than as a tombstone: clearing
 * it brings the same person back, with the same number. That matters more here
 * than on most tables, because re-typing a phone number is where a digit gets
 * lost, and a wrong digit sends a customer's address to a stranger.
 *
 * The two states are different questions and both are needed:
 *
 * - **Active** — do they work here at all. Set by hand, changes rarely.
 * - **Taking orders** — are they working *now*. Read from `courier_hours`, with
 *   `available_override` for tonight's exception.
 *
 * An inactive driver is never offered, whatever their rota says.
 */
export async function setCourierActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await getClient()
    .from("couriers")
    .update({ deleted_at: active ? null : new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * A typed phone number as digits.
 *
 * A leading `00` is the other way of writing `+`, and people type both. Dropping
 * it rather than keeping it is the difference between `009611234567` — which
 * WhatsApp reads as an unknown country — and a number that rings.
 */
export function digitsOf(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

/**
 * Whether a driver is taking orders **now**.
 *
 * One function, because the question is asked in five places — the row's badge,
 * the two filter tabs, the profile, and which names the dispatch dialog offers
 * — and a rule spelled out five times is one that will be spelled differently
 * in the fifth.
 *
 * The override wins where it is set, and `null` falls through to the rota. That
 * order is the whole design: the rota is the standing answer and the override
 * is tonight's exception, not the other way round.
 */
export function isTakingOrders(courier: Courier, now?: Date): boolean {
  // Someone who has left is never taking orders, whatever their old rota or a
  // stale override says. The employment state wins over both.
  if (!courier.isActive) return false;
  return courier.availableOverride ?? isOpenNow(courier.hours, now);
}

/** Is the rota currently being overruled? The screens have to say so. */
export function isOverridden(courier: Courier): boolean {
  return courier.availableOverride !== null;
}
