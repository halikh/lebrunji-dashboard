import { getClient } from "@/lib/supabase/client";
import { DEFAULT_BUSINESS_TIMEZONE, setBusinessClock } from "@/lib/time";

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
  /**
   * What each shop past the first adds to an order's delivery fee.
   *
   * Minor units of the **base currency**, like a band on the delivery ladder,
   * and converted the same way for a shop pricing in something else — it is
   * part of the delivery fee. `cart_price` reads it on every basket (0133), so
   * a change applies to the next checkout, not to orders already placed.
   */
  extraStoreFee: number;
  /**
   * The business clock's IANA zone, a row of `timezones` (0183). Every time
   * the dashboard and the app show, and every day the reports cut, is read in
   * it. `fetchAppSettings` hands it to `setBusinessClock`, so a formatter
   * called outside React reads it too.
   */
  timezone: string;
};

const COLUMNS =
  "clock_24h, orders_open_hour, orders_close_hour, notification_sound_url, extra_store_fee";

export async function fetchAppSettings(): Promise<AppSettings> {
  // With 0183's column, and without it on a database that has not had it
  // yet: every screen that shows a time reads this, so a missing column
  // must cost the zone setting and nothing else.
  let { data, error } = await getClient()
    .from("app_settings")
    .select(`${COLUMNS}, timezone`)
    .single();
  if (error && isMissingColumn(error)) {
    ({ data, error } = await getClient()
      .from("app_settings")
      .select(COLUMNS)
      .single());
  }

  if (error) throw new Error(`Could not read the settings: ${error.message}`);

  const row = data as Record<string, unknown>;
  const timezone =
    (row.timezone as string | null | undefined) ?? DEFAULT_BUSINESS_TIMEZONE;

  // Here rather than in a hook, so the zone and the trading day's start are
  // in place for every formatter the moment the row lands — including the
  // ones `dispatchMessage` calls outside React.
  setBusinessClock({ timezone, dayStartsAt: row.orders_open_hour as number });

  return {
    clock24h: row.clock_24h as boolean,
    openHour: row.orders_open_hour as number,
    closeHour: row.orders_close_hour as number,
    notificationSoundUrl: (row.notification_sound_url as string | null) ?? null,
    // `bigint` can arrive as a string over the wire; a string here would make
    // `60 !== "60"` and the field look edited the moment it loaded.
    extraStoreFee: Number(row.extra_store_fee ?? 0),
    timezone,
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
  if (patch.extraStoreFee !== undefined) {
    row.extra_store_fee = patch.extraStoreFee;
  }
  if (patch.timezone !== undefined) row.timezone = patch.timezone;

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

// ---------------------------------------------------------------------------
// The customer app: the oldest version still served, and where to update it
// ---------------------------------------------------------------------------

/**
 * The four columns migration 0178 adds.
 *
 * A customer app older than the minimum for its platform shows a blocking
 * "Update the app" screen, whose button opens the store URL. Null is "no
 * minimum" and "no link" respectively — never an empty string, which the
 * database's checks would refuse.
 */
export type CustomerAppSettings = {
  minVersionIos: string | null;
  minVersionAndroid: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
};

const CUSTOMER_APP_COLUMNS =
  "min_app_version_ios, min_app_version_android, ios_store_url, android_store_url";

/** The database's own check on both version columns (0178). */
export const APP_VERSION_PATTERN = /^[0-9]+(\.[0-9]+){0,2}$/;

/** Empty means "no minimum", so only a typed value can be wrong. */
export function isValidAppVersion(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || APP_VERSION_PATTERN.test(trimmed);
}

/** Empty means "no link"; anything else must be `https://` and have a host. */
export function isValidStoreUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (!trimmed.startsWith("https://")) return false;
  try {
    return new URL(trimmed).hostname !== "";
  } catch {
    return false;
  }
}

/**
 * Whether an error is the database saying a column is not there.
 *
 * `42703` is Postgres's `undefined_column`, which PostgREST passes through on
 * a read naming one. The message is checked as well because a proxy or an older
 * PostgREST can drop the code and keep the words.
 */
export function isMissingColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "")
  );
}

/**
 * Read separately from `fetchAppSettings`, and `null` when the columns are not
 * there yet.
 *
 * The dashboard can be deployed ahead of migration 0178. Folding these into
 * `COLUMNS` would make that read fail outright — and every screen that shows a
 * time reads it — so a missing column here hides one section instead of
 * breaking the dashboard.
 */
export async function fetchCustomerAppSettings(): Promise<CustomerAppSettings | null> {
  const { data, error } = await getClient()
    .from("app_settings")
    .select(CUSTOMER_APP_COLUMNS)
    .single();

  if (error) {
    if (isMissingColumn(error)) return null;
    throw new Error(`Could not read the settings: ${error.message}`);
  }

  const row = data as Record<string, unknown>;
  return {
    minVersionIos: (row.min_app_version_ios as string | null) ?? null,
    minVersionAndroid: (row.min_app_version_android as string | null) ?? null,
    iosStoreUrl: (row.ios_store_url as string | null) ?? null,
    androidStoreUrl: (row.android_store_url as string | null) ?? null,
  };
}

/** Saves all four together — they are one form with one Save. */
export async function updateCustomerAppSettings(
  next: CustomerAppSettings,
): Promise<void> {
  const { error } = await getClient()
    .from("app_settings")
    .update({
      min_app_version_ios: next.minVersionIos,
      min_app_version_android: next.minVersionAndroid,
      ios_store_url: next.iosStoreUrl,
      android_store_url: next.androidStoreUrl,
    })
    // The single row; see `updateAppSettings`.
    .eq("id", true);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// The zones the business can run on
// ---------------------------------------------------------------------------

/** A row of `timezones` (0183). */
export type TimezoneOption = {
  /** The IANA id: what `app_settings.timezone` stores. */
  name: string;
  /** What a person reads: "Beirut". */
  label: string;
};

/**
 * The active zones, in their order. One today, Asia/Beirut, because Lebanon
 * is the only place we deliver. Empty on a database without 0183, which hides
 * the picker rather than breaking the tab.
 */
export async function fetchTimezones(): Promise<TimezoneOption[]> {
  const { data, error } = await getClient()
    .from("timezones")
    .select("name, label")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    // PGRST205 / 42P01: the table is not there yet.
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(`Could not read the time zones: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    name: row.name as string,
    label: row.label as string,
  }));
}
