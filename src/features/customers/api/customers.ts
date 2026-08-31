import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { PAGE } from "@/lib/limits";
import { businessMonthKey, businessWeekday, recentMonthKeys } from "@/lib/time";

/**
 * Customers.
 *
 * ## Read-mostly, and the two writes are RPCs
 *
 * Almost everything here is looking something up: a customer rings about an
 * order, and the operator needs their number, their addresses and what they
 * have bought. The only writes are suspending an account and closing one, and
 * both go through `api_v1_*` functions rather than an update policy.
 *
 * That follows `0064`'s reasoning: an `update` policy on `users` would also
 * permit rewriting `phone`, which is the credential a customer signs in with.
 * The functions touch what they are named after and nothing else.
 *
 * ## Suspension only started meaning something in `0078`
 *
 * `users.is_active` was written on signup and by `delete_own_account` and read
 * by **nothing** — a switch here would have flipped a column and left the
 * suspended customer ordering. `0078` narrowed `users_select_own` so a
 * suspended profile read returns nothing, which every shipped build already
 * treats as signed out, and the RPC revokes their sessions on the way.
 *
 * Worth knowing when reading the screen: it is enforced by the customer being
 * unable to *read themselves*, not by a check in the app. That is why it works
 * on builds shipped months ago.
 *
 * ## An empty name is a state, not a blank
 *
 * `users.name = ''` is how this schema records "signed in, never finished
 * setup" — `0045` and `0046` are about the constraint that allows it. So an
 * empty name reads as *Incomplete signup* rather than as a nameless row, or the
 * list looks broken for the customers who are simply mid-way through.
 */

export type Customer = {
  id: string;
  /** Empty string is "setup unfinished" — see the file header. */
  name: string;
  phone: string;
  isActive: boolean;
  /** Set once the account has been closed. Closed accounts are read-only. */
  deletedAt: string | null;
  createdAt: string;
  /** How many orders they have placed, ever. Cancelled ones included. */
  orderCount: number;
};

/**
 * Which customers the list is showing.
 *
 * Three states rather than two, because "not active" covers two very different
 * situations and collapsing them would hide the one that is reversible.
 * Suspended is a door held shut by the operator; closed is an account whose
 * phone number has been released and which can never be reopened.
 */
export type CustomerScope = "all" | "active" | "suspended" | "closed";

export type CustomerPage = {
  customers: Customer[];
  /** Feed back as `before` for the next page; `null` when the list is done. */
  cursor: string | null;
};

const COLUMNS = `id, name, phone, is_active, deleted_at, created_at,
   orders ( count )`;

/**
 * A page of customers, newest first.
 *
 * ## Keyset, not offset
 *
 * `before` is the last row's `created_at`, so the database seeks straight to
 * it — served by `users_created_at_idx` (0078). `offset` would make every page
 * cost more than the last, and a signup arriving mid-scroll would shift every
 * subsequent page by one.
 *
 * ## Closed accounts are listed
 *
 * Unlike every catalogue list here, this does **not** filter `deleted_at`. A
 * closed account still has orders attached and is still the thing somebody
 * rings up about, so hiding it would make those orders trace back to nobody.
 * The row says it is closed and offers no actions.
 *
 * ## Both columns are searched, and the phone is searched loosely
 *
 * A person on the telephone reads out a number in whatever grouping they think
 * in, and an operator types what they hear. So the term is stripped to digits
 * before it is matched against `phone`, and matched as a fragment — the stored
 * form is international (`+961…`) and nobody says it that way.
 */
