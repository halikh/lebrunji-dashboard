"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchShopEarnings,
  fetchShopStorePrices,
  saveStoreEarnings,
  type StoreEarnings,
} from "./api/earnings";

/**
 * Commission, markup and store prices — `0262`. See `api/earnings.ts`.
 */
export const earningsKeys = {
  all: ["store-earnings"] as const,
  shop: (storeId: string) => ["store-earnings", storeId] as const,
  prices: (storeId: string) => ["store-prices", storeId] as const,
};

export function useShopEarnings(storeId: string | null) {
  return useQuery({
    queryKey: earningsKeys.shop(storeId ?? ""),
    queryFn: () => fetchShopEarnings(storeId as string),
    enabled: Boolean(storeId),
  });
}

export function useShopStorePrices(storeId: string | null, enabled = true) {
  return useQuery({
    queryKey: earningsKeys.prices(storeId ?? ""),
    queryFn: () => fetchShopStorePrices(storeId as string),
    enabled: Boolean(storeId) && enabled,
  });
}

/**
 * The shop's row or one branch's.
 *
 * `quiet` when another write in the same Save has already said so, the way
 * `useUpdateBranch` takes it — one Save, one notice.
 */
export function useSaveStoreEarnings(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      branchId: string | null;
      earnings: StoreEarnings;
      quiet?: boolean;
    }) => saveStoreEarnings(storeId, input.branchId, input.earnings),
    onSuccess: (_result, input) => {
      if (!input.quiet) toast.success(t("earnings.saved"));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: earningsKeys.shop(storeId) }),
  });
}
