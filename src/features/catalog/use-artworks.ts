"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  createArtwork,
  deleteArtwork,
  fetchArtworks,
  setArtworkOrder,
  updateArtwork,
  type Artwork,
  type ArtworkDraft,
  type ArtworkPatch,
} from "./api/artworks";

export const artworkKeys = {
  all: ["artworks"] as const,
  list: () => ["artworks", "list"] as const,
};

export function useArtworks() {
  return useQuery({
    queryKey: artworkKeys.list(),
    queryFn: fetchArtworks,
  });
}

function failed(toast: ReturnType<typeof useToasts>, fallback: string) {
  return (error: unknown) => {
    toast.danger(error instanceof Error ? error.message : fallback);
  };
}

export function useCreateArtwork() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: ArtworkDraft; sortOrder: number }) =>
      createArtwork(input.draft, input.sortOrder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: artworkKeys.all });
      toast.success(t("artworks.added"));
    },
    onError: failed(toast, t("common.somethingWentWrong")),
  });
}

/**
 * Editing an artwork, optimistically — the Live switch is flicked in runs down
 * a list, and one that waits for a round trip reads as broken. `confirm` is set
 * only where there is a confirmation to give: a switch shows its own result.
 *
 * `discountId` is left out of the optimistic merge, because the row carries
 * the linked promotion as `{ id, slug }` and an id alone cannot fill that in.
 * The refetch settles it.
 */
export function useUpdateArtwork() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: ArtworkPatch;
      confirm?: boolean;
    }) => updateArtwork(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: artworkKeys.all });
      const snapshot = queryClient.getQueriesData<Artwork[]>({
        queryKey: artworkKeys.all,
      });

      const { discountId, ...safe } = input.patch;
      void discountId;

      queryClient.setQueriesData<Artwork[]>(
        { queryKey: artworkKeys.all },
        (rows) =>
          rows?.map((row) => (row.id === input.id ? { ...row, ...safe } : row)),
      );

      return { snapshot };
    },

    onSuccess: (_result, input) => {
      if (input.confirm) toast.success(t("artworks.saved"));
    },

    onError: (error, _input, context) => {
      for (const [key, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, rows);
      }
      failed(toast, t("common.somethingWentWrong"))(error);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: artworkKeys.all });
    },
  });
}

export function useDeleteArtwork() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string }) => deleteArtwork(input.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: artworkKeys.all });
      toast.success(t("artworks.deleted"));
    },
    onError: failed(toast, t("common.somethingWentWrong")),
  });
}

/**
 * Committing a new order within one format.
 *
 * Optimistic, because the operator has just let go of a row. `next` is the
 * whole list with the moved format's rows renumbered, so the cache holds both
 * formats and neither blinks. `onSettled` refetches either way, which is what
 * makes the several non-atomic writes behind it honest.
 */
export function useReorderArtworks() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; sortOrder: number }[];
      next: Artwork[];
    }) => setArtworkOrder(input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: artworkKeys.all });
      const snapshot = queryClient.getQueriesData<Artwork[]>({
        queryKey: artworkKeys.all,
      });
      queryClient.setQueryData<Artwork[]>(artworkKeys.list(), input.next);
      return { snapshot };
    },

    onError: (error, _input, context) => {
      for (const [key, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, rows);
      }
      failed(toast, t("reorder.failed"))(error);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: artworkKeys.all });
    },
  });
}
