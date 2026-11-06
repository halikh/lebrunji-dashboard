import { Suspense } from "react";

import { PricingScreen } from "@/features/pricing/pricing-screen";

export const metadata = { title: "Pricing" };

/** `Suspense`, because the screen reads its tab from `useSearchParams`. */
export default function PricingPage() {
  return (
    <Suspense>
      <PricingScreen />
    </Suspense>
  );
}
