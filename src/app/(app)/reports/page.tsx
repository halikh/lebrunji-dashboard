import { Suspense } from "react";

import { ReportsScreen } from "@/features/reports/reports-screen";

export const metadata = { title: "Reports" };

/** `Suspense`, because the range is read from `useSearchParams`. */
export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
