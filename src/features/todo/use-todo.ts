"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchBranchesWithoutAddress,
  fetchDriversToFix,
  fetchStoresWithoutCommission,
  fetchItemsWithoutImage,
  fetchItemsWithoutMarkup,
  fetchStoresWithoutHours,
  fetchStoresWithoutImage,
} from "./api/todo";

export const todoKeys = {
  all: ["todo"] as const,
  storeImages: ["todo", "store-images"] as const,
  itemImages: ["todo", "item-images"] as const,
  hours: ["todo", "hours"] as const,
  addresses: ["todo", "addresses"] as const,
  commission: ["todo", "commission"] as const,
  markup: ["todo", "markup"] as const,
  drivers: ["todo", "drivers"] as const,
};

/**
 * The six catalogue checklists and the drivers' hours, read together.
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
  const commission = useQuery({
    queryKey: todoKeys.commission,
    queryFn: fetchStoresWithoutCommission,
    staleTime: 0,
  });
  const markup = useQuery({
    queryKey: todoKeys.markup,
    queryFn: fetchItemsWithoutMarkup,
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
  const drivers = useQuery({
    queryKey: todoKeys.drivers,
    queryFn: fetchDriversToFix,
    staleTime: 0,
  });
  return {
    hours,
    addresses,
    commission,
    markup,
    storeImages,
    itemImages,
    drivers,
  };
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
  /** The rate is in the Prices section of the shop's Details tab. */
  commission: (storeId: string) => `/shops/${storeId}?tab=details`,
  /**
   * The dish's page, where the price from the shop and our markup are; for a
   * branch's gap, that branch's Menu tab, where its own are.
   */
  markup: (storeId: string, itemId: string, branchId?: string) =>
    branchId
      ? `/shops/${storeId}/branches/${branchId}?tab=menu`
      : `/shops/${storeId}/items/${itemId}`,
  itemImage: (storeId: string, itemId: string) =>
    `/shops/${storeId}/items/${itemId}`,
  /** The driver's page, where "Edit hours" is. */
  driver: (id: string) => `/drivers/${id}`,
};
