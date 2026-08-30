import { OrdersQueue } from "@/features/orders/orders-queue";

/**
 * The dashboard opens on live orders.
 *
 * Not on a statistics page: statistics are something you go and look at, orders
 * are something that happens to you.
 */
export default function OrdersPage() {
  return <OrdersQueue />;
}
