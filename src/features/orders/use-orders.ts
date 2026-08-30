"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchOrder,
  fetchOrderStatuses,
  fetchOrders,
  fetchStatusCounts,
  setOrderStatus,
  type Order,
  type OrderStatus,
  type Scope,
} from "./api/orders";

/**
 * Cache keys, in one place.
 *
 * Every key starts `['orders', …]`, so realtime can invalidate the whole
 * feature with one prefix rather than knowing which lists exist. A key built
 * inline at a call site is a key nothing can find later.
 */
export const orderKeys = {
  all: ["orders"] as const,
  statuses: () => ["orders", "statuses"] as const,
  counts: () => ["orders", "counts"] as const,
  list: (scope: Scope, statusSlug: string | null, search: string) =>
    ["orders", "list", scope, statusSlug, search] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};

export function useOrderStatuses() {
  return useQuery({
    queryKey: orderKeys.statuses(),
    queryFn: () => fetchOrderStatuses(),
    // Reference data. It changes when a merchant edits the path, which is
    // approximately never, and the realtime handler does not touch it.
    staleTime: 10 * 60_000,
  });
}

export function useStatusCounts(statuses: OrderStatus[] | undefined) {
  return useQuery({
    queryKey: orderKeys.counts(),
    queryFn: () => fetchStatusCounts(statuses ?? []),
    enabled: (statuses?.length ?? 0) > 0,
  });
}

export function useOrders(
  scope: Scope,
  statusSlug: string | null,
  search: string,
  statuses: OrderStatus[] | undefined,
) {
  return useQuery({
    // `statuses` is not in the key: it is reference data that changes about
    // never, and putting it there would refetch every list the first time it
    // loads. It only decides *which* slugs "live" means.
    queryKey: orderKeys.list(scope, statusSlug, search),
    queryFn: () =>
      fetchOrders({ scope, statusSlug, statuses, search: search || null }),
    // "live" cannot be answered before the statuses are known — without them it
    // would fall through to an unfiltered list, which is the whole bug.
    enabled: scope !== "live" || (statuses?.length ?? 0) > 0,
    // A list that blanks on every keystroke is unusable to search with; the
    // previous page stays under the new query until it resolves.
    placeholderData: (previous) => previous,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: () => fetchOrder(id as string),
    enabled: id !== null,
  });
}

/**
 * The next step for a shop's portion of an order.
 *
 * Read from the statuses table rather than hardcoded, because `order_statuses`
 * is a lookup table exactly so a merchant can insert a step. Terminal statuses
 * (`progress: null`, or the last one on the path) have no next step, and the
 * RPC refuses to move off them anyway.
 */
export function nextStatus(
  statuses: OrderStatus[] | undefined,
  currentSlug: string,
): OrderStatus | null {
  if (!statuses) return null;

  const current = statuses.find((s) => s.slug === currentSlug);
  if (!current || current.progress === null) return null;

  const onPath = statuses
    .filter((s) => s.progress !== null)
    .sort((a, b) => (a.progress as number) - (b.progress as number));

  const index = onPath.findIndex((s) => s.slug === currentSlug);
  return index >= 0 ? (onPath[index + 1] ?? null) : null;
}

/**
 * Advances one shop's portion, optimistically, with undo.
 *
 * ## Why optimistic is honest here
 *
 * The row moves before the server has answered, which is normally a way of
 * lying to somebody. It is not here, because the server is still the authority:
 * `api_v1_set_order_status` decides, and a refusal rolls the row back and says
 * why. What optimism buys is an operator working a rush who is not waiting on a
 * round trip between each order.
 *
 * ## Why undo rather than a confirmation
 *
 * This runs hundreds of times a day. A dialog on an action at that frequency is
 * clicked through without being read — it costs a second every time and stops
 * protecting anything. Undo calls the same RPC in reverse, so it is a real
 * reversal rather than a hidden second confirmation.
 *
 * The terminal moves are the exception and keep a real confirm, because the RPC
 * refuses to move off `delivered` or `cancelled` — an undo offered there would
 * fail, and an undo that does not undo is worse than no undo.
 */
export function useAdvanceOrder() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const mutation = useMutation({
    mutationFn: (input: { orderStoreId: string; toSlug: string }) =>
      setOrderStatus(input.orderStoreId, input.toSlug),

    onMutate: async (input) => {
      // Stop any list refetch from landing mid-flight and overwriting the
      // optimistic row with the pre-move server state.
      await queryClient.cancelQueries({ queryKey: orderKeys.all });

      const snapshot = queryClient.getQueriesData({ queryKey: orderKeys.all });

      queryClient.setQueriesData<{ orders: Order[] }>(
        { queryKey: ["orders", "list"] },
        (page) =>
          page && {
            ...page,
            orders: page.orders.map((order) => ({
              ...order,
              stores: order.stores.map((store) =>
                store.id === input.orderStoreId
                  ? { ...store, statusSlug: input.toSlug }
                  : store,
              ),
            })),
          },
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      // Every list is restored, not just the one on screen: the same order can
      // be in the "needs you" tab and a search result at once, and half a
      // rollback is a queue that disagrees with itself.
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  const advance = useCallback(
    (input: {
      orderStoreId: string;
      fromSlug: string;
      toSlug: string;
      toName: string;
      /** Terminal moves cannot be undone — the RPC refuses to come back. */
      undoable?: boolean;
    }) => {
      mutation.mutate(
        { orderStoreId: input.orderStoreId, toSlug: input.toSlug },
        {
          onSuccess: () => {
            toast.success(
              t("orders.moved", { status: input.toName }),
              input.undoable === false
                ? undefined
                : () =>
                    new Promise<void>((resolve, reject) => {
                      mutation.mutate(
                        {
                          orderStoreId: input.orderStoreId,
                          toSlug: input.fromSlug,
                        },
                        { onSuccess: () => resolve(), onError: reject },
                      );
                    }),
            );
          },
        },
      );
    },
    [mutation, toast],
  );

  return { advance, isPending: mutation.isPending };
}
