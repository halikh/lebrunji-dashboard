import { Suspense } from "react";

import { ShopsList } from "@/features/catalog/shops/shops-list";

export const metadata = { title: "Shops" };

/**
 * The shops. `Suspense` because the list reads `?q=` and `?show=` through
 * `useSearchParams`, which Next will not render on the server without one.
 */
export default function ShopsPage() {
  return (
    <Suspense>
      <ShopsList />
    </Suspense>
  );
}
