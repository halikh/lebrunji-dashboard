"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import {
  archiveBranch,
  createBranch,
  fetchBranches,
  updateBranch,
  type Branch,
  type BranchDraft,
  type BranchPatch,
} from "./api/branches";

export const branchKeys = {
  all: ["branches"] as const,
  list: (storeId: string) => ["branches", "list", storeId] as const,
};

export function useBranches(storeId: string) {
  return useQuery({
    queryKey: branchKeys.list(storeId),
    queryFn: () => fetchBranches(storeId),
  });
}

export function useCreateBranch(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: BranchDraft; sortOrder: number }) =>
      createBranch(storeId, input.draft, input.sortOrder),
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({
        queryKey: branchKeys.list(storeId),
      });
      // The store list shows a branch count, and the app's store card reads the
      // nearest branch — both go stale the moment one is added.
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success(
        t("branches.added", { name: pickLocalized(input.draft.name) }),
      );
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });
}

export function useUpdateBranch(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: BranchPatch; name: string }) =>
      updateBranch(input.id, input.patch),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: branchKeys.list(storeId),
      });
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success(t("branches.saved", { name: input.name }));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });
}

/**
 * Closes a branch, refusing to close the last one.
 *
 * The guard is here rather than in the API function because it is a question
 * about the *list*, and the list is already in hand — asking the database again
 * would be a round trip to learn something the cache knows. The button is
 * disabled as well; this is the backstop for a stale cache, not the whole
 * defence.
 */
export function useArchiveBranch(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: async (input: { id: string; name: string; live: number }) => {
      if (input.live <= 1) throw new Error(t("branches.lastOne"));
      return archiveBranch(input.id);
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: branchKeys.list(storeId),
      });
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success(t("branches.closed", { name: input.name }));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });
}

export type { Branch, BranchDraft };
