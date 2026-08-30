import { getClient } from "@/lib/supabase/client";

/**
 * When a shop is open.
 *
 * ## A missing row means closed, and that is the design
 *
 * `store_hours` holds one window per weekday it opens. A day with no row is a
 * day it does not open — `src/lib/store-hours.ts` in the app reads it exactly
 * that way, so "closed on Monday" is expressed by there being no Monday, not by
 * a row saying `00:00`–`00:00`.
 *
 * That is worth stating because it decides what saving means here: closing a
 * day is a **delete**, not an update, and a save has to do both.
 *
 * ## Overnight windows are legitimate
 *
 * A shop open 18:00–02:00 stores exactly that, with `closes_at` earlier than
 * `opens_at`. Migration 0066 deliberately has no `closes > opens` check for
 * this reason, and neither does this — a validator that "fixed" it would break
 * every late-night kitchen in the catalogue.
 */

export type DayHours = {
  /** 0–6, Sunday first, matching `Date#getDay` and the app's reader. */
  dayOfWeek: number;
  /** Local wall-clock `HH:MM` in the shop's own country. */
  opensAt: string;
  closesAt: string;
};

export async function fetchStoreHours(storeId: string): Promise<DayHours[]> {
  const { data, error } = await getClient()
    .from("store_hours")
    .select("day_of_week, opens_at, closes_at")
    .eq("store_id", storeId)
    .order("day_of_week", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    dayOfWeek: row.day_of_week as number,
    opensAt: (row.opens_at as string).slice(0, 5),
    closesAt: (row.closes_at as string).slice(0, 5),
  }));
}

/**
 * Replaces a shop's whole week.
 *
 * ## Why the whole week and not the day that changed
 *
 * The seven days are edited together on one grid with one Save, because they
 * are read together — "when is this shop open" is a question about the week.
 * Sending the whole thing also makes the write **idempotent**: the same call
 * twice leaves the same seven rows, which matters because it is more than one
 * request and any of them can be retried.
 *
 * The days that are open are upserted on `(store_id, day_of_week)`, which is
 * unique. The days that are closed are deleted in one statement — including the
 * ones that were already closed, which is a no-op and cheaper than working out
 * which of them changed.
 *
 * Not atomic, for the reason `setSortOrder` gives at length: PostgREST has no
 * transaction, and a `security definer` function taking arbitrary rows is a
 * wider hole than this fixes. A half-applied week is a wrong timetable rather
 * than a broken one, the caller refetches on success *and* failure so the
 * screen shows whatever actually landed, and running it again fixes it.
 */
export async function saveStoreHours(
  storeId: string,
  week: DayHours[],
): Promise<void> {
  const client = getClient();

  const open = week.filter((day) => day.opensAt && day.closesAt);
  const closed = [0, 1, 2, 3, 4, 5, 6].filter(
    (day) => !open.some((one) => one.dayOfWeek === day),
  );

  if (closed.length > 0) {
    const { error } = await client
      .from("store_hours")
      .delete()
      .eq("store_id", storeId)
      .in("day_of_week", closed);
    if (error) throw new Error(error.message);
  }

  if (open.length > 0) {
    const { error } = await client.from("store_hours").upsert(
      open.map((day) => ({
        store_id: storeId,
        day_of_week: day.dayOfWeek,
        opens_at: day.opensAt,
        closes_at: day.closesAt,
      })),
      { onConflict: "store_id,day_of_week" },
    );
    if (error) throw new Error(error.message);
  }
}
