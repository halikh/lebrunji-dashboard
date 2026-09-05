"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import type { Localized } from "@/lib/validation";
import { t } from "@/i18n/translations";

import {
  archiveStore,
  fetchStore,
  createStore,
  fetchStores,
  setStoreCurrency,
  updateStore,
  type CurrencyChangeMode,
  type Store,
  type StorePatch,
  type StoreDraft,
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
 * Adds a shop.
 *
 * **Not optimistic**, unlike the edits below. There is no row to move: an
 * optimistic insert would put a shop on the list that has no id yet, and the
 * wizard navigates straight to its menu on success — which needs the real one.
 *
 * The whole store list is invalidated rather than patched, because the insert
 * also assigns a slug (in the trigger) and a sort order this client only
 * proposed; refetching is how the screen learns what was actually written.
 */
export function useCreateStore() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      draft: StoreDraft;
      countryId: string;
      sortOrder: number;
      name: Localized;
    }) => createStore(input.draft, input.countryId, input.sortOrder),

    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({ queryKey: storeKeys.all });
      toast.success(t("store.created", { name: pickLocalized(input.name) }));
    },

    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
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
    mutationFn: (input: {
      id: string;
      patch: StorePatch;
      /**
       * Named in the confirmation, when there is one to give.
       *
       * Absent for a switch in a row: that already asked before it acted and
       * the row itself moved, so a toast repeating what is now on screen is
       * noise. Present for the settings form, where the save is a submission
       * with no other visible result.
       */
      name?: Localized;
    }) => updateStore(input.id, input.patch),

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

    onSuccess: (_result, input) => {
      if (input.name) {
        toast.success(t("store.saved", { name: pickLocalized(input.name) }));
      }
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
 * Moves a shop to another currency, restating its prices.
 *
 * ## No optimistic update, unlike every other store write
 *
 * The others change one field and the row on screen is the whole result. This
 * one rewrites every price in the shop, and the dashboard holds those prices in
 * a different cache — the menu, the questions, the option counts. Guessing the
 * new numbers here would mean reimplementing the database's arithmetic in an
 * `onMutate`, and being wrong there would show the operator a menu that has not
 * happened.
 *
 * So it waits, then invalidates broadly: the shop itself, and the catalogue
 * whose figures have just moved under it.
 */
export function useSetStoreCurrency() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      storeId: string;
      currencyCode: string;
      mode: CurrencyChangeMode;
      /** Named in the toast — see `useUpdateStore`. */
      name: Localized;
    }) => setStoreCurrency(input.storeId, input.currencyCode, input.mode),

    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: storeKeys.all });
      // Every price the operator can see. `menu` carries the dish prices and
      // `options` the choice prices; both have just been rewritten by the
      // database, and a stale one would show the old scale beside the new
      // currency — which is the exact confusion this feature exists to end.
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
      void queryClient.invalidateQueries({ queryKey: ["options"] });
      toast.success(
        t("store.currencyChanged", {
          name: pickLocalized(input.name),
          code: input.currencyCode,
        }),
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
