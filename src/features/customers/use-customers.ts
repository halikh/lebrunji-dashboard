"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  closeCustomerAccount,
  fetchCustomer,
  fetchCustomerCounts,
  fetchCustomerOrders,
  fetchCustomerRedemptions,
  fetchCustomerStats,
  fetchCustomers,
  setCustomerActive,
  type CustomerScope,
} from "./api/customers";

export const customerKeys = {
  all: ["customers"] as const,
  list: (scope: CustomerScope, search: string) =>
    ["customers", "list", scope, search] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  orders: (id: string) => ["customers", "orders", id] as const,
  stats: (id: string) => ["customers", "stats", id] as const,
  redemptions: (id: string) => ["customers", "redemptions", id] as const,
  counts: ["customers", "counts"] as const,
};

/**
 * The list, filtered and paged.
 *
 * `useInfiniteQuery` because the pages accumulate: the operator scrolls and
 * keeps what is above. The cursor is `created_at` of the last row — keyset, so
 * the database seeks rather than counting past what it has already returned —
 * and it comes back from the fetch rather than being guessed from the row
 * count. A guess is wrong on exactly the page where the rows happen to equal
 * the limit, which is the common case and therefore the bug you do not find.
 *
 * The scope is in the key, so switching tabs is a different list rather than
 * the same one re-filtered. That is what makes the filter a query.
 */
export function useCustomers(scope: CustomerScope, search: string) {
  const term = search.trim();

  return useInfiniteQuery({
    queryKey: customerKeys.list(scope, term),
    queryFn: ({ pageParam }) =>
      fetchCustomers({ scope, search: term || null, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    // A list that blanks on every keystroke is unusable to search with; the
    // previous pages stay under the new query until it resolves.
    placeholderData: (previous) => previous,
  });
}

/**
 * The number on each tab.
 *
 * Its own query, so the list can paint before the counts arrive — and so a
 * failure to count is a missing number rather than a missing list. Invalidated
 * by every mutation here, because suspending somebody moves them between two of
 * these tabs.
 */
export function useCustomerCounts() {
  return useQuery({
    queryKey: customerKeys.counts,
    queryFn: fetchCustomerCounts,
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => fetchCustomer(id as string),
    enabled: id !== null,
  });
}

/** Their whole order history, paged the same way the queue is. */
export function useCustomerOrders(id: string | null) {
  return useInfiniteQuery({
    queryKey: customerKeys.orders(id ?? ""),
    queryFn: ({ pageParam }) =>
      fetchCustomerOrders({ id: id as string, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    enabled: id !== null,
  });
}

/**
 * The totals.
 *
 * Its own query rather than part of the profile, because it reads every order
 * a customer has and the profile should paint without waiting for that. The
 * tiles arrive a beat later; the name and the phone number do not.
 */
export function useCustomerStats(id: string | null) {
  return useQuery({
    queryKey: customerKeys.stats(id ?? ""),
    queryFn: () => fetchCustomerStats(id as string),
    enabled: id !== null,
  });
}

/**
 * The promotions they have actually been given.
 *
 * Its own query, so a failure to read them is a missing block rather than a
 * missing profile — and so the block can say "none yet", which is a real answer
 * about a customer and not an error.
 */
export function useCustomerRedemptions(id: string | null) {
  return useQuery({
    queryKey: customerKeys.redemptions(id ?? ""),
    queryFn: () => fetchCustomerRedemptions(id as string),
    enabled: id !== null,
  });
}

/**
 * Suspending, and lifting a suspension.
 *
 * **Not optimistic**, unlike every other switch in this dashboard. The others
 * are presentation — a tile hidden, a dish off a menu — and the argument for
 * moving them instantly is that a control which waits for a round trip reads as
 * broken.
 *
 * This one signs a person out of their account on every device they own. An
 * optimistic switch says it has happened before it has, and the gap is the
 * window in which the operator has been told somebody is locked out and they
 * are not. That is worth a spinner.
 */
export function useSetCustomerActive() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean; name: string }) =>
      setCustomerActive(input.id, input.isActive),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(
        input.isActive
          ? t("customers.reinstated", { name: input.name })
          : t("customers.suspended", { name: input.name }),
      );
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

export function useCloseCustomerAccount() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      closeCustomerAccount(input.id),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(t("customers.closed", { name: input.name }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}
