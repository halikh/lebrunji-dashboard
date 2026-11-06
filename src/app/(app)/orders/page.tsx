import { Suspense } from "react";

import { OrdersScreen } from "@/features/orders/orders-screen";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersScreen />
    </Suspense>
  );
}
