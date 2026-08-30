import { Suspense } from "react";

import { PricingScreen } from "@/features/pricing/pricing-screen";

/**
 * The delivery ladder and the exchange rate.
 *
 * Two settings on one page because they are the same errand — a merchant
 * setting up, or reacting to a currency that moved — and because
 * `delivery_quote` reads both on every basket.
 */
export default function PricingPage() {
  // `Suspense`, because the screen reads its tab out of `useSearchParams` —
  // which Next refuses to prerender without a boundary, since the query string
  // is not known until the request arrives.
  return (
    <Suspense>
      <PricingScreen />
    </Suspense>
  );
}
