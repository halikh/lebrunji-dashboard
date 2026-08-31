import { Suspense } from "react";

import { CustomersScreen } from "@/features/customers/customers-screen";

/**
 * Customers — search first, then look.
 *
 * The screen reads `?customer=` to decide whether the detail panel is open, and
 * Next requires a boundary around `useSearchParams` during static rendering.
 */
export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}
