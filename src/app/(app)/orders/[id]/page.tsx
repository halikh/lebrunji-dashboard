import { Suspense } from "react";

import { OrderPage } from "@/features/orders/order-page";

export const metadata = { title: "Order" };

/**
 * One order, on its own page — for sending to somebody, opening in a second
 * tab, or reading with room around it. The queue's panel renders the same
 * receipt.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <OrderPage id={id} />
    </Suspense>
  );
}
