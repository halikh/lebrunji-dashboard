import { Suspense } from "react";

import { ReportsScreen } from "@/features/reports/reports-screen";

/**
 * The overview.
 *
 * The screen reads `?days=` for its range, and Next requires a boundary around
 * `useSearchParams` during static rendering.
 */
export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
