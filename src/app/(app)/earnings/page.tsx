import { Suspense } from "react";

import { EarningsScreen } from "@/features/earnings/earnings-screen";

export const metadata = { title: "Earnings" };

/** `Suspense`, because the range is read from `useSearchParams`. */
export default function EarningsPage() {
  return (
    <Suspense>
      <EarningsScreen />
    </Suspense>
  );
}