export async function fetchCustomers(options: {
  scope?: CustomerScope;
  search?: string | null;
  before?: string | null;
  limit?: number;
}): Promise<CustomerPage> {
  const {
    scope = "all",
    search = null,
    before = null,
    limit = PAGE.size,
  } = options;

  let query = getClient()
    .from("users")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  // In the query, never a filter over the rows already fetched. Filtering a
  // page client-side is how a tab shows four rows out of fifty and calls itself
  // full - and on a keyset list it also breaks the cursor, because the last row
  // *kept* is not the last row read.
  if (scope === "active") {
    query = query.is("deleted_at", null).eq("is_active", true);
  } else if (scope === "suspended") {
    query = query.is("deleted_at", null).eq("is_active", false);
  } else if (scope === "closed") {
    query = query.not("deleted_at", "is", null);
  }

  const term = search?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const matches = [`name.ilike.%${term}%`];
    // Only when there are digits to match. A bare `%%` on the phone would
    // return every row and quietly turn a name search into no search at all.
    if (digits) matches.push(`phone.ilike.%${digits}%`);
    query = query.or(matches.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not read customers: ${error.message}`);

  const customers = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? "",
    phone: (row.phone as string) ?? "",
    isActive: Boolean(row.is_active),
    deletedAt: (row.deleted_at as string | null) ?? null,
    createdAt: row.created_at as string,
    orderCount: countOf(row.orders),
  }));

  return {
    customers,
    cursor:
      customers.length === limit
        ? (customers[customers.length - 1]?.createdAt ?? null)
        : null,
  };
}

export type CustomerCounts = Record<CustomerScope, number>;

/**
 * How many customers are in each tab.
 *
 * Four `head` requests, never a select whose rows are counted in the browser.
 * The whole point of a number on a tab is that it is the size of a set the
 * screen has *not* loaded — counting what was fetched would make every tab read
 * "50", which is worse than no number because it looks like an answer.
 *
 * `Promise.all`, so the four go out together: they are independent and the
 * strip should fill in one beat rather than four.
 */
export async function fetchCustomerCounts(): Promise<CustomerCounts> {
  const client = getClient();
  const head = { count: "exact" as const, head: true };

  const [all, active, suspended, closed] = await Promise.all([
    client.from("users").select("id", head),
    client
      .from("users")
      .select("id", head)
      .is("deleted_at", null)
      .eq("is_active", true),
    client
      .from("users")
      .select("id", head)
      .is("deleted_at", null)
      .eq("is_active", false),
    client.from("users").select("id", head).not("deleted_at", "is", null),
  ]);

  const failure = [all, active, suspended, closed].find((one) => one.error);
  if (failure?.error) {
    throw new Error(`Could not count customers: ${failure.error.message}`);
  }

  return {
    all: all.count ?? 0,
    active: active.count ?? 0,
    suspended: suspended.count ?? 0,
    closed: closed.count ?? 0,
  };
}

export type CustomerAddress = {
  id: string;
  label: string | null;
  line: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type CustomerOrder = {
  id: string;
  code: string;
  placedAt: string;
  total: number;
  currencyCode: string;
  /** The snapshot taken when the order was placed, not the address book's. */
  addressLine: string;
  /**
   * One per shop on the order, deduplicated.
   *
   * The slug rides along with the name because it is what the status ramp is
   * keyed on — `statusTone` maps a slug onto the palette, and a chip built from
   * the *name* would either be uncoloured or need a second lookup table that
   * drifts from the first the moment somebody renames a status.
   */
  statuses: { slug: string; name: string }[];
};

export type CustomerDetail = Customer & {
  addresses: CustomerAddress[];
  /** Null when they have never opened the app's settings. */
  locale: string | null;
  /** Null means "whatever the shop prices in" - `0028` says so explicitly. */
  currencyCode: string | null;
};

/**
 * One customer's profile: who they are, where they are, what they prefer.
 *
 * Their orders are **not** here. They have their own paginated read below,
 * because the profile page shows all of them and "all" is not a number this
 * could put a limit on and still be honest about.
 *
 * Three reads rather than one nested select, deliberately. PostgREST can embed
 * all of this, and the result is a query whose `deleted_at` filters apply to
 * *children* - so a customer with three archived addresses comes back looking
 * like a customer with none, and there is no way to tell that from the shape.
 * The menu had exactly this bug. Separate reads each say what they filter.
 */
export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const client = getClient();

  const [profile, addresses, preferences] = await Promise.all([
    client.from("users").select(COLUMNS).eq("id", id).single(),

    client
      .from("addresses")
      .select("id, label, line, is_default, latitude, longitude")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),

    client
      .from("user_preferences")
      .select("locale, currency_code")
      .eq("user_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (profile.error) {
    throw new Error(`Could not read the customer: ${profile.error.message}`);
  }
  if (addresses.error) throw new Error(addresses.error.message);
  if (preferences.error) throw new Error(preferences.error.message);

  return {
    id: profile.data.id as string,
    name: (profile.data.name as string) ?? "",
    phone: (profile.data.phone as string) ?? "",
    isActive: Boolean(profile.data.is_active),
    deletedAt: (profile.data.deleted_at as string | null) ?? null,
    createdAt: profile.data.created_at as string,
    orderCount: countOf(profile.data.orders),

    addresses: (addresses.data ?? []).map((row) => ({
      id: row.id as string,
      label: (row.label as string | null) ?? null,
      line: row.line as string,
      isDefault: Boolean(row.is_default),
      latitude: (row.latitude as number | null) ?? null,
      longitude: (row.longitude as number | null) ?? null,
    })),

    locale: (preferences.data?.locale as string | null) ?? null,
    currencyCode: (preferences.data?.currency_code as string | null) ?? null,
  };
}

export type CustomerOrderPage = {
  orders: CustomerOrder[];
  cursor: string | null;
};

/**
 * A page of one customer's orders, newest first.
 *
 * Keyset on `placed_at`, the same way the order queue pages - served by
 * `orders_user_placed_idx` (0032), which is `(user_id, placed_at desc)` and is
 * exactly this query.
 *
 * The status rides along because it is the first thing anybody asks about a
 * past order. An order spanning two shops has two of them, so the *set* is
 * carried rather than one: showing the first would be a claim about the order
 * that is only true when it has one shop on it.
 */
export async function fetchCustomerOrders(options: {
  id: string;
  before?: string | null;
  limit?: number;
  locale?: string;
}): Promise<CustomerOrderPage> {
  const { id, before = null, limit = PAGE.size, locale = "en" } = options;

  let query = getClient()
    .from("orders")
    .select(
      `id, code, placed_at, total, currency_code, address_line,
       order_stores ( order_statuses ( slug, name ) )`,
    )
    .eq("user_id", id)
    .is("deleted_at", null)
    .order("placed_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("placed_at", before);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read their orders: ${error.message}`);

  const orders = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    placedAt: row.placed_at as string,
    total: row.total as number,
    currencyCode: row.currency_code as string,
    addressLine: (row.address_line as string) ?? "",
    // Deduplicated on the slug: two shops at the same step are one chip, not
    // the same word twice.
    statuses: [
      ...new Map(
        asArray(row.order_stores).flatMap((portion) => {
          const status = asArray(portion.order_statuses)[0];
          if (!status) return [];
          const slug = status.slug as string;
          const name = status.name as Record<string, string> | null;
          return [
            [slug, { slug, name: name?.[locale] || name?.en || slug }] as const,
          ];
        }),
      ).values(),
    ],
  }));

  return {
    orders,
    cursor:
      orders.length === limit
        ? (orders[orders.length - 1]?.placedAt ?? null)
        : null,
  };
}

