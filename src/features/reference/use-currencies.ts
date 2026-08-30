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

  /** The other active currency, for showing a second figure beside the first. */
  const secondaryCode = useCallback(
    (primary: string): string | null =>
      rows?.find((c) => c.code !== primary)?.code ?? null,
    [rows],
  );

  return { format, convertTo, secondaryCode, currencies: rows };
}
