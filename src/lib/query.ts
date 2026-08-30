import { QueryClient } from "@tanstack/react-query";

/**
 * The query client, and the reasoning behind every number in it.
 *
 * ## Why so little caching
 *
 * The app caches hard — five-minute `staleTime`, a persisted cache — because a
 * customer moving between tabs should not pay for the same read twice. This
 * dashboard is the opposite case: the operator is looking at it *because*
 * something is changing, and a stale queue is not a saving, it is a wrong
 * answer. Realtime invalidates the lists that matter, so short staleness costs
 * almost nothing and removes the class of bug where an order sits on screen for
 * minutes after it was advanced somewhere else.
 *
 * ## Why nothing is persisted
 *
 * Orders, customers and addresses are somebody's personal data, and a persisted
 * cache writes them to the disk of whatever machine the dashboard was opened
 * on. That is the wrong trade for a shop counter or a shared laptop. The app
 * persists because it is one person's phone.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough to dedupe the burst a page load makes, short enough that
        // nothing is trusted for a second time.
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        // The queue is a live screen: coming back to the tab should show what
        // is true now, not what was true when you left.
        refetchOnWindowFocus: true,
        // Realtime is the primary signal and this is the backstop. If the
        // subscription drops, the queue is stale by at most a minute rather
        // than until someone reloads.
        refetchInterval: 60_000,
        // A 401 or an RLS refusal will not become a 200 by asking again, and
        // retrying them delays the honest error by several seconds.
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status !== undefined && status >= 400 && status < 500)
            return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Never automatic. Every mutation here writes something an operator
        // just decided; a silent retry of "advance this order" could advance
        // it twice, and the caller is better placed to decide.
        retry: false,
      },
    },
  });
}
