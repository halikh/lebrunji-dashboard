"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";
import { searchTerm } from "@/lib/search";

import {
  fetchArchiveCounts,
  fetchArchivedCategories,
  fetchArchivedPromotions,
  fetchArchivedStores,
  fetchArchivedTags,
  restoreCategory,
  restorePromotion,
  restoreStore,
  restoreTag,
  type ArchiveCursor,
  type ArchiveKind,
  type ArchivePage,
  type ArchivedCategory,
  type ArchivedPromotion,
  type ArchivedStore,
  type ArchivedTag,
} from "./api/archive";

export const catalogueArchiveKey = ["catalogue", "archive"] as const;

/**
 * The archive, one list at a time.
 *
 * ## Why four hooks and not one
 *
 * It was one query returning all four lists in full. Two things were wrong with
 * that and they compound: an archive only grows — nothing in this product is
 * ever deleted — so it is the list in the catalogue most certain to outgrow a
 * screen; and opening the tab fetched four lists to draw whichever one the
 * filter was on.
 *
 * Split, each list pages on its own and each is `enabled` only while it is
 * being shown. On a specific filter that is one query; on "All", which is a
 * request for all four, it is four — and each of those is a page rather than a
 * table.
 *
 * ## The search term is part of the key
 *
 * So a search is a *different list* rather than the same one re-filtered, which
 * is what makes it a query rather than a filter over what happened to be
 * downloaded. `placeholderData` keeps the previous rows under it while the new
 * ones are in flight, because a list that blanks on every keystroke cannot be
 * typed into.
 */
function useArchivedList<Row>(
  kind: ArchiveKind,
  fetch: (options: {
    search: string | null;
    after: ArchiveCursor | null;
  }) => Promise<ArchivePage<Row>>,
  options: { search: string; enabled: boolean },
) {
  const term = searchTerm(options.search);

  return useInfiniteQuery({
    queryKey: [...catalogueArchiveKey, kind, term ?? ""],
    queryFn: ({ pageParam }) => fetch({ search: term, after: pageParam }),
    initialPageParam: null as ArchiveCursor | null,
    getNextPageParam: (last) => last.cursor,
    enabled: options.enabled,
    placeholderData: (previous) => previous,
  });
}

export function useArchivedStores(search: string, enabled: boolean) {
  return useArchivedList<ArchivedStore>("stores", fetchArchivedStores, {
    search,
    enabled,
  });
}

export function useArchivedCategories(search: string, enabled: boolean) {
  return useArchivedList<ArchivedCategory>(
    "categories",
    fetchArchivedCategories,
    { search, enabled },
  );
}

export function useArchivedTags(search: string, enabled: boolean) {
  return useArchivedList<ArchivedTag>("tags", fetchArchivedTags, {
    search,
    enabled,
  });
}

export function useArchivedPromotions(search: string, enabled: boolean) {
  return useArchivedList<ArchivedPromotion>(
    "promotions",
    fetchArchivedPromotions,
    { search, enabled },
  );
}

/**
 * The numbers on the tab strip.
 *
 * A separate query from the lists, and it has to be: a count is the size of a
 * set the screen has *not* loaded, so deriving it from the rows in hand would
 * make every tab read the page size. It runs whatever filter is showing,
 * because the strip has to describe all four even while only one is fetched.
 *
 * The search term goes in, so the numbers answer the question the operator just
 * asked rather than the one before it.
 */
export function useArchiveCounts(search: string) {
  const term = searchTerm(search);

  return useQuery({
    queryKey: [...catalogueArchiveKey, "counts", term ?? ""],
    queryFn: () => fetchArchiveCounts(term),
    placeholderData: (previous) => previous,
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
 *
 * `catalogueArchiveKey` is the prefix of all five archive queries — the four
 * lists and the counts — so one invalidation still reaches every one of them.
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
