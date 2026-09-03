"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  createItemOption,
  createItemOptions,
  createOptionGroup,
  fetchItemOptionGroups,
  fetchOptionCounts,
  fetchStoreQuestions,
  setQuestionItems,
  setDefaultOption,
  updateItemOption,
  updateOptionGroup,
  type ItemOptionPatch,
  type OptionGroup,
  type OptionGroupDraft,
  type OptionGroupPatch,
} from "./api/options";

export const optionKeys = {
  /** One dish's questions. */
  item: (itemId: string) => ["options", "item", itemId] as const,
  /** How many questions each dish in a shop has. */
  counts: (storeId: string) => ["options", "counts", storeId] as const,
};

export function useItemOptionGroups(itemId: string | null) {
  return useQuery({
    queryKey: optionKeys.item(itemId ?? ""),
    queryFn: () => fetchItemOptionGroups(itemId as string),
    enabled: itemId !== null,
  });
}

/**
 * How many questions each dish has.
 *
 * Read for a whole shop rather than per dish, so the item picker can mark the
 * ones with nothing set up without a request per row.
 */
export function useOptionCounts(storeId: string) {
  return useQuery({
    queryKey: optionKeys.counts(storeId),
    queryFn: () => fetchOptionCounts(storeId),
    staleTime: 60_000,
  });
}

/**
 * These three take no `storeId`, deliberately.
 *
 * Everything they touch is invalidated by the `["options"]` prefix — a dish's
 * questions, and the shop's counts that mark dishes with none. Threading a shop
 * id through them would be a parameter that exists only to be ignored, and the
 * first reader to notice would wire it into a narrower invalidation and leave
 * the counts stale.
 */
export function useCreateOptionGroup() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: OptionGroupDraft; sortOrder: number }) =>
      createOptionGroup(input.draft, input.sortOrder),
    onSuccess: (_id, input) => {
      // The prefix: the dish's own list, and the shop's counts, which have
      // just changed for the picker that marks dishes with nothing set up.
      void queryClient.invalidateQueries({ queryKey: ["options"] });
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
export function useUpdateOptionGroup() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: OptionGroupPatch }) =>
      updateOptionGroup(input.id, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["options"] });
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
export function useItemOptions() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settle = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["options"] });
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

  /**
   * Several choices in one go — see `createItemOptions`.
   *
   * It says how many landed, unlike `add`, which is silent: adding one is a row
   * appearing where the operator is looking, while adding nine is a block of
   * text becoming a list, and the count is the confirmation that the paste was
   * read the way it was meant.
   */
  const addMany = useMutation({
    mutationFn: (input: {
      groupId: string;
      choices: { name: Localized; price: number }[];
      sortOrder: number;
    }) => createItemOptions(input.groupId, input.choices, input.sortOrder),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: ["options"] });
      toast.success(t("bulk.addedChoices", { count: input.choices.length }));
    },
    onError: settle.onError,
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

  return { add, addMany, edit, makeDefault };
}

export type { OptionGroup };

/** Every question in a shop, with the items each is asked on. */
export function useStoreQuestions(storeId: string) {
  return useQuery({
    queryKey: [...optionKeys.counts(storeId), "questions"],
    queryFn: () => fetchStoreQuestions(storeId),
  });
}

/**
 * Changing which items ask a question.
 *
 * Says how many items it ended up on, rather than how many were added or
 * removed. That is the fact the operator was deciding — "Choose a size is on 14
 * items" is checkable against the picker they just closed, while "3 added, 1
 * removed" is arithmetic they would have to do to know whether they got what
 * they meant.
 */
export function useSetQuestionItems(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      groupId: string;
      itemIds: string[];
      current: string[];
      sortOrder: number;
      name: Localized;
    }) =>
      setQuestionItems(
        input.groupId,
        input.itemIds,
        input.current,
        input.sortOrder,
      ),
    onSuccess: (_result, input) => {
      // The prefix: this shop's questions, every dish's own list, and the
      // counts that mark items with nothing set up.
      void queryClient.invalidateQueries({ queryKey: ["options"] });
      toast.success(
        input.itemIds.length === 0
          ? t("commonOptions.onNoItems", { name: pickLocalized(input.name) })
          : t("commonOptions.onItems", {
              name: pickLocalized(input.name),
              count: input.itemIds.length,
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
