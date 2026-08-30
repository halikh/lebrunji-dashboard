"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  archiveMenuItem,
  archiveMenuSection,
  createMenuItem,
  createMenuSection,
  fetchMenu,
  setSortOrder,
  updateMenuItem,
  updateMenuSection,
  type MenuItemDraft,
  type MenuItemPatch,
  type MenuSection,
  type MenuSectionDraft,
  type SortUpdate,
} from "./api/menu";

export const menuKeys = {
  all: ["menu"] as const,
  store: (storeId: string) => ["menu", storeId] as const,
};

export function useMenu(storeId: string | null) {
  return useQuery({
    queryKey: menuKeys.store(storeId ?? ""),
    queryFn: () => fetchMenu(storeId as string),
    enabled: storeId !== null,
  });
}

/**
 * Adding an item.
 *
 * **Not optimistic**, unlike the toggles. An insert can be refused by a
 * constraint the form did not catch — a duplicate slug is the common one — and
 * a row that appeared, then vanished, then reappeared as an error is a worse
 * experience than one that takes a moment to arrive. The form stays open and
 * keeps what was typed.
 */
export function useCreateMenuItem(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: MenuItemDraft; sortOrder: number }) =>
      createMenuItem(input.draft, input.sortOrder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.added"));
    },
  });
}

/**
 * Editing an item, optimistically.
 *
 * These are cells and toggles — a switch that waits for a round trip before
 * moving feels broken, and the operator flips several in a row. A refusal puts
 * the row back and says why.
 */
export function useUpdateMenuItem(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; patch: MenuItemPatch }) =>
      updateMenuItem(input.id, input.patch),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: menuKeys.store(storeId) });
      const snapshot = queryClient.getQueryData(menuKeys.store(storeId));

      queryClient.setQueryData<MenuSection[]>(
        menuKeys.store(storeId),
        (sections) =>
          sections?.map((section) => ({
            ...section,
            items: section.items.map((item) =>
              item.id === input.id ? { ...item, ...input.patch } : item,
            ),
          })),
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(menuKeys.store(storeId), context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
    },
  });
}

export function useArchiveMenuItem(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (id: string) => archiveMenuItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.archived"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export function useCreateMenuSection(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { draft: MenuSectionDraft; sortOrder: number }) =>
      createMenuSection(input.draft, input.sortOrder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.sectionAdded"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

export function useUpdateMenuSection(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; title: Localized }) =>
      updateMenuSection(input.id, { title: input.title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.sectionRenamed"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * Archiving a section.
 *
 * The refusal — "it still holds four items" — is the interesting outcome here
 * rather than an edge case, so it is a toast the operator reads, not a silent
 * no-op. Migration 0072 raises the same refusal underneath.
 */
export function useArchiveMenuSection(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (id: string) => archiveMenuSection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.sectionArchived"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Committing a new order.
 *
 * **Optimistic, and it has to be.** The operator has just dragged a row into
 * place and let go; a list that jumped back to the old order for the length of
 * a round trip and then rearranged itself again would read as the drag having
 * failed. The rows stay where they were put, and a refusal moves them back and
 * says why.
 *
 * `onSettled` refetches on success *and* on failure, which is what makes the
 * several non-atomic writes behind this honest: whatever actually landed is
 * what ends up on screen.
 */
export function useReorderMenu(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      table: "menu_items" | "menu_sections";
      updates: SortUpdate[];
      /** The sections as they should now look. Applied before the write. */
      next: MenuSection[];
    }) => setSortOrder(input.table, input.updates),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: menuKeys.store(storeId) });
      const snapshot = queryClient.getQueryData(menuKeys.store(storeId));
      queryClient.setQueryData<MenuSection[]>(
        menuKeys.store(storeId),
        input.next,
      );
      return { snapshot };
    },

    onError: (error, _input, context) => {
      queryClient.setQueryData(menuKeys.store(storeId), context?.snapshot);
      toast.danger(
        error instanceof Error ? error.message : t("reorder.failed"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
    },
  });
}
