import { Suspense } from "react";

import { OrdersQueue } from "@/features/orders/orders-queue";

/**
 * The dashboard opens on live orders.
 *
 * Not on a statistics page: statistics are something you go and look at, orders
 * are something that happens to you.
 */
export default function OrdersPage() {
  // The queue reads `?order=` to decide whether the detail panel is open, and
  // Next requires a boundary around `useSearchParams` during static rendering.
  return (
    <Suspense>
      <OrdersQueue />
    </Suspense>
  );
}
