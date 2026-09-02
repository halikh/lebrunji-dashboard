"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useToasts } from "@/components/ui/toast";
import { fetchAppSettings } from "@/features/settings/api/app-settings";
import { chime } from "@/lib/chime";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";

import { orderKeys } from "./use-orders";

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

  useEffect(() => {
    const supabase = getClient();

    const channel = supabase
      .channel("dashboard-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          void queryClient.invalidateQueries({ queryKey: orderKeys.all });
          chime(soundRef.current);
          toastRef.current.info(t("orders.arrived"));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_stores" },
        () => {
          // Where the status lives, so this is the one that fires when another
          // device advances an order.
          void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
