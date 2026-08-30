import { getClient } from "@/lib/supabase/client";
import type { ConvertibleCurrency } from "@/lib/money";

/**
 * The currencies, with the rate each is quoted at.
 *
 * Read from the database rather than assumed, because every part of how an
 * amount is written — the symbol, which side it sits on, how many decimals, the
 * separators — is a column a merchant sets. `Intl` would tie all of that to the
 * *reader's* locale instead, which is the wrong authority: a shop in Lebanon
 * prices in USD or LBP and both must look right to the same person.
 *
 * `rate` is how many units of this currency one unit of the pricing currency
 * buys, set by hand (migration 0028 — "there is no feed, and in this market a
 * rate is a decision"). `rate_updated_at` rides along so staleness is visible.
 */
export async function fetchCurrencies(): Promise<ConvertibleCurrency[]> {
  const { data, error } = await getClient()
    .from("currencies")
    .select(
      "code, symbol, symbol_position, decimal_digits, decimal_separator, group_separator, rate, rate_updated_at",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw new Error(`Could not read currencies: ${error.message}`);

  return (data ?? []).map((row) => ({
    code: row.code as string,
    symbol: row.symbol as string,
    symbolPosition: row.symbol_position as "before" | "after",
    decimalDigits: row.decimal_digits as number,
    decimalSeparator: row.decimal_separator as string,
    groupSeparator: row.group_separator as string,
    rate: Number(row.rate),
    rateUpdatedAt: (row.rate_updated_at as string | null) ?? null,
  }));
}
