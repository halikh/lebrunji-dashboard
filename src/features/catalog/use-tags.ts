"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  archiveTag,
  createTag,
  fetchTags,
  setTagOrder,
  updateTag,
  type Tag,
  type TagDraft,
  type TagPatch,
} from "./api/tags";

export const tagKeys = {
  all: ["tags"] as const,
  list: (search: string) => ["tags", "list", search] as const,
};

export function useTags(search = "") {
  const term = search.trim();

  return useQuery({
    queryKey: tagKeys.list(term),
    queryFn: () => fetchTags(term),
    // The rows already on screen stay while the next ones are fetched, so
    // typing does not blink the list empty between keystrokes.
    placeholderData: (previous) => previous,
  });
}

/**
 * The vocabulary, for a picker rather than for the list.
 *
 * Only the live ones: a retired tag is not something a dish should be newly
 * given, and the app would filter it out anyway. A dish that already carries a
 * retired tag keeps it — the link survives — which the item form shows as a
 * chip it cannot re-add once removed. That asymmetry is deliberate and is what
 * "retired" means.
 *
 * Cached longer than the list, because it is read on every item form and the
 * vocabulary changes a handful of times a year.
 */
export function useTagVocabulary() {
  return useQuery({
    queryKey: tagKeys.list(""),
    queryFn: () => fetchTags(""),
    staleTime: 5 * 60_000,
    select: (rows) => rows.filter((row) => row.isActive),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: TagDraft; sortOrder: number }) =>
      createTag(input.draft, input.sortOrder),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      toast.success(t("tags.added", { name: pickLocalized(input.draft.name) }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * Editing a tag, optimistically.
 *
 * The live switch is flicked in runs down the list, and one that waits for a
 * round trip before moving reads as broken. A refusal puts the row back and
 * says why.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: TagPatch; name?: Localized }) =>
      updateTag(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.all });
      const snapshot = queryClient.getQueriesData<Tag[]>({
        queryKey: tagKeys.all,
      });

      // Every cached search, not just the visible one: the same tag is in the
      // unfiltered list and in whatever term matches it, and half a rollback is
      // two views disagreeing about one row.
      queryClient.setQueriesData<Tag[]>({ queryKey: tagKeys.all }, (rows) =>
        rows?.map((row) =>
          row.id === input.id ? { ...row, ...input.patch } : row,
        ),
      );

      return { snapshot };
    },

    onSuccess: (_result, input) => {
      if (input.name) {
        toast.success(t("tags.saved", { name: pickLocalized(input.name) }));
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
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/**
 * Retiring one.
 *
 * The menu is invalidated as well as the tag list, because a dish's chips are
 * read from the links and a retired tag has just stopped being one of them.
 * Without it the item form would keep offering a tag that no longer exists
 * until something else happened to refetch.
 */
export function useArchiveTag() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      archiveTag(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success(t("tags.archived", { name: pickLocalized(input.name) }));
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
 * Optimistic, because the operator has just dragged a row into place and let
 * go. `onSettled` refetches on success *and* failure, which is what makes the
 * several non-atomic writes behind it honest.
 *
 * The order matters more than it looks: it is the order a dish's chips appear
 * in, on every dish at once, so this is the one control that decides whether
 * "Popular" or "Spicy" is read first across the whole app.
 */
export function useReorderTags() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      updates: { id: string; sortOrder: number }[];
      next: Tag[];
    }) => setTagOrder(input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.all });
      const snapshot = queryClient.getQueriesData<Tag[]>({
        queryKey: tagKeys.all,
      });
      queryClient.setQueriesData<Tag[]>(
        { queryKey: tagKeys.list("") },
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
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}
