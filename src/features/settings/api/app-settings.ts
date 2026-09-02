import { getClient } from "@/lib/supabase/client";

/**
 * The settings that belong to the business rather than to a row.
 *
 * One row, one shape — see migration 0093 on why this is four typed columns
 * and not a key-value table. There is always a row: it is created by the
 * migration, so nothing here has to handle "no settings yet", which would mean
 * a second copy of every default and one of them eventually being wrong.
 *
 * ## Readable signed out, on purpose
 *
 * The customer app needs the clock format and the ordering window before there
 * is a session. Nothing here is private — it is the hours on the shop's own
 * door — and the `select` policy says so.
 */

export type AppSettings = {
  /** 22:00 rather than 10:00 PM. */
  clock24h: boolean;
  /**
   * When orders are taken, on the business clock.
   *
   * The opening hour is also where the **trading day** begins:
   * `business_day_starts_at()` reads this column (0093), so the day the reports
   * cut and the hours the shop takes orders are the same number rather than two
   * that can drift apart.
   *
   * Closing after midnight is ordinary — 08:00 to 02:00 — so `closeHour` below
   * `openHour` is not a mistake to correct.
   */
  openHour: number;
  closeHour: number;
  /** The new-order sound, or null for the built-in one. */
  notificationSoundUrl: string | null;
};

const COLUMNS =
  "clock_24h, orders_open_hour, orders_close_hour, notification_sound_url";

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await getClient()
    .from("app_settings")
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Could not read the settings: ${error.message}`);

  const row = data as Record<string, unknown>;
  return {
    clock24h: row.clock_24h as boolean,
    openHour: row.orders_open_hour as number,
    closeHour: row.orders_close_hour as number,
    notificationSoundUrl: (row.notification_sound_url as string | null) ?? null,
  };
}

/**
 * Changes one or more of them.
 *
 * A patch rather than the whole object, so the sound uploader can save a URL
 * without also writing back a clock format that somebody may be part-way
 * through changing in another tab.
 *
 * There is no insert and no delete — the row exists and there is exactly one.
 * The policies say so too (0093), so a stray call is refused by the database
 * rather than by this file remembering.
 */
export async function updateAppSettings(
  patch: Partial<AppSettings>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.clock24h !== undefined) row.clock_24h = patch.clock24h;
  if (patch.openHour !== undefined) row.orders_open_hour = patch.openHour;
  if (patch.closeHour !== undefined) row.orders_close_hour = patch.closeHour;
  if (patch.notificationSoundUrl !== undefined) {
    row.notification_sound_url = patch.notificationSoundUrl;
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await getClient()
    .from("app_settings")
    .update(row)
    // The single row. `eq("id", true)` rather than an unfiltered update,
    // because PostgREST refuses one without a filter — and because an update
    // with no `where` is a habit worth not having near a settings table.
    .eq("id", true);

  if (error) throw new Error(error.message);
}
