"use client";

import { Rail } from "@/components/shell/rail";
import { useOrderRealtime } from "@/features/orders/use-order-realtime";
import {
  useLiveOrderCount,
  useOrderStatuses,
} from "@/features/orders/use-orders";

/**
 * The rail, kept live — and the one place the order subscription is opened.
 *
 * ## Why the subscription lives in the shell rather than on the queue
 *
 * It used to be mounted inside `OrdersQueue`, which meant it only existed while
 * somebody was looking at the queue. So a new order arriving while the operator
 * was editing a menu made no sound, showed no toast, and did not move the
 * badge — on precisely the screens where they were not going to notice it
 * themselves.
 *
 * The layout already claimed otherwise: *"the rail persists across every route,
 * so a new order arriving while somebody is editing a menu still shows up in
 * the badge."* That was true of the rail and not of anything feeding it. This
 * is what makes the sentence true.
 *
 * ## Exactly one subscription
 *
 * The channel is named, so mounting this twice would open two channels and
 * every order would chime and toast twice. It belongs to the shell, which
 * renders once per session, and the queue no longer opens its own.
 *
 * The queue stays live regardless: the hook invalidates `orderKeys.all`, and
 * that is what the queue's own queries read.
 *
 * ## The badge counts orders, not statuses
 *
 * `fetchLiveOrderCount` is one `head` request over the live statuses rather
 * than a sum of per-status counts — an order spanning two shops at two steps
 * would otherwise be counted twice, on the one number that is on screen all
 * day.
 */
export function LiveRail() {
  useOrderRealtime();

  const statuses = useOrderStatuses();
  const live = useLiveOrderCount(statuses.data);

  return <Rail liveOrders={live.data ?? 0} />;
}
