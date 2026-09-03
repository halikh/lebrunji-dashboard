"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchCatalogueArchive,
  restoreCategory,
  restorePromotion,
  restoreStore,
  restoreTag,
} from "./api/archive";

export const catalogueArchiveKey = ["catalogue", "archive"] as const;

/** What the catalogue has put away. */
export function useCatalogueArchive() {
  return useQuery({
    queryKey: catalogueArchiveKey,
    queryFn: fetchCatalogueArchive,
  });
}

/**
 * Bringing a shop, a category, a tag or a promotion back.
 *
 * One hook for all four, because they share an invalidation and a failure path
 * — and because the interesting outcome is the *refusal*, a shop whose category
 * is still archived, which has to reach the operator as a sentence rather than
 * as a button that appears to do nothing.
 *
 * The invalidation is deliberately broad. A restored shop belongs on the shops
 * list, a category on the categories list *and* in the shop form's picker, a
 * tag in the vocabulary every menu item editor reads. Naming each of those here
 * would be a list to keep in step with five other files; the queries are cheap
 * and the alternative is a stale picker nobody notices for a week.
 */
export function useCatalogueRestore() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: catalogueArchiveKey });
    for (const key of ["stores", "categories", "tags", "promotions", "menu"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const settle = {
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  };

  function restorer(action: (id: string) => Promise<void>) {
    return {
      mutationFn: (input: { id: string; name: string }) => action(input.id),
      onSuccess: (_result: void, input: { id: string; name: string }) => {
        refresh();
        toast.success(t("archive.broughtBack", { name: input.name }));
      },
      ...settle,
    };
  }

  return {
    store: useMutation(restorer(restoreStore)),
    category: useMutation(restorer(restoreCategory)),
    tag: useMutation(restorer(restoreTag)),
    promotion: useMutation(restorer(restorePromotion)),
  };
}
