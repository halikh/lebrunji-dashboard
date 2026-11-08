"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchEarnings } from "./api";

export const earningsReportKeys = {
  all: ["earnings-report"] as const,
  range: (from: string, to: string) => ["earnings-report", from, to] as const,
};

/**
 * The period's earnings; the last period's stay on screen while it loads.
 * `enabled` off for a comparison nobody asked for (the Reports page).
 */
export function useEarningsReport(from: Date, to: Date, enabled = true) {
  return useQuery({
    queryKey: earningsReportKeys.range(from.toISOString(), to.toISOString()),
    queryFn: () => fetchEarnings(from, to),
    placeholderData: keepPreviousData,
    enabled,
  });
}
