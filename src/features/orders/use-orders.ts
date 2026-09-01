"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  advanceOrder,
  fetchOrder,
  fetchOrderStatuses,
  fetchOrders,
  fetchLiveOrderCount,
  fetchStatusCounts,
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
  counts: (scope: Scope) => ["orders", "counts", scope] as const,
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

/**
 * The tab counts, for the scope the queue is showing.
 *
 * Keyed by scope so switching to Today does not read yesterday's numbers out of
 * the cache — a count that disagrees with the list beneath it is worse than one
 * that takes a moment to arrive.
 *
 * `all` is deliberately not scoped by date, so its counts are the whole
 * history. That is the question that tab asks.
 */
/**
 * The rail's badge.
 *
 * Kept a little stale on purpose: the realtime subscription invalidates it the
 * moment an order arrives, so polling it hard would only add requests to a
 * number that is already pushed. `enabled` waits for the statuses, because
 * "live" cannot be answered before they are known and an unfiltered count would
 * be every order ever placed.
 */
export function useLiveOrderCount(statuses: OrderStatus[] | undefined) {
  return useQuery({
    queryKey: [...orderKeys.all, "live-total"] as const,
    queryFn: () => fetchLiveOrderCount(statuses ?? []),
    enabled: (statuses?.length ?? 0) > 0,
    staleTime: 60_000,
  });
}

export function useStatusCounts(
  statuses: OrderStatus[] | undefined,
  scope: Scope,
) {
  return useQuery({
    queryKey: orderKeys.counts(scope),
    // `live` and `all` count the same rows — the live tabs *are* the
    // non-terminal statuses, so there is nothing extra to filter.
    queryFn: () =>
      fetchStatusCounts(statuses ?? [], scope === "today" ? "today" : "all"),
    enabled: (statuses?.length ?? 0) > 0,
  });
}

/**
 * The queue, paged.
 *
 * `useInfiniteQuery` rather than `useQuery`, because the pages have to
 * accumulate: the operator scrolls down and keeps what is above. The cursor is
 * `placed_at` of the last row — keyset, so the database seeks rather than
 * counting past what it has already returned.
 *
 * `getNextPageParam` reads the cursor the fetch returned rather than guessing
 * from the row count. A guess is wrong on the exact page where the number of
 * rows happens to equal the limit, which is the common case and therefore the
 * bug you do not find.
 */
export function useOrders(
  scope: Scope,
  statusSlug: string | null,
  search: string,
  statuses: OrderStatus[] | undefined,
) {
  return useInfiniteQuery({
    // `statuses` is not in the key: it is reference data that changes about
    // never, and putting it there would refetch every list the first time it
    // loads. It only decides *which* slugs "live" means.
    queryKey: orderKeys.list(scope, statusSlug, search),
    queryFn: ({ pageParam }) =>
      fetchOrders({
        scope,
        statusSlug,
        statuses,
        search: search || null,
        before: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    // "live" cannot be answered before the statuses are known — without them it
    // would fall through to an unfiltered list, which is the whole bug.
    enabled: scope !== "live" || (statuses?.length ?? 0) > 0,
    // A list that blanks on every keystroke is unusable to search with; the
    // previous pages stay under the new query until it resolves.
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
/** Terminal: off the path, or the end of it. Mirrors the RPC's own rule. */
function isTerminalSlug(
  slug: string,
  statuses: OrderStatus[] | undefined,
): boolean {
  if (!statuses) return false;
  const status = statuses.find((s) => s.slug === slug);
  if (!status || status.progress === null) return true;
  const highest = Math.max(...statuses.map((s) => s.progress ?? -1));
  return status.progress >= highest;
}

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
 * The order's own status.
 *
 * An order spans shops, and the shops each carry one — so "the order's status"
 * has to be derived. It is the **least advanced portion that can still move**:
 * an order is not confirmed until every shop has confirmed it, because the
 * customer is told one thing and the courier collects one bag.
 *
 * When nothing can move, the order is finished, and the *most* advanced portion
 * is the answer — a two-shop order where one delivered and the other cancelled
 * reads as delivered, which is what the customer experienced.
 */
export function orderStatus(
  order: Order,
  statuses: OrderStatus[] | undefined,
): OrderStatus | null {
  if (!statuses || order.stores.length === 0) return null;

  const bySlug = new Map(statuses.map((s) => [s.slug, s]));
  const present = order.stores
    .map((store) => bySlug.get(store.statusSlug))
    .filter((s): s is OrderStatus => s !== undefined);

  if (present.length === 0) return null;

  const highest = Math.max(...statuses.map((s) => s.progress ?? -1));
  const movable = present.filter(
    (s) => s.progress !== null && s.progress < highest,
  );

  if (movable.length > 0) {
    return movable.reduce((least, s) =>
      (s.progress as number) < (least.progress as number) ? s : least,
    );
  }

  // All finished. The furthest along is what the customer saw; `cancelled` has
  // no progress and loses to a delivered sibling, deliberately.
  return present.reduce((furthest, s) =>
    (s.progress ?? -1) > (furthest.progress ?? -1) ? s : furthest,
  );
}

/**
 * Advances a whole order, optimistically, with undo.
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
export function useAdvanceOrder(statuses?: OrderStatus[]) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const mutation = useMutation({
    mutationFn: (input: { orderId: string; toSlug: string }) =>
      advanceOrder(input.orderId, input.toSlug),

    onMutate: async (input) => {
      // Stop any list refetch from landing mid-flight and overwriting the
      // optimistic row with the pre-move server state.
      await queryClient.cancelQueries({ queryKey: orderKeys.all });

      const snapshot = queryClient.getQueriesData({ queryKey: orderKeys.all });

      // Across every *page* of every list. An infinite query holds an array of
      // pages, and patching only the first would leave a scrolled-down operator
      // watching a row that did not move.
      queryClient.setQueriesData<{ pages: { orders: Order[] }[] }>(
        { queryKey: ["orders", "list"] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              orders: page.orders.map((order) =>
                order.id !== input.orderId
                  ? order
                  : {
                      ...order,
                      // Every portion, because the whole order moved. Terminal
                      // ones stay put — the function will not move them either,
                      // so an optimistic row that did would disagree with what
                      // comes back.
                      stores: order.stores.map((store) =>
                        isTerminalSlug(store.statusSlug, statuses)
                          ? store
                          : { ...store, statusSlug: input.toSlug },
                      ),
                    },
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
      orderId: string;
      /** The order's own code, so the confirmation says which order moved. */
      code: string;
      fromSlug: string;
      toSlug: string;
      toName: string;
      /** Terminal moves cannot be undone — the RPC refuses to come back. */
      undoable?: boolean;
    }) => {
      mutation.mutate(
        { orderId: input.orderId, toSlug: input.toSlug },
        {
          onSuccess: () => {
            toast.success(
              t("orders.moved", { code: input.code, status: input.toName }),
              input.undoable === false
                ? undefined
                : () =>
                    new Promise<void>((resolve, reject) => {
                      mutation.mutate(
                        { orderId: input.orderId, toSlug: input.fromSlug },
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