export type CustomerRedemption = {
  id: string;
  /** What the promotion was called when it was given. See below. */
  label: string;
  /** In the order's currency, in minor units. */
  amount: number;
  redeemedAt: string;
  orderId: string;
  orderCode: string;
  currencyCode: string;
};

/**
 * Every promotion this customer has actually been given.
 *
 * ## Why `discount_redemptions.label` and not the discount's own name
 *
 * `0016` calls a redemption a **receipt line**: it records what the customer
 * was told they saved on, at the moment they saved it. That is history, not
 * content, so it is plain text and it is not re-translated later. Joining back
 * to `discounts` for a name would show what the promotion is called *today* —
 * and a merchant who renamed one would silently rewrite what every past
 * customer was told.
 *
 * The row is joined to `orders` all the same, for the code and the currency:
 * the amount is meaningless without the second, and the first is what makes a
 * redemption traceable to the bill it came off.
 *
 * ## Why the whole list rather than a page
 *
 * Redemptions are bounded by promotions, which are bounded by how many a
 * merchant runs — a customer with a hundred of these is not a case worth paging
 * for, and the block is a summary beside their orders rather than a screen of
 * its own. The cap is stated rather than assumed.
 */
export async function fetchCustomerRedemptions(
  id: string,
): Promise<CustomerRedemption[]> {
  const { data, error } = await getClient()
    .from("discount_redemptions")
    // Inner, so a redemption whose order was soft-deleted drops out rather
    // than coming back with nothing to point at.
    .select(
      "id, label, amount, redeemed_at, order_id, orders!inner ( code, currency_code )",
    )
    .eq("user_id", id)
    .order("redeemed_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Could not read their promotions: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const order = asArray(row.orders)[0];
    return {
      id: row.id as string,
      label: (row.label as string | null) ?? "",
      amount: row.amount as number,
      redeemedAt: row.redeemed_at as string,
      orderId: row.order_id as string,
      orderCode: (order?.code as string) ?? "",
      currencyCode: (order?.currency_code as string) ?? "",
    };
  });
}

