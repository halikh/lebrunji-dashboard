"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  archivePromotion,
  createPromotion,
  fetchPromotions,
  setPromotionOrder,
  updatePromotion,
  type Promotion,
  type PromotionDraft,
  type PromotionPatch,
} from "./api/promotions";

export const promotionKeys = {
  all: ["promotions"] as const,
  list: (search: string) => ["promotions", "list", search] as const,
};

export function usePromotions(search = "") {
  const term = search.trim();

  return useQuery({
    queryKey: promotionKeys.list(term),
    queryFn: () => fetchPromotions(term),
    // The rows already on screen stay while the next ones are fetched, so
    // typing does not blink the list empty between keystrokes.
    placeholderData: (previous) => previous,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: PromotionDraft; priority: number }) =>
      createPromotion(input.draft, input.priority),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success(t("promotions.added", { name: input.draft.name }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * Editing a promotion, optimistically.
 *
 * The switch is flicked in runs down a list, and one that waits for a round
 * trip before moving reads as broken. `name` is passed only where there is a
 * confirmation to give — a switch shows its own result, so a toast repeating it
 * would be noise.
 *
 * The optimistic patch deliberately does **not** merge `scopes`: a patch
 * carrying `null` there means "leave them alone", and spreading that over the
 * cached row would draw a promotion with no scopes — which is the one value
 * that reads as *applies to everything*. The refetch settles it either way.
 */
export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: PromotionPatch; name?: string }) =>
      updatePromotion(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: promotionKeys.all });
      const snapshot = queryClient.getQueriesData<Promotion[]>({
        queryKey: promotionKeys.all,
      });

      const { scopes, ...safe } = input.patch;
      void scopes;

      // Every cached search, not just the visible one: the same promotion is in
      // the unfiltered list and in whatever term matches it, and half a
      // rollback is two views disagreeing about one row.
      queryClient.setQueriesData<Promotion[]>(
        { queryKey: promotionKeys.all },
        (rows) =>
          rows?.map((row) => (row.id === input.id ? { ...row, ...safe } : row)),
      );

      return { snapshot };
    },

    onSuccess: (_result, input) => {
      if (input.name) {
        toast.success(t("promotions.saved", { name: input.name }));
      }
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
      void queryClient.invalidateQueries({ queryKey: promotionKeys.all });
    },
  });
}

export function useArchivePromotion() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      archivePromotion(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success(t("promotions.archived", { name: input.name }));
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
 * Optimistic, because the operator has just dragged a card into place and let
 * go. `onSettled` refetches on success *and* failure, which is what makes the
 * several non-atomic writes behind it honest.
 *
 * It matters more here than on any other list in the dashboard: `priority` is
 * not only the order the cards appear in, it is **which promotion wins** when
 * two apply to one basket. `discount_for_order` takes the lowest, so dragging a
 * row changes what customers are charged.
 */
export function useReorderPromotions() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; priority: number }[];
      next: Promotion[];
    }) => setPromotionOrder(input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: promotionKeys.all });
      const snapshot = queryClient.getQueriesData<Promotion[]>({
        queryKey: promotionKeys.all,
      });
      queryClient.setQueriesData<Promotion[]>(
        { queryKey: promotionKeys.list("") },
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
      void queryClient.invalidateQueries({ queryKey: promotionKeys.all });
    },
  });
}
