"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  archiveMenuItem,
  createMenuItem,
  fetchMenu,
  updateMenuItem,
  type MenuItemDraft,
  type MenuItemPatch,
  type MenuSection,
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