export type CustomerStats = {
  orderCount: number;
  /**
   * What they have spent, per currency.
   *
   * Per currency rather than one figure, because `0028` lets a customer order
   * from shops pricing differently and a sum across two currencies is a number
   * in no currency at all. Usually one entry; the type is what stops that
   * assumption becoming a wrong total.
   */
  totals: { code: string; amount: number }[];
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  /** True when the cap below was reached, so the figures are a floor. */
  truncated: boolean;

  /**
   * The last twelve **Beirut** months, oldest first, including empty ones.
   *
   * Empty months are in the array on purpose: a chart drawn only from months
   * that have orders shows an unbroken run of bars for a customer who stopped
   * six months ago, which is the opposite of what the shape is for. A gap is
   * the finding.
   */
  months: { key: string; orders: number; amount: number }[];

  /**
   * Orders per day of the week, Sunday first — the order `Date#getDay` and
   * `store_hours.day_of_week` both use. Screens that read Monday first rotate
   * it themselves, deliberately keeping the two orders separate.
   */
  byWeekday: number[];

  /** The currency the series are counted in — see `seriesCurrency` below. */
  seriesCurrency: string | null;
};

/**
 * What a customer has spent, and when they first and last ordered.
 *
 * Reads the totals rather than asking the database to sum them: PostgREST's
 * aggregate functions are off by default on a hosted project, and a screen that
 * works or does not depending on a server setting is worse than one that reads
 * a bounded number of rows.
 *
 * `CAP` is the assumption, made checkable - the same shape as `fetchStores`'
 * limit. A customer with more orders than that is one whose figures are a
 * floor, and the screen says so rather than quietly under-reporting.
 */
