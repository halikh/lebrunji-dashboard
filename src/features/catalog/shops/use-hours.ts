"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchBranchHours,
  fetchHoursForBranches,
  saveBranchHours,
  type DayHours,
} from "../api/hours";

/**
 * Opening hours, as queries.
 *
 * `["branch-hours", id]` is the key the old dashboard used, kept so anything
 * else that reads one branch's week shares the cache entry. The header's
 * many-branch read is a separate key under the same prefix, so saving one week
 * invalidates both with one call.
 */
export const hoursKeys = {
  all: ["branch-hours"] as const,
  branch: (branchId: string) => ["branch-hours", branchId] as const,
  many: (branchIds: readonly string[]) =>
    ["branch-hours", "many", [...branchIds].sort().join(",")] as const,
};

export function useBranchHours(branchId: string | null) {
  return useQuery({
    queryKey: hoursKeys.branch(branchId ?? ""),
    queryFn: () => fetchBranchHours(branchId as string),
    enabled: branchId !== null,
  });
}

/** Every listed branch's week, in one request — see `fetchHoursForBranches`. */
export function useHoursForBranches(branchIds: readonly string[]) {
  return useQuery({
    queryKey: hoursKeys.many(branchIds),
    queryFn: () => fetchHoursForBranches(branchIds),
    enabled: branchIds.length > 0,
  });
}

/**
 * Replaces one branch's week (`api_v1_set_branch_hours`, one transaction).
 *
 * Refetched on failure as well as success, so the grid shows what the
 * database holds rather than what was asked for.
 */
export function useSaveBranchHours(branchId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (week: DayHours[]) => saveBranchHours(branchId, week),
    onSuccess: () => toast.success(t("hours.saved")),
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.all }),
  });
}
