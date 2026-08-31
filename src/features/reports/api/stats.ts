import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

/**
 * The overview's figures, aggregated in Postgres.
 *
 * ## Why one RPC and not eight queries
 *
 * Every number on the screen is an aggregate over the same window. Computing
 * them client-side would mean downloading every order in the range into the
 * browser to add them up — which works on a demo and is unusable on a year of
 * trade. `api_v1_admin_stats` does the arithmetic where the rows are and
 * returns one object.
 *
 * ## The buckets are Beirut's
 *
 * `0064` bucketed `daily` and `hourly` with bare `date_trunc` and `extract`,
 * which resolve in the **session's** timezone — and PostgREST connects as UTC.
 * So the first two or three hours of every Beirut day were filed under the
 * previous day's bar, and the "when are we busy" strip drew every late-night
 * order two or three hours early. `0079` fixed both, and `daily.day` now
 * arrives as a `YYYY-MM-DD` Beirut calendar day with nothing left to
 * interpret.
 *
 * The payload states its own `timezone` for that reason: a chart labelled with
 * days is a claim about whose days they are.
 *
 * ## Cancelled orders are counted, never earned
 *
 * An order counts as cancelled only when *every* shop on it is — a two-shop
 * order with one live half is still live, and still owed to somebody. The
 * cancelled ones appear in `totals.cancelled` and are excluded from every
 * revenue figure.
 */

export type Stats = {
  from: string;
  to: string;
  /** The zone the day and hour buckets were cut in. */
  timezone: string;

  totals: {
    revenue: number;
    orders: number;
    deliveryFees: number;
    discounts: number;
    averageOrder: number;
    cancelled: number;
  };

  /** One entry per Beirut day in the range, including days with nothing. */
  daily: { day: string; revenue: number; orders: number }[];

  /** Only the buckets with something in them; the screen draws the empty grid. */
  hourly: { dayOfWeek: number; hour: number; orders: number }[];

  funnel: { slug: string; progress: number | null; count: number }[];

  topItems: {
    menuItemId: string;
    /**
     * The name at the time of purchase, not today's — and **jsonb**, not text.
     *
     * `0054` moved `order_lines.name` to a localised column for the same reason
     * every other name here is one: the snapshot has to be readable by whoever
     * reads it, not only by whoever ordered it. So this arrives as
     * `{"en": …, "ar": …}` and goes through `pickLocalized`, exactly like a
     * store's name.
     */
    name: Localized;
    quantity: number;
    revenue: number;
  }[];

  topStores: {
    storeId: string;
    /** jsonb since `0051`, like every other merchant-facing name. */
    name: Localized;
    orders: number;
    revenue: number;
  }[];

  deliveryBands: {
    upToKm: number;
    amount: number;
    orders: number;
    revenue: number;
  }[];
};

/**
 * Statistics over `[from, to)`.
 *
 * Half-open on purpose, and it matches the function: an order placed at exactly
 * the boundary belongs to one period, not to both. A closed range would
 * double-count it in the comparison against the previous period, which is the
 * one place a single order can visibly change a percentage.
 */
export async function fetchStats(from: Date, to: Date): Promise<Stats> {
  const { data, error } = await getClient().rpc("api_v1_admin_stats", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error) throw new Error(`Could not read the figures: ${error.message}`);

  // The contract is already the shape — the function returns the app's
  // vocabulary (`averageOrder`, not `average_order`), so there is nothing to
  // map. The cast is the whole of it.
  return data as unknown as Stats;
}
