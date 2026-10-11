"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";
import { isUndoableMove, orderStatuses } from "@/lib/order-status";

import {
  advanceOrder,
  fetchOrder,
  fetchOrders,
  fetchLiveOrderCount,
  fetchStatusCounts,
  type Order,
  type OrderStatus,
  type Scope,
} from "./api/orders";
import { OrderRefusal } from "./api/refusal";

/**
 * Cache keys, in one place.
 *
 * Every key starts `['orders', …]`, so realtime can invalidate the whole
 * feature with one prefix rather than knowing which lists exist. A key built
 * inline at a call site is a key nothing can find later.
 */
export const orderKeys = {
  all: ["orders"] as const,
  counts: (scope: Scope) => ["orders", "counts", scope] as const,
  list: (scope: Scope, statusSlug: string | null, search: string) =>
    ["orders", "list", scope, statusSlug, search] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
  /**
   * Who this order was handed to. Under `orders` like everything else, so a
   * status move invalidates it with the rest — the dispatch dialog and the
   * history tab read the same key.
   */
  handovers: (id: string) => ["orders", id, "handovers"] as const,
  amendments: (id: string) => ["orders", id, "amendments"] as const,
};

/**
 * Every status, in path order, named in the dashboard's language.
 *
 * Not a query: the path is hardcoded (see `src/lib/order-status.ts`), so there
 * is nothing to wait for and nothing that can fail. Memoised so the array
 * keeps its identity across renders for the hooks that depend on it.
 */
export function useOrderStatuses(): OrderStatus[] {
  return useMemo(() => orderStatuses(), []);
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
 * number that is already pushed.
 */
export function useLiveOrderCount() {
  return useQuery({
    queryKey: [...orderKeys.all, "live-total"] as const,
    queryFn: () => fetchLiveOrderCount(),
    staleTime: 60_000,
  });
}

export function useStatusCounts(scope: Scope) {
  return useQuery({
    queryKey: orderKeys.counts(scope),
    // `live` and `all` count the same rows — the live tabs *are* the
    // non-terminal statuses, so there is nothing extra to filter.
    queryFn: () => fetchStatusCounts(scope === "today" ? "today" : "all"),
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
) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(scope, statusSlug, search),
    queryFn: ({ pageParam }) =>
      fetchOrders({
        scope,
        statusSlug,
        search: search || null,
        before: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
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

/**
 * The next step for a shop's portion of an order.
 *
 * Terminal statuses (`progress: null`, or the last one on the path) have no
 * next step, and the RPC refuses to move off them anyway.
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

  const bySlug = new Map<string, OrderStatus>(statuses.map((s) => [s.slug, s]));
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
 * `api_v1_advance_order` decides, and a refusal rolls the row back and says
 * why. What optimism buys is an operator working a rush who is not waiting on a
 * round trip between each order.
 *
 * ## Every press says what it saw
 *
 * `expectedFrom` is the status on the operator's screen when they pressed, and
 * the function refuses with `MOVED` if the order is somewhere else by then
 * (`0173`). Without it, two operators pressing Confirm and Cancel on the same
 * order a second apart both "succeeded", and whichever landed second won
 * silently. An undo passes the status it is undoing *from*, so undoing a move
 * somebody else has since built on is refused rather than rewinding theirs.
 *
 * And **nothing moved is not success.** The function skips finished portions
 * and returns how many it moved; zero means the order was delivered or
 * cancelled under the operator's feet, and saying "moved to Confirmed" over it
 * is the toast `0171` was written to stop.
 *
 * ## Why undo rather than a confirmation
 *
 * This runs hundreds of times a day. A dialog on an action at that frequency is
 * clicked through without being read — it costs a second every time and stops
 * protecting anything. Undo calls the same RPC in reverse, so it is a real
 * reversal rather than a hidden second confirmation.
 *
 * The terminal moves are the exception and are never offered an undo, because
 * the RPC will not move off `delivered` or `cancelled` — see `isUndoableMove`.
 * That is decided here, from the target, rather than trusted to each caller.
 */
export function useAdvanceOrder(statuses?: OrderStatus[]) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const mutation = useMutation({
    mutationFn: async (input: {
      orderId: string;
      toSlug: string;
      expectedFrom: string | null;
    }) => {
      const moved = await advanceOrder(
        input.orderId,
        input.toSlug,
        input.expectedFrom,
      );
      // Zero is somebody else having finished it first — see above. Thrown so
      // the rollback and the refetch below run exactly as for a refusal.
      if (moved === 0) {
        throw new OrderRefusal(t("orders.movedElsewhere"), "MOVED");
      }
      return moved;
    },

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

    // Every key under `orders` — the lists, the counts, the receipt beside the
    // queue and its handovers. After a refusal the screen was wrong about where
    // this order is, and the receipt is the part the operator is reading.
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
      /**
       * A caller may withhold the undo; it cannot grant one. Moves onto
       * `delivered` or `cancelled` never get it whatever this says — the RPC
       * will not come back off them. See `isUndoableMove`.
       */
      undoable?: boolean;
    }) => {
      const undoable = input.undoable !== false && isUndoableMove(input.toSlug);

      mutation.mutate(
        {
          orderId: input.orderId,
          toSlug: input.toSlug,
          // What the screen showed. Empty means the caller could not tell —
          // an order with no portions — and asks for no check rather than a
          // check against nothing.
          expectedFrom: input.fromSlug || null,
        },
        {
          onSuccess: () => {
            toast.success(
              t("orders.moved", { code: input.code, status: input.toName }),
              !undoable || !input.fromSlug
                ? undefined
                : () =>
                    // Resolves either way. A refused undo has already said
                    // why in its own toast (`onError` above), and rejecting
                    // here only became an unhandled rejection in the toast.
                    new Promise<void>((resolve) => {
                      mutation.mutate(
                        {
                          orderId: input.orderId,
                          toSlug: input.fromSlug,
                          // Undoing *from* where this move put it. If
                          // somebody has moved it on since, the undo is
                          // refused rather than rewinding their move too.
                          expectedFrom: input.toSlug,
                        },
                        { onSettled: () => resolve() },
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
