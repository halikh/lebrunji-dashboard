"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import type { Localized } from "@/lib/validation";

import {
  archiveMenuItem,
  archiveMenuSection,
  createMenuItem,
  createMenuSection,
  fetchMenu,
  searchMenu,
  setSortOrder,
  updateMenuItem,
  updateMenuSection,
  type MenuItemDraft,
  type MenuItemPatch,
  type MenuSection,
  createMenuItems,
  createMenuSections,
  fetchArchive,
  restoreMenuItem,
  restoreMenuSection,
  type MenuSectionDraft,
  type SortUpdate,
} from "./api/menu";
import { updateItemOption, updateOptionGroup } from "./api/options";

export const menuKeys = {
  all: ["menu"] as const,
  store: (storeId: string) => ["menu", storeId] as const,
};

/**
 * Items matching a term.
 *
 * Disabled below two characters: a one-letter search matches most of a menu,
 * which is a round trip to tell somebody nothing. `SEARCH.minTerm` is the same
 * number every other search in the dashboard uses.
 *
 * `placeholderData` keeps the previous matches on screen while the next ones
 * are fetched, so typing does not blink the list empty between keystrokes.
 */
export function useMenuSearch(storeId: string, term: string) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: [...menuKeys.store(storeId), "search", trimmed],
    queryFn: () => searchMenu(storeId, trimmed),
    enabled: trimmed.length >= SEARCH.minTerm,
    placeholderData: (previous) => previous,
  });
}

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
    // The name comes off the draft that was just saved rather than out of the
    // refetched list: the toast should say what the operator typed, and it has
    // to be able to say it before the list has come back.
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.added", { name: pickLocalized(input.draft.name) }));
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

/**
 * Several items into one section, in one write.
 *
 * It says how many landed, unlike the single add, which is silent. Adding one
 * is a row appearing where the operator is already looking; adding eleven is a
 * block of text becoming a list, and the count is the confirmation that the
 * paste was read the way it was meant.
 */
export function useCreateMenuItems(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      sectionId: string;
      items: { name: Localized; price: number }[];
      sortOrder: number;
    }) =>
      createMenuItems(storeId, input.sectionId, input.items, input.sortOrder),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("bulk.addedItems", { count: input.items.length }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

export function useArchiveMenuItem(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      archiveMenuItem(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("menu.archived", { name: pickLocalized(input.name) }));
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
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(
        t("menu.sectionAdded", { name: pickLocalized(input.draft.title) }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/** Several sections at once. Same bargain as `useCreateMenuItems`. */
export function useCreateMenuSections(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { titles: Localized[]; sortOrder: number }) =>
      createMenuSections(storeId, input.titles, input.sortOrder),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(t("bulk.addedSections", { count: input.titles.length }));
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
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(
        t("menu.sectionRenamed", { name: pickLocalized(input.title) }),
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
    mutationFn: (input: { id: string; name: Localized }) =>
      archiveMenuSection(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
      toast.success(
        t("menu.sectionArchived", { name: pickLocalized(input.name) }),
      );
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

// ---------------------------------------------------------------------------
// The archive
// ---------------------------------------------------------------------------

/**
 * What this shop has put away.
 *
 * Keyed under the shop's menu, so every archive and every restore already
 * invalidates it — a dish archived on the menu tab appears here without the
 * mutation having to know this screen exists.
 */
export function useArchive(storeId: string) {
  return useQuery({
    queryKey: [...menuKeys.store(storeId), "archive"],
    queryFn: () => fetchArchive(storeId),
  });
}

/**
 * Bringing something back.
 *
 * One hook for all three, because they share an invalidation and a failure
 * path, and because the interesting outcome is the *refusal* — a dish whose
 * section is still archived — which has to reach the operator as a sentence
 * rather than as a button that does nothing.
 *
 * `["options"]` as well as the menu key: a withdrawn choice coming back changes
 * the Options tab, which is keyed separately.
 */
export function useRestore(storeId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settle = {
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  };

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: menuKeys.store(storeId) });
    void queryClient.invalidateQueries({ queryKey: ["options"] });
  }

  const item = useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      restoreMenuItem(input.id),
    onSuccess: (_result, input) => {
      refresh();
      toast.success(t("archive.restored", { name: pickLocalized(input.name) }));
    },
    ...settle,
  });

  const section = useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      restoreMenuSection(input.id),
    onSuccess: (_result, input) => {
      refresh();
      toast.success(
        t("archive.sectionRestored", { name: pickLocalized(input.name) }),
      );
    },
    ...settle,
  });

  const group = useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      updateOptionGroup(input.id, { isActive: true }),
    onSuccess: (_result, input) => {
      refresh();
      toast.success(t("archive.offered", { name: pickLocalized(input.name) }));
    },
    ...settle,
  });

  const option = useMutation({
    mutationFn: (input: { id: string; name: Localized }) =>
      updateItemOption(input.id, { isActive: true }),
    onSuccess: (_result, input) => {
      refresh();
      toast.success(t("archive.offered", { name: pickLocalized(input.name) }));
    },
    ...settle,
  });

  return { item, section, group, option };
}