export async function fetchCustomerStats(id: string): Promise<CustomerStats> {
  const CAP = 1000;

  const { data, error } = await getClient()
    .from("orders")
    .select("total, currency_code, placed_at")
    .eq("user_id", id)
    .is("deleted_at", null)
    .order("placed_at", { ascending: false })
    .limit(CAP + 1);

  if (error) throw new Error(`Could not total their orders: ${error.message}`);

  const rows = (data ?? []).slice(0, CAP);
  const truncated = (data ?? []).length > CAP;

  const totals = new Map<string, number>();
  for (const row of rows) {
    const code = row.currency_code as string;
    totals.set(code, (totals.get(code) ?? 0) + (row.total as number));
  }

  /**
   * Which currency the money series is drawn in.
   *
   * The busiest one, and only when there is exactly one: bars whose heights
   * mixed dollars and lira would be a chart of nothing. With two currencies the
   * amounts are dropped and the months chart falls back to counting orders,
   * which is still true.
   */
  const seriesCurrency = totals.size === 1 ? [...totals.keys()][0] : null;

  // Every month in the window, then filled — not only the months with orders.
  // A chart built from what exists shows an unbroken run of bars for somebody
  // who stopped ordering six months ago, and the gap is the whole finding.
  const months = new Map(
    recentMonthKeys(12).map((key) => [key, { key, orders: 0, amount: 0 }]),
  );
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];

  for (const row of rows) {
    const placedAt = row.placed_at as string;

    // Bucketed in **Beirut**, never the machine's zone: an order at 00:30 on a
    // Saturday here is still Friday in London, and a laptop that travelled
    // would draw a different chart from the one beside it.
    const bucket = months.get(businessMonthKey(placedAt));
    if (bucket) {
      bucket.orders += 1;
      if (seriesCurrency && row.currency_code === seriesCurrency) {
        bucket.amount += row.total as number;
      }
    }

    byWeekday[businessWeekday(placedAt)] += 1;
  }

  return {
    orderCount: rows.length,
    totals: [...totals].map(([code, amount]) => ({ code, amount })),
    // Ordered newest first, so the ends of the array are the ends of their
    // history.
    lastOrderAt: (rows[0]?.placed_at as string | undefined) ?? null,
    firstOrderAt:
      (rows[rows.length - 1]?.placed_at as string | undefined) ?? null,
    truncated,
    months: [...months.values()],
    byWeekday,
    seriesCurrency,
  };
}

/**
 * Suspends a customer, or lifts a suspension.
 *
 * The RPC revokes their sessions on the way down, so it takes effect on their
 * next request rather than their next launch. Reinstating does not sign them
 * back in — they sign in again as normal, which is the correct shape: an
 * operator can reopen a door, not walk somebody through it.
 */
export async function setCustomerActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_customer_active", {
    p_user: id,
    p_is_active: isActive,
  });
  if (error) throw new Error(friendly(error.message));
}

/**
 * Closes an account for good.
 *
 * Not a harder suspension: it releases the phone number, so the customer can
 * sign up again from scratch and gets a *new* account rather than this one
 * back. That asymmetry is the whole reason it is a separate, confirmed action —
 * and why `api_v1_set_customer_active` refuses to reinstate a closed account.
 *
 * The profile itself is kept, soft-deleted, because `orders.user_id` references
 * it and an order is a financial record that outlives the account (`0001`, and
 * `0041` at length).
 */
export async function closeCustomerAccount(id: string): Promise<void> {
  const { error } = await getClient().rpc("api_v1_close_customer_account", {
    p_user: id,
  });
  if (error) throw new Error(friendly(error.message));
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}

function countOf(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0] as { count?: number } | undefined;
    return first?.count ?? 0;
  }
  if (value && typeof value === "object") {
    return (value as { count?: number }).count ?? 0;
  }
  return 0;
}

/**
 * A refusal from the RPC, as a sentence.
 *
 * These are `raise exception` messages rather than constraint names, so they
 * are already close to readable — but they are English written for a developer,
 * and the rule here is that every message the operator sees comes out of the
 * translation bundle. The raw text survives as the fallback for anything not
 * predicted: an untranslated sentence beats a silent failure.
 */
function friendly(message: string): string {
  if (message.includes("Not permitted")) return t("customers.notPermitted");
  if (message.includes("has been closed")) return t("customers.alreadyClosed");
  if (message.includes("No such customer")) return t("customers.gone");
  if (message.includes("belongs to an operator")) {
    return t("customers.isOperator");
  }
  return message;
}
