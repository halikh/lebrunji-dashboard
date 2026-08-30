/**
 * Money, in minor units.
 *
 * Every amount in this schema is a `bigint` of minor units — piastres, not
 * pounds. Never a float, never a decimal. The whole point is that arithmetic on
 * money is integer arithmetic; a number that has been through a float has
 * already lost the property that makes it safe to add up.
 *
 * ## What this is not, yet
 *
 * The app's `src/lib/money.ts` formats from the **`currencies` row** — its
 * symbol, its `symbol_position`, its `decimal_digits`, its separators — because
 * those are merchant-configurable and a customer should see the shop's own
 * conventions.
 *
 * This uses `Intl` and the ISO currency code instead, which gets the digit count
 * and grouping right without a database read. That is a deliberate stand-in
 * while nothing in the dashboard reads `currencies`: the queue would otherwise
 * have to fetch the table to draw a number beside an order.
 *
 * Phase 5 builds the rate screen and reads `currencies` properly. **That is
 * when this should be replaced with the app's formatter**, so the two agree by
 * construction rather than by coincidence — and until then a merchant who has
 * configured an unusual symbol will see the ISO one here and theirs in the app.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currencyCode: string): Intl.NumberFormat {
  const cached = formatters.get(currencyCode);
  if (cached) return cached;

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    });
  } catch {
    // An unknown or malformed code. Grouping still beats a bare integer, and
    // the code is appended so the number is never ambiguous.
    formatter = new Intl.NumberFormat("en");
  }

  formatters.set(currencyCode, formatter);
  return formatter;
}

/** How many minor units make one major unit, per ISO. LBP has none. */
function minorUnitsPerMajor(currencyCode: string): number {
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits;
    return 10 ** (digits ?? 2);
  } catch {
    return 100;
  }
}

export function formatMoney(minorUnits: number, currencyCode: string): string {
  const major = minorUnits / minorUnitsPerMajor(currencyCode);
  const formatter = formatterFor(currencyCode);

  // `format` is exact here despite the division: the result is displayed, never
  // added to anything. Arithmetic stays in minor units, upstream of this.
  const text = formatter.format(major);
  return formatter.resolvedOptions().style === "currency"
    ? text
    : `${text} ${currencyCode}`;
}

/**
 * A compact form for stat tiles — `184.2M`, `865k`.
 *
 * Only for figures being compared at a glance. An amount somebody might act on
 * — an order total, a price being edited — always shows in full: rounding a
 * number that a person is about to say out loud to a customer is not a saving.
 */
export function formatMoneyCompact(
  minorUnits: number,
  currencyCode: string,
): string {
  const major = minorUnits / minorUnitsPerMajor(currencyCode);
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(major);
  return `${compact} ${currencyCode}`;
}
