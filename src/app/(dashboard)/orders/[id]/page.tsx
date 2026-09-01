import { OrderScreen } from "@/features/orders/order-screen";

/**
 * One order, on its own page.
 *
 * The queue's panel is for working *through* orders without losing your place;
 * this is for sending one to somebody, opening it in a second tab, or reading
 * it with room around it. Both render the same receipt.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderScreen id={id} />;
}
