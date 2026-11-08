"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { setItemPrice } from "./api/branch-menu";
import { setItemStorePrice } from "./api/earnings";
import {
  archiveBundle,
  createBundle,
  fetchBundles,
  liveBundlesWith,
  setBundleActive,
  setBundleOrder,
  updateBundle,
  type Bundle,
  type BundleDraft,
} from "./api/bundles";
import { artworkKeys } from "./use-artworks";

export const bundleKeys = {
  all: ["bundles"] as const,
  list: (search: string, storeId = "") =>
    ["bundles", "list", search, storeId] as const,
  branchPrices: (id: string) => ["bundles", "branch-prices", id] as const,
  /** Each branch's own price from the shop for it, on markup (`0262`). */
  branchStorePrices: (id: string) =>
    ["bundles", "branch-store-prices", id] as const,
};

export function useBundles(search = "", storeId = "") {
  const term = search.trim();
  return useQuery({
    queryKey: bundleKeys.list(term, storeId),
    queryFn: () => fetchBundles(term, storeId || undefined),
    placeholderData: (previous) => previous,
  });
}

/**
 * The switched-on bundles a dish is in, by name — what hiding or archiving it
 * would take out of the app with it. The shop's bundle list, shared by every
 * row of its menu through the query cache.
 */
export function useLiveBundlesWith(storeId: string, dishId: string): string[] {
  const bundles = useBundles("", storeId);
  return liveBundlesWith(bundles.data ?? [], dishId);
}

/**
 * What each branch charges, written after the bundle itself. Only the
 * branches whose figure changed: `null` deletes the row, so the branch follows
 * the bundle's own price again (see `setItemPrice`).
 */
type BranchPriceChanges = Record<string, number | null>;

/** Each branch's price from the shop that moved; null removes the branch's row. */
async function writeBranchStorePrices(
  id: string,
  changes: BranchPriceChanges | undefined,
) {
  for (const [branchId, storePrice] of Object.entries(changes ?? {})) {
    await setItemStorePrice(id, branchId, storePrice);
  }
}

async function writeBranchPrices(id: string, changes: BranchPriceChanges) {
  for (const [branchId, price] of Object.entries(changes)) {
    await setItemPrice(branchId, id, price);
  }
}

export function useCreateBundle() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: async (input: {
      draft: BundleDraft;
      sortOrder: number;
      branchPrices: BranchPriceChanges;
      /** The shop's store price for it, on markup (`0262`); absent: none. */
      storePrice?: number | null;
      /** Markup branches' own prices from the shop that moved. */
      branchStorePrices?: BranchPriceChanges;
    }) => {
      const id = await createBundle(input.draft, input.sortOrder);
      await writeBranchPrices(id, input.branchPrices);
      if (input.storePrice != null) {
        await setItemStorePrice(id, null, input.storePrice);
      }
      await writeBranchStorePrices(id, input.branchStorePrices);
      return id;
    },
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["store-prices"] });
      void queryClient.invalidateQueries({ queryKey: ["options"] });
      toast.success(
        t("bundles.added", { name: pickLocalized(input.draft.name) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

export function useUpdateBundle() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      draft: BundleDraft;
      branchPrices: BranchPriceChanges;
      /** Null removes it; absent leaves it alone. */
      storePrice?: number | null;
      /** Markup branches' own prices from the shop that moved. */
      branchStorePrices?: BranchPriceChanges;
    }) => {
      await updateBundle(input.id, input.draft);
      await writeBranchPrices(input.id, input.branchPrices);
      if (input.storePrice !== undefined) {
        await setItemStorePrice(input.id, null, input.storePrice);
      }
      await writeBranchStorePrices(input.id, input.branchStorePrices);
    },
    onSuccess: (_result, input) => {
      toast.success(
        t("bundles.saved", { name: pickLocalized(input.draft.name) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["options"] });
      void queryClient.invalidateQueries({ queryKey: ["store-prices"] });
    },
  });
}

/** The row's switch — optimistic, as a promotion's is. */
export function useToggleBundle() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      setBundleActive(input.id, input.isActive),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bundleKeys.all });
      const snapshot = queryClient.getQueriesData<Bundle[]>({
        queryKey: bundleKeys.all,
      });
      queryClient.setQueriesData<Bundle[]>(
        { queryKey: bundleKeys.all },
        (rows) =>
          Array.isArray(rows)
            ? rows.map((row) =>
                row.id === input.id
                  ? { ...row, isActive: input.isActive }
                  : row,
              )
            : rows,
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      for (const [key, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, rows);
      }
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
    },
  });
}

export function useArchiveBundle() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      archiveBundle(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
      // Its pictures come down with it in the app.
      void queryClient.invalidateQueries({ queryKey: artworkKeys.all });
      toast.success(t("bundles.archived", { name: input.name }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

export function useReorderBundles() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; sortOrder: number }[];
      next: Bundle[];
      /** The list being dragged — every shop's, or one shop's tab. */
      storeId?: string;
    }) => setBundleOrder(input.updates),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bundleKeys.all });
      const snapshot = queryClient.getQueriesData<Bundle[]>({
        queryKey: bundleKeys.all,
      });
      queryClient.setQueryData<Bundle[]>(
        bundleKeys.list("", input.storeId ?? ""),
        input.next,
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      for (const [key, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, rows);
      }
      toast.danger(
        error instanceof Error ? error.message : t("reorder.failed"),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
    },
  });
}
