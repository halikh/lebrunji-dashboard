import { Suspense } from "react";

import { DriversScreen } from "@/features/drivers/drivers-screen";

/**
 * Who an order can be handed to.
 *
 * The screen reads `?scope=` to decide which filter tab is on, and Next
 * requires a boundary around `useSearchParams` during static rendering —
 * without it the whole page is a prerender error rather than a warning.
 */
export default function DriversPage() {
  return (
    <Suspense>
      <DriversScreen />
    </Suspense>
  );
}
