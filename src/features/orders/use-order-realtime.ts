"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useToasts } from "@/components/ui/toast";
import { fetchAppSettings } from "@/features/settings/api/app-settings";
import { chime, unlock } from "@/lib/chime";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";

import { orderKeys } from "./use-orders";

/**
 * How long a burst of order events is gathered into one refresh. Long enough
 * to cover one order's handful of events, short enough that a new order is on
 * screen before anyone looks up from the chime.
 */
const COALESCE_MS = 500;

/**
 * Keeps the queue live.
 *
 * ## Nothing new was needed in the database
 *
 * `orders` and `order_stores` are already `replica identity full` and already
 * in the `supabase_realtime` publication — migration 0035 put them there for
 * the customer's own order screen. The admin read policies from 0063 are what
 * make the same publication show *every* order to an operator: RLS applies to
 * `postgres_changes` payloads exactly as it does to a select, so this
 * subscription is scoped by the same rule as everything else.
 *
 * ## Invalidate, do not patch
 *
 * The payload carries the changed row, and it would be possible to splice it
 * into the cache. It is deliberately not: an order in the queue is assembled
 * from five tables, and a patch that knows about only one of them produces a
 * row that is subtly wrong — the status moved but the shop name is missing.
 * Invalidating costs one request and cannot be half right.
 *
 * ## The chime is only for genuinely new orders
 *
 * INSERT on `orders`, not UPDATE: a status changing is the operator's own doing
 * a moment earlier, and a dashboard that chimes at its own clicks trains people
 * to stop hearing it.
 */
export function useOrderRealtime() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  // Held in a ref so the subscription effect does not depend on `toast` — it
  // is a new object each render, and depending on it would drop and reopen the
  // socket on every render, which is how a live screen ends up not live.
  //
  // Written in its own effect rather than during render: a ref assigned while
  // rendering is a write React cannot see, and under Strict Mode or a
  // re-entrant render it can be the previous value by the time it is read.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  /**
   * The chosen sound, held in a ref for the same reason the toast is.
   *
   * The subscription is set up once and its handler closes over whatever was
   * in scope then. Reading the setting directly would freeze whichever value
   * happened to be loaded when the channel opened — so changing the sound would
   * appear to do nothing until a reload, which is exactly the sort of setting
   * that gets reported as broken.
   */
  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    staleTime: 10 * 60_000,
  });
  const soundRef = useRef<string | null>(null);
  useEffect(() => {
    soundRef.current = settings.data?.notificationSoundUrl ?? null;
  }, [settings.data]);

  /**
   * Keeps the chime unlockable after the sign-in click is long gone.
   *
   * Sign-in is not the only way onto this screen: a reload, or coming back
   * with a session that is still live, lands here with no gesture at all, and
   * the context the chime plays through stays suspended. Any click or key from
   * then on wakes it. Listening for the whole session rather than once,
   * because a browser can suspend the context again after the tab has been in
   * the background, and `unlock()` on a running context costs nothing.
   */
  useEffect(() => {
    const wake = () => unlock();
    window.addEventListener("pointerdown", wake, { capture: true });
    window.addEventListener("keydown", wake, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", wake, { capture: true });
      window.removeEventListener("keydown", wake, { capture: true });
    };
  }, []);

  useEffect(() => {
    const supabase = getClient();

    /**
     * One refresh per burst, and none while nobody is looking.
     *
     * Every change to an order used to invalidate everything under
     * `['orders']` at once — the list and every page scrolled into it, the
     * five status counts, the open order — in every tab. One two-shop order
     * is three or four events within milliseconds (the order, a portion per
     * shop, then each status change), so at a launch rush that was the whole
     * queue re-read several times over per order, per tab: hundreds of
     * requests a second for screens showing the same thing.
     *
     * Now the first event of a burst schedules one refresh `COALESCE_MS`
     * later and the rest ride on it. A hidden tab refreshes nothing; it
     * remembers that something changed and catches up once, when it is
     * looked at again. The chime and the toast are not delayed — they are
     * the part a person is waiting for.
     */
    let timer: ReturnType<typeof setTimeout> | null = null;
    let missed = false;

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        missed = true;
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      }, COALESCE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !missed) return;
      missed = false;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel("dashboard-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          refresh();
          chime(soundRef.current);
          toastRef.current.info(t("orders.arrived"));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_stores" },
        // Where the status lives, so this is the one that fires when another
        // device advances an order.
        refresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
