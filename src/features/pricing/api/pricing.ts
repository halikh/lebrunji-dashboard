import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";

/**
 * The two numbers that price every order: the delivery ladder, and the rate.
 *
 * They sit together because they are the same job — a merchant setting up, or
 * reacting to a currency that moved — and because both are read by
 * `delivery_quote` on every basket.
 */

// ---------------------------------------------------------------------------
// The delivery ladder
// ---------------------------------------------------------------------------

/**
 * One band. `upToKm` is the **primary key**, and there is no surrogate id.
 *
 * That is deliberate (0059) and it decides how this screen behaves: a band *is*
 * its ceiling, so changing the distance is not an edit — it is a different
 * band. Changing the price is an update; moving a ceiling is a delete and an
 * insert, which is what `saveLadder` does rather than pretending otherwise.
 *
 * **The largest row is also the delivery radius.** Past it a customer is out of
 * range, so deleting the top row does not merely remove a price — it shrinks
 * where the business delivers.
 */
export type Band = {
  upToKm: number;
  /** Minor units, in the base currency — the same units as an order total. */
  amount: number;
};

export async function fetchLadder(): Promise<Band[]> {
  const { data, error } = await getClient()
    .from("delivery_rates")
    .select("up_to_km, amount")
    .order("up_to_km", { ascending: true });

  if (error) throw new Error(`Could not read the ladder: ${error.message}`);

  return (data ?? []).map((row) => ({
    // `numeric` arrives as a string over the wire, and a string here would sort
    // "100" before "25" and compare `12.00 !== 12`.
    upToKm: Number(row.up_to_km),
    amount: Number(row.amount),
  }));
}

/**
 * Replaces the whole ladder.
 *
 * ## Why the whole thing and not the row that changed
 *
 * The bands only mean anything together: each one's price is chosen against the
 * ones either side of it, and the largest doubles as the radius. That is why
 * the screen is one table with one Save, and a save that sent only the edited
 * row would let the operator commit half of a decision they made as a whole.
 *
 * Sending everything also makes it **idempotent** — the same call twice leaves
 * the same ladder — which matters because it is more than one request and any
 * of them can be retried.
 *
 * ## Delete first, then insert
 *
 * `up_to_km` is the key, so a ceiling that moved is a different row. Removing
 * the bands that are gone before writing the ones that stay is the only order
 * that cannot collide with itself: the reverse would insert a ceiling that the
 * delete was about to remove.
 *
 * Not atomic — PostgREST has no transaction, and a `security definer` function
 * taking arbitrary rows is a wider hole than this fixes. A half-applied ladder
 * is a wrong price rather than a broken one, the caller refetches on success
 * *and* failure so the screen shows whatever landed, and running it again fixes
 * it. `delivery_quote` reads the ladder live, so nothing is cached anywhere to
 * go stale behind it.
 */
export async function saveLadder(bands: Band[]): Promise<void> {
  const client = getClient();
  const keep = bands.map((band) => band.upToKm);

  const { data: existing, error: readError } = await client
    .from("delivery_rates")
    .select("up_to_km");
  if (readError) throw new Error(readError.message);

  const gone = (existing ?? [])
    .map((row) => Number(row.up_to_km))
    .filter((km) => !keep.includes(km));

  if (gone.length > 0) {
    const { error } = await client
      .from("delivery_rates")
      .delete()
      .in("up_to_km", gone);
    if (error) throw new Error(friendly(error.message));
  }

  const { error } = await client.from("delivery_rates").upsert(
    bands.map((band) => ({ up_to_km: band.upToKm, amount: band.amount })),
    { onConflict: "up_to_km" },
  );
  if (error) throw new Error(friendly(error.message));
}

// ---------------------------------------------------------------------------
// The rate
// ---------------------------------------------------------------------------

export type CurrencyRate = {
  code: string;
  symbol: string;
  rate: number;
  /** When somebody last set it. A rate with no date is a rumour. */
  rateUpdatedAt: string;
  isBase: boolean;
};

/**
 * Every currency and its rate.
 *
 * `rate` is how many of this currency one unit of the base buys — so the base
 * currency's own rate is 1, and it is the one row on this screen that must
 * never be edited: changing it would rescale every price in the app at once
 * while looking like a small correction.
 */
export async function fetchRates(): Promise<CurrencyRate[]> {
  const { data, error } = await getClient()
    .from("currencies")
    .select("code, symbol, rate, rate_updated_at, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the rates: ${error.message}`);

  return (data ?? []).map((row) => ({
    code: row.code as string,
    symbol: row.symbol as string,
    rate: Number(row.rate),
    rateUpdatedAt: row.rate_updated_at as string,
    // The base currency quotes itself at 1, by definition.
    isBase: Number(row.rate) === 1,
  }));
}

/**
 * Sets one currency's rate.
 *
 * Through `api_v1_set_currency_rate` rather than an update, and migration 0064
 * gives the reason: an `update` policy on `currencies` would also expose
 * `symbol`, `decimal_digits`, `is_active` and the `code` other tables point at.
 * The function writes `rate` and `rate_updated_at`, and nothing else can be
 * reached through it.
 */
export async function setRate(code: string, rate: number): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_currency_rate", {
    p_code: code,
    p_rate: rate,
  });

  if (error) throw new Error(friendly(error.message));
}

function friendly(message: string): string {
  if (message.includes("up_to_km") && message.includes("check")) {
    return t("pricing.bandDistancePositive");
  }
  if (message.includes("amount") && message.includes("check")) {
    return t("pricing.bandAmountNegative");
  }
  if (message.includes("greater than zero")) return t("pricing.ratePositive");
  return message;
}
