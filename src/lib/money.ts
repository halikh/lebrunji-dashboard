/**
 * Money formatting, driven by the `currencies` row rather than by a locale.
 *
 * **Copied verbatim from `src/lib/money.ts` in the app**, and it should stay
 * that way. A dashboard that rounds or groups differently from the storefront
 * would show the operator one total and the customer another, and the two would
 * be right about different things. It replaces an `Intl`-based stand-in that
 * was close enough to look correct and wrong about any merchant-configured
 * symbol.
 *
 * Every amount in the database is an integer in the currency's **minor units** —
 * 1875 in USD is $18.75, 89000 in LBP is 89,000 ل.ل. Storing money as an integer
 * is what keeps arithmetic exact; floats lose cents, and the loss compounds
 * across an order's lines.
 *
 * How to render it comes from the row too — symbol, which side it sits on, how
 * many decimals, and the two separators — and not from `Intl`. A store in
 * Lebanon prices in USD *or* LBP and both must look right to the same customer
 * reading the same app in the same language, so the currency decides its own
 * presentation. `Intl` would tie it to the reader's locale instead, and Hermes
 * ships a cut-down `Intl` besides.
 */

export type Currency = {
  code: string;
  symbol: string;
  symbolPosition: "before" | "after";
  /** 2 for USD, 0 for LBP — a currency with no subunit shows no decimals. */
  decimalDigits: number;
  decimalSeparator: string;
  groupSeparator: string;
};

/** A currency that also knows what it is worth — see {@link convertMoney}. */
export type ConvertibleCurrency = Currency & {
  /**
   * How many units of this currency one unit of the **pricing** currency buys.
   * The pricing currency's own row is 1. Set by hand — see migration 0028.
   */
  rate: number;
  /**
   * The currency every other rate is quoted against.
   *
   * Exactly one row has it, enforced by a partial unique index (0080).
   * It is also what `delivery_rates.amount` and a discount's stated
   * amounts are denominated in.
   */
  isBase?: boolean;
  /** When the rate was last set, ISO — for showing how fresh a conversion is. */
  rateUpdatedAt?: string | null;
};

/** Thousands separators, inserted from the right. */
function group(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * An amount in minor units, as text — `1875` → `$18.75`.
 *
 * The split is integer arithmetic on purpose: dividing by 10^digits would go
 * through a float and reintroduce exactly the rounding this representation
 * exists to avoid.
 */
export function formatMoney(minorUnits: number, currency: Currency): string {
  const {
    symbol,
    symbolPosition,
    decimalDigits,
    decimalSeparator,
    groupSeparator,
  } = currency;

  const negative = minorUnits < 0;
  const absolute = Math.abs(Math.trunc(minorUnits));
  const factor = 10 ** decimalDigits;

  const whole = group(String(Math.floor(absolute / factor)), groupSeparator);
  const fraction =
    decimalDigits > 0
      ? String(absolute % factor).padStart(decimalDigits, "0")
      : "";

  const number = fraction ? `${whole}${decimalSeparator}${fraction}` : whole;
  // A space before a trailing symbol, none after a leading one: "$18.75" and
  // "89,000 ل.ل" are both what their own conventions expect.
  const withSymbol =
    symbolPosition === "before" ? `${symbol}${number}` : `${number} ${symbol}`;

  return negative ? `-${withSymbol}` : withSymbol;
}

/**
 * The same amount of money, said in another currency.
 *
 * **Display only.** Nothing converted here is ever written back: an order is
 * recorded in the currency it was priced and paid in, and a stored amount that
 * moved with the rate would be a receipt that rewrites itself. This exists so a
 * customer can *read* a dollar price in lira, which in Lebanon is the
 * difference between a number and a number you can act on.
 *
 * Both currencies quote their `rate` against the same pricing currency, so the
 * conversion is the ratio between them — no base currency has to be named, and
 * a store that prices in something else still converts correctly.
 *
 * The arithmetic goes through the minor units in one expression rather than
 * converting to major units first: `1875` cents at 89,000 is 1,668,750 lira
 * exactly, and rounding once at the end is what keeps it that way.
 */
export function convertMoney(
  minorUnits: number,
  from: ConvertibleCurrency,
  to: ConvertibleCurrency,
): number {
  if (from.code === to.code || !(from.rate > 0) || !(to.rate > 0))
    return minorUnits;

  const scale = 10 ** (to.decimalDigits - from.decimalDigits);
  return Math.round(minorUnits * (to.rate / from.rate) * scale);
}

/**
 * How a shop's stored price changes when the shop changes currency.
 *
 * Two intents, and they differ by the exchange rate — which on this catalogue
 * is a factor of ~89,700, so picking the wrong one is not a near miss.
 *
 * - **`keep`** — the digits are already the number the merchant means and only
 *   the label was wrong. `1200` (`$12.00`) becomes `12` (`ل.ل12`). This is the
 *   fix for a currency picked wrongly at creation, where the operator typed
 *   `12` meaning twelve lira.
 * - **`convert`** — the dish must go on being worth what it was worth, so the
 *   rate applies too. `1200` becomes `1076400` (`ل.ل1,076,400`).
 *
 * Neither is safe as a default for the other, which is why the caller says.
 *
 * ## It has to agree with the database, digit for digit
 *
 * `api_v1_set_store_currency` (migration 0097) is what actually rewrites the
 * rows; this exists so the screen can show the outcome *before* that happens.
 * A preview that disagreed with the write would be worse than no preview —
 * it would be a promise. The factor here is the factor there:
 * `10^(to − from)` for `keep`, times the rate ratio for `convert`, rounded
 * once at the end.
 *
 * **Lossy when the new currency has fewer decimal places**, and not
 * recoverable: `$12.34` restated into a currency with no subunit is `12`, and
 * coming back gives `$12.00`.
 */
export function restatePrice(
  minorUnits: number,
  from: ConvertibleCurrency,
  to: ConvertibleCurrency,
  mode: "keep" | "convert",
): number {
  if (from.code === to.code) return minorUnits;
  if (mode === "convert") return convertMoney(minorUnits, from, to);

  return Math.round(minorUnits * 10 ** (to.decimalDigits - from.decimalDigits));
}
