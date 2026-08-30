"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  archiveBanner,
  createBanner,
  fetchBanners,
  setBannerOrder,
  updateBanner,
  type Banner,
  type BannerDraft,
  type BannerPatch,
} from "./api/promotions";

export const bannerKeys = { all: ["banners"] as const };

export function useBanners() {
  return useQuery({ queryKey: bannerKeys.all, queryFn: fetchBanners });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: BannerDraft; priority: number }) =>
      createBanner(input.draft, input.priority),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
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
 * Editing a banner, optimistically.
 *
 * The switch is flicked in runs down a list, and one that waits for a round
 * trip before moving reads as broken. `name` is passed only where there is a
 * confirmation to give — a switch shows its own result, so a toast repeating it
 * would be noise.
 */
export function useUpdateBanner() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: BannerPatch; name?: string }) =>
      updateBanner(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bannerKeys.all });
      const snapshot = queryClient.getQueryData<Banner[]>(bannerKeys.all);

      queryClient.setQueryData<Banner[]>(bannerKeys.all, (rows) =>
        rows?.map((row) =>
          row.id === input.id ? { ...row, ...input.patch } : row,
        ),
      );

      return { snapshot };
    },

    onSuccess: (_result, input) => {
      if (input.name) {
        toast.success(t("promotions.saved", { name: input.name }));
      }
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(bannerKeys.all, context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    },
  });
}

export function useArchiveBanner() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      archiveBanner(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
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
 */
export function useReorderBanners() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; priority: number }[];
      next: Banner[];
    }) => setBannerOrder(input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: bannerKeys.all });
      const snapshot = queryClient.getQueryData<Banner[]>(bannerKeys.all);
      queryClient.setQueryData<Banner[]>(bannerKeys.all, input.next);
      return { snapshot };
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(bannerKeys.all, context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("reorder.failed"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    },
  });
}
