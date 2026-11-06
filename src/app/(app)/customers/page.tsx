import { Suspense } from "react";

import { CustomersScreen } from "@/features/customers/customers-screen";

export const metadata = { title: "Customers" };

/** Reads `?q=` and `?show=`, so it needs a boundary around `useSearchParams`. */
export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}
