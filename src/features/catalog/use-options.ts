"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  createItemOption,
  createOptionGroup,
  fetchItemGroupIds,
  fetchOptionGroups,
  setDefaultOption,
  setItemGroup,
  updateItemOption,
  updateOptionGroup,
  type ItemOptionPatch,
  type OptionGroup,
  type OptionGroupDraft,
  type OptionGroupPatch,
} from "./api/options";

export const optionKeys = {
  store: (storeId: string) => ["options", storeId] as const,
  item: (itemId: string) => ["options", "item", itemId] as const,
};

export function useOptionGroups(storeId: string) {
  return useQuery({
    queryKey: optionKeys.store(storeId),
    queryFn: () => fetchOptionGroups(storeId),
    // Reference data for a shop: read on every item that is opened, changed
    // rarely. Refetching it per dish would be a request per click for an answer
    // that is almost always the same one.
    staleTime: 5 * 60_000,
  });
}

export function useItemGroups(itemId: string | null) {
  return useQuery({
    queryKey: optionKeys.item(itemId ?? ""),
    queryFn: () => fetchItemGroupIds(itemId as string),
    enabled: itemId !== null,
  });
}

/**
 * Attaching a group to a dish, or taking it off.
 *
 * **Optimistic**, and this is the case for it: the operator works down a list
 * of switches, and one that waits for a round trip before moving reads as
 * broken. A refusal puts it back and says why.
 *
 * The invalidation is only the item's links — not the store's groups, which
 * this cannot have changed. Invalidating both would refetch every group and its
 * options on every switch, for nothing.
 */
export function useSetItemGroup(itemId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { groupId: string; attached: boolean }) =>
      setItemGroup(itemId, input.groupId, input.attached),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: optionKeys.item(itemId) });
      const snapshot = queryClient.getQueryData<string[]>(
        optionKeys.item(itemId),
      );

      queryClient.setQueryData<string[]>(optionKeys.item(itemId), (ids) => {
        const current = ids ?? [];
        return input.attached
          ? [...new Set([...current, input.groupId])]
          : current.filter((id) => id !== input.groupId);
      });

      return { snapshot };
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(optionKeys.item(itemId), context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: optionKeys.item(itemId) });
    },
  });
}

export function useCreateOptionGroup(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: OptionGroupDraft; sortOrder: number }) =>
      createOptionGroup(input.draft, input.sortOrder),
    onSuccess: (_id, input) => {
      void queryClient.invalidateQueries({
        queryKey: optionKeys.store(storeId),
      });
      toast.success(
        t("options.groupAdded", { name: pickLocalized(input.draft.title) }),
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
 * Changing a group's rules.
 *
 * Silent on success. These are switches and small numbers on a screen that
 * shows the result immediately — a toast per flick would be a stack of
 * confirmations for something the operator can already see. Failure still
 * speaks, because that is the case they cannot see.
 */
export function useUpdateOptionGroup(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: OptionGroupPatch }) =>
      updateOptionGroup(input.id, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: optionKeys.store(storeId),
      });
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * The options inside a group — added, edited, withdrawn, made the default.
 *
 * One hook for all of them, because they share an invalidation and a failure
 * message, and four near-identical hooks is four places for those to drift.
 */
export function useItemOptions(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settle = {
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: optionKeys.store(storeId),
      });
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  };

  const add = useMutation({
    mutationFn: (input: {
      groupId: string;
      name: Localized;
      price: number;
      sortOrder: number;
    }) =>
      createItemOption(input.groupId, input.name, input.price, input.sortOrder),
    ...settle,
  });

  const edit = useMutation({
    mutationFn: (input: { id: string; patch: ItemOptionPatch }) =>
      updateItemOption(input.id, input.patch),
    ...settle,
  });

  const makeDefault = useMutation({
    mutationFn: (input: { groupId: string; optionId: string }) =>
      setDefaultOption(input.groupId, input.optionId),
    ...settle,
  });

  return { add, edit, makeDefault };
}

export type { OptionGroup };
