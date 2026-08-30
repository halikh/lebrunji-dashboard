"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  archiveCategory,
  createCategory,
  fetchCategories,
  fetchCategoryKinds,
  setCategoryOrder,
  updateCategory,
  type Category,
  type CategoryDraft,
  type CategoryPatch,
} from "./api/categories";

export const categoryKeys = {
  all: ["categories"] as const,
  kinds: ["categories", "kinds"] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: fetchCategories,
  });
}

export function useCategoryKinds() {
  return useQuery({
    queryKey: categoryKeys.kinds,
    queryFn: fetchCategoryKinds,
    // Reference data changed by migration, not by anybody using this screen.
    staleTime: 30 * 60_000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: CategoryDraft; sortOrder: number }) =>
      createCategory(input.draft, input.sortOrder),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(
        t("categories.added", { name: pickLocalized(input.draft.name) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * Editing a category, optimistically.
 *
 * The switches here — live, featured, menu tabs — are flicked in runs, and one
 * that waits for a round trip before moving reads as broken. A refusal puts the
 * row back and says why.
 *
 * `name` is passed only for the confirmation, and only where there is a
 * confirmation to give: a switch already shows its own result, so a toast
 * repeating it would be noise.
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: CategoryPatch;
      name?: Localized;
    }) => updateCategory(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const snapshot = queryClient.getQueryData<Category[]>(categoryKeys.all);

      queryClient.setQueryData<Category[]>(categoryKeys.all, (rows) =>
        rows?.map((row) =>
          row.id === input.id ? { ...row, ...input.patch } : row,
        ),
      );

      return { snapshot };
    },

    onSuccess: (_result, input) => {
      if (input.name) {
        toast.success(
          t("categories.saved", { name: pickLocalized(input.name) }),
        );
      }
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(categoryKeys.all, context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      archiveCategory(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(
        t("categories.archived", { name: pickLocalized(input.name) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * Committing a new order.
 *
 * Optimistic, and it has to be: the operator has just dragged a tile into place
 * and let go, and a list that jumped back for the length of a round trip would
 * read as the drag having failed. `onSettled` refetches on success *and* on
 * failure, which is what makes the several non-atomic writes behind it honest.
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; sortOrder: number }[];
      next: Category[];
    }) => setCategoryOrder(input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const snapshot = queryClient.getQueryData<Category[]>(categoryKeys.all);
      queryClient.setQueryData<Category[]>(categoryKeys.all, input.next);
      return { snapshot };
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(categoryKeys.all, context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("reorder.failed"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}
