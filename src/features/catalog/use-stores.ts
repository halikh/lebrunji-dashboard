"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import type { Localized } from "@/lib/validation";
import { t } from "@/i18n/translations";

import {
  archiveStore,
  fetchStore,
  fetchStores,
  updateStore,
  type Store,
  type StorePatch,
} from "./api/stores";

export const storeKeys = {
  all: ["stores"] as const,
  list: (search: string) => ["stores", "list", search] as const,
  detail: (id: string) => ["stores", "detail", id] as const,
};

export function useStore(id: string) {
  return useQuery({
    queryKey: storeKeys.detail(id),
    queryFn: () => fetchStore(id),
  });
}

export function useStores(search: string) {
  return useQuery({
    queryKey: storeKeys.list(search),
    queryFn: () => fetchStores({ search: search || null }),
    placeholderData: (previous) => previous,
  });
}

/**
 * Edits a store, optimistically.
 *
 * Optimistic because these are toggles and inline cells — a switch that waits
 * for a round trip before moving feels broken, and the operator flips several
 * in a row. The server still decides: a refusal puts the row back and says why.
 *
 * No undo toast. Unlike advancing an order, the control *is* the undo — a
 * toggle that went the wrong way is flipped back, and a second affordance for
 * that would be noise on a screen where somebody is flipping many.
 */
export function useUpdateStore() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: StorePatch }) =>
      updateStore(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: storeKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: storeKeys.all });

      queryClient.setQueriesData<{ stores: Store[] }>(
        { queryKey: ["stores", "list"] },
        (data) =>
          data && {
            ...data,
            stores: data.stores.map((store) =>
              store.id === input.id ? { ...store, ...input.patch } : store,
            ),
          },
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      // Every list, not only the one on screen: the same store appears under a
      // search and under no search, and half a rollback is two views
      // disagreeing about the same row.
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: storeKeys.all });
    },
  });
}

/**
 * Archives a store.
 *
 * Not optimistic: a row vanishing before the server agreed, and reappearing
 * when it did not, is alarming in a way a toggle is not. It waits, then says
 * what happened.
 */
export function useArchiveStore() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      archiveStore(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: storeKeys.all });
      toast.success(
        t("catalogue.archived", { name: pickLocalized(input.name) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}
