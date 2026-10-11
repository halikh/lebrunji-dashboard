import { t } from "@/i18n/translations";
import { getClient } from "@/lib/supabase/client";

/**
 * When a shop is open.
 *
 * ## A missing row means closed, and that is the design
 *
 * `branch_hours` holds the windows a branch opens in — usually one a day, two
 * for a shop that shuts for the afternoon (07:00–15:00, 19:00–01:00; `0189`).
 * A day with no row is a day it does not open — `src/lib/store-hours.ts` in the app reads it
 * exactly that way, so "closed on Monday" is expressed by there being no
 * Monday, not by a row saying `00:00`–`00:00`.
 *
 * ## Hours belong to a place, not to a brand
 *
 * They moved with `0101`. A chain whose Hamra branch shuts at ten and whose
 * airport branch never does cannot say so with one timetable, and every shop
 * that is not a chain is a shop with one branch — so this reads the same for
 * both. `store_hours` still exists and still holds a copy until step three
 * drops it; nothing here reads it.
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

export async function fetchBranchHours(branchId: string): Promise<DayHours[]> {
  const { data, error } = await getClient()
    .from("branch_hours")
    .select("day_of_week, opens_at, closes_at")
    .eq("branch_id", branchId)
    .order("day_of_week", { ascending: true })
    .order("opens_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    dayOfWeek: row.day_of_week as number,
    opensAt: (row.opens_at as string).slice(0, 5),
    closesAt: (row.closes_at as string).slice(0, 5),
  }));
}

/**
/**
 * A new shop's week, written to the branch it was created with.
 *
 * The shop form asks for hours before the shop exists, and hours belong to a
 * branch — `0121`'s trigger (or `ensureFirstBranch`) makes that branch in the
 * create, so this finds it and writes the week there. The first live one by
 * `sort_order`: a shop seconds old has exactly one.
 */
export async function saveFirstBranchHours(
  storeId: string,
  week: DayHours[],
): Promise<void> {
  const { data, error } = await getClient()
    .from("branches")
    .select("id")
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const branchId = data?.[0]?.id as string | undefined;
  if (!branchId)
    throw new Error("The new shop has no branch to hold its hours.");

  await saveBranchHours(branchId, week);
}

/**
 * Replaces one branch's whole week.
 *
 * ## Why the whole week and not the day that changed
 *
 * The seven days are edited together on one grid with one Save, because they
 * are read together — "when is this shop open" is a question about the week.
 * Sending the whole thing also makes the write **idempotent**: the same call
 * twice leaves the same rows.
 *
 * ## One call, one transaction
 *
 * `api_v1_set_branch_hours` (`0189`) deletes the week and writes the new one
 * together. This used to be a delete of the closed days and an upsert of the
 * open ones on `(branch_id, day_of_week)` — which stopped being possible the
 * moment a day could hold two windows, since the day is no longer unique. And
 * delete-everything-then-insert as two requests would leave the branch with
 * *no* hours between them, which the app reads as open around the clock.
 *
 * The database refuses overlapping windows (`HOURS`); the editor checks first
 * (`overlappingDay`), so meeting that here means the check and the trigger
 * disagree, and the message says so plainly rather than being swallowed.
 */
export async function saveBranchHours(
  branchId: string,
  week: DayHours[],
): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_branch_hours", {
    p_branch_id: branchId,
    p_week: week
      .filter((day) => day.opensAt && day.closesAt)
      .map((day) => ({
        day_of_week: day.dayOfWeek,
        opens_at: day.opensAt,
        closes_at: day.closesAt,
      })),
  });
  if (error) {
    throw new Error(
      error.message.startsWith("HOURS: opening hours overlap")
        ? t("hours.overlapSaved")
        : error.message,
    );
  }
}
