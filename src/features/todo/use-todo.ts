"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchBranchesWithoutAddress,
  fetchItemsWithoutImage,
  fetchStoresWithoutHours,
  fetchStoresWithoutImage,
} from "./api/todo";

export const todoKeys = {
  all: ["todo"] as const,
  storeImages: ["todo", "store-images"] as const,
  itemImages: ["todo", "item-images"] as const,
  hours: ["todo", "hours"] as const,
  addresses: ["todo", "addresses"] as const,
};

/**
 * The four catalogue checklists, read together.
 *
 * One cache entry per list. Refetched on every visit (`staleTime: 0`): this is the page
 * somebody comes back to after fixing three things, and a cached list still
 * showing them would say the fixes did not land.
 */
export function useTodoLists() {
  const hours = useQuery({
    queryKey: todoKeys.hours,
    queryFn: fetchStoresWithoutHours,
    staleTime: 0,
  });
  const addresses = useQuery({
    queryKey: todoKeys.addresses,
    queryFn: fetchBranchesWithoutAddress,
    staleTime: 0,
  });
  const storeImages = useQuery({
    queryKey: todoKeys.storeImages,
    queryFn: fetchStoresWithoutImage,
    staleTime: 0,
  });
  const itemImages = useQuery({
    queryKey: todoKeys.itemImages,
    queryFn: fetchItemsWithoutImage,
    staleTime: 0,
  });
  return { hours, addresses, storeImages, itemImages };
}

/** Where each kind of gap is fixed. */
export const todoHref = {
  hours: (storeId: string, branchId?: string) =>
    branchId
      ? `/shops/${storeId}/branches/${branchId}?tab=hours`
      : `/shops/${storeId}?tab=hours`,
  /** A one-branch shop's address is on its Details tab; a chain's branch has a page. */
  address: (storeId: string, branchId: string, branchCount: number) =>
    branchCount > 1
      ? `/shops/${storeId}/branches/${branchId}`
      : `/shops/${storeId}?tab=details`,
  storeImage: (storeId: string) => `/shops/${storeId}?tab=details`,
  itemImage: (storeId: string, itemId: string) =>
    `/shops/${storeId}/items/${itemId}`,
};
