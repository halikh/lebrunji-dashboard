"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  convertMoney,
  formatMoney,
  type ConvertibleCurrency,
} from "@/lib/money";

import { fetchCurrencies } from "./api/currencies";

export const currencyKeys = { all: ["currencies"] as const };

/**
 * Formatting that knows what the merchant configured.
 *
 * Returns `format` and `convertTo` bound to the loaded rows, so no screen has to
 * find a currency by code or remember which way a rate points.
 *
 * Before the rows arrive `format` renders the bare number with its code — never
 * a guessed symbol. A price shown briefly in the wrong currency's clothes is
 * worse than one that is plainly unformatted for a moment.
 */
export function useMoney() {
  const currencies = useQuery({
    queryKey: currencyKeys.all,
    queryFn: fetchCurrencies,
    // Reference data. The rate changes when a person decides it does, and the
    // rate screen invalidates this when they do.
    staleTime: 10 * 60_000,
  });

  const rows = currencies.data;

  const find = useCallback(
    (code: string): ConvertibleCurrency | undefined =>
      rows?.find((c) => c.code === code),
    [rows],
  );

  const format = useCallback(
    (minorUnits: number, code: string): string => {
      const currency = find(code);
      return currency
        ? formatMoney(minorUnits, currency)
        : `${minorUnits} ${code}`;
    },
    [find],
  );

  /**
   * The same amount said in another currency, or `null` when it cannot be.
   *
   * `null` rather than a fallback: a converted figure that quietly used a rate
   * of 1 would be a number somebody might read out to a customer. Absent is
   * safer than wrong.
   */
  const convertTo = useCallback(
    (minorUnits: number, fromCode: string, toCode: string): string | null => {
      const from = find(fromCode);
      const to = find(toCode);
      if (!from || !to || from.code === to.code) return null;
      if (!(from.rate > 0) || !(to.rate > 0)) return null;
      return formatMoney(convertMoney(minorUnits, from, to), to);
    },
    [find],
  );

  /**
   * How many decimal places a *named* currency has — 2 for USD, 0 for LBP.
   *
   * Every shop picks its own currency (the wizard offers all of them), so a
   * price belonging to a shop is denominated in that shop's currency and not in
   * the base one. `MoneyInput` turns what somebody types into minor units by
   * this number, and getting it from the wrong currency is a factor of a
   * hundred either way: `89000` typed into an LBP shop scaled by USD's two
   * decimals is 8,900,000 lira.
   *
   * **`null` when the answer is not known yet** — the reference query is still
   * in flight, or the code is empty because the shop it came from has not
   * loaded. Not a fallback of 2: a guessed scale is indistinguishable from a
   * real one at the moment somebody types into it, and `MoneyInput` disables
   * itself on `null` rather than converting against a guess.
   */
  const decimalsOf = useCallback(
    (code: string): number | null => find(code)?.decimalDigits ?? null,
    [find],
  );

  /** The other active currency, for showing a second figure beside the first. */
  const secondaryCode = useCallback(
    (primary: string): string | null =>
      rows?.find((c) => c.code !== primary)?.code ?? null,
    [rows],
  );

  /**
   * The currency the delivery ladder and discount amounts are written in.
   *
   * One place, reading the column the database enforces — rather than each
   * screen inferring it from `rate === 1`, which was two inferences of one
   * fact and would disagree the moment a second rate was set to 1.
   */
  const baseCode = rows?.find((one) => one.isBase)?.code ?? "";

  /**
   * How many decimal places the base currency has — 2 for USD, 0 for LBP.
   *
   * `MoneyInput` needs it to turn what somebody types into minor units.
   * Reading it here rather than per screen keeps the answer in the same place
   * as `baseCode`.
   *
   * `null` until the reference data lands, and for the reason given on
   * {@link decimalsOf}: it used to default to 2, which is USD's answer given
   * confidently on a deployment whose base is the lira — a `50000` typed into
   * the ladder in that first moment was banked as five million.
   *
   * **Only for amounts actually written in the base currency** — the delivery
   * ladder and a discount's stated amounts. A shop's own prices are in the
   * shop's currency; those want {@link decimalsOf}.
   */
  const baseDecimals = rows?.find((one) => one.isBase)?.decimalDigits ?? null;

  return {
    format,
    decimalsOf,
    convertTo,
    secondaryCode,
    baseCode,
    baseDecimals,
    currencies: rows,
  };
}
