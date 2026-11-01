"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { setItemPrice } from "./api/branch-menu";
import {
  archiveBundle,
  createBundle,
  fetchBundles,
  setBundleActive,
  setBundleOrder,
  updateBundle,
  type Bundle,
  type BundleDraft,
} from "./api/bundles";
import { artworkKeys } from "./use-artworks";

export const bundleKeys = {
  all: ["bundles"] as const,
  list: (search: string) => ["bundles", "list", search] as const,
  branchPrices: (id: string) => ["bundles", "branch-prices", id] as const,
};

export function useBundles(search = "") {
  const term = search.trim();
  return useQuery({
    queryKey: bundleKeys.list(term),
    queryFn: () => fetchBundles(term),
    placeholderData: (previous) => previous,
  });
}

/**
 * What each branch charges, written after the bundle itself. Only the
 * branches whose figure changed: `null` deletes the row, so the branch follows
 * the bundle's own price again (see `setItemPrice`).
 */
type BranchPriceChanges = Record<string, number | null>;

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
    }) => {
      const id = await createBundle(input.draft, input.sortOrder);
      await writeBranchPrices(id, input.branchPrices);
      return id;
    },
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
      toast.success(t("bundles.added", { name: pickLocalized(input.draft.name) }));
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
    }) => {
      await updateBundle(input.id, input.draft);
      await writeBranchPrices(input.id, input.branchPrices);
    },
    onSuccess: (_result, input) => {
      toast.success(t("bundles.saved", { name: pickLocalized(input.draft.name) }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
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
      queryClient.setQueriesData<Bundle[]>({ queryKey: bundleKeys.all }, (rows) =>
        Array.isArray(rows)
          ? rows.map((row) =>
              row.id === input.id ? { ...row, isActive: input.isActive } : row,
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
    mutationFn: (input: { id: string; name: string }) => archiveBundle(input.id),
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
    }) => setBundleOrder(input.updates),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bundleKeys.all });
      const snapshot = queryClient.getQueriesData<Bundle[]>({
        queryKey: bundleKeys.all,
      });
      queryClient.setQueriesData<Bundle[]>(
        { queryKey: bundleKeys.list("") },
        input.next,
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      for (const [key, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, rows);
      }
      toast.danger(error instanceof Error ? error.message : t("reorder.failed"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
    },
  });
}
