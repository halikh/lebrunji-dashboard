"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  copyBranchPrices,
  fetchBranchOverrides,
  setGroupHidden,
  setItemHidden,
  setItemPrice,
  setOptionHidden,
  setOptionPrice,
  setSectionHidden,
  type BranchMenuOverrides,
} from "./api/branch-menu";

export const branchMenuKeys = {
  all: ["branch-menu"] as const,
  overrides: (branchId: string) => ["branch-menu", branchId] as const,
};

export function useBranchOverrides(branchId: string | null) {
  return useQuery({
    queryKey: branchMenuKeys.overrides(branchId ?? ""),
    queryFn: () => fetchBranchOverrides(branchId as string),
    enabled: branchId !== null,
  });
}

/**
 * One switch, one write.
 *
 * Each of these is a single row appearing or disappearing, so there is no draft
 * and no Save: the operator flips a dish off at one branch and it is off. That
 * matches what the control looks like — a toggle that needed saving would be a
 * toggle that lies about its own state until you press something else.
 *
 * Not optimistic. A failed write here is a dish that is still being sold
 * somewhere it should not be, or priced at the wrong number, and showing the
 * change and taking it back is a worse way to learn that than a moment's wait.
 * The lists are small and the writes are one row.
 */
function useOverrideMutation<TInput>(
  branchId: string,
  run: (input: TInput) => Promise<void>,
) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: branchMenuKeys.overrides(branchId),
      });
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });
}

export function useSetSectionHidden(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { sectionId: string; hidden: boolean }) =>
      setSectionHidden(branchId, input.sectionId, input.hidden),
  );
}

export function useSetItemHidden(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { itemId: string; hidden: boolean }) =>
      setItemHidden(branchId, input.itemId, input.hidden),
  );
}

export function useSetItemPrice(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { itemId: string; price: number | null }) =>
      setItemPrice(branchId, input.itemId, input.price),
  );
}

export function useSetGroupHidden(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { groupId: string; hidden: boolean }) =>
      setGroupHidden(branchId, input.groupId, input.hidden),
  );
}

export function useSetOptionHidden(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { optionId: string; hidden: boolean }) =>
      setOptionHidden(branchId, input.optionId, input.hidden),
  );
}

export function useSetOptionPrice(branchId: string) {
  return useOverrideMutation(
    branchId,
    (input: { optionId: string; price: number | null }) =>
      setOptionPrice(branchId, input.optionId, input.price),
  );
}

/**
 * Copying prices in, from another branch of the same shop.
 *
 * Says how many dishes it touched rather than only that it worked: "42 dishes
 * now match Hamra" is checkable, and a bare success on an action that rewrites
 * a price list is not.
 */
export function useCopyBranchPrices(branchId: string) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: {
      fromBranchId: string;
      fromName: string;
      sectionId?: string | null;
      itemId?: string | null;
    }) =>
      copyBranchPrices({
        fromBranchId: input.fromBranchId,
        toBranchId: branchId,
        sectionId: input.sectionId,
        itemId: input.itemId,
      }),
    onSuccess: (count, input) => {
      void queryClient.invalidateQueries({
        queryKey: branchMenuKeys.overrides(branchId),
      });
      toast.success(t("branchMenu.copied", { count, name: input.fromName }));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });
}

export type { BranchMenuOverrides };
