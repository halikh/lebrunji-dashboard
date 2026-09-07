import { Suspense } from "react";

import { PromotionEditor } from "@/features/catalog/promotion-editor";

/** Adding a promotion. `Suspense` as on every other editor route. */
export default function NewPromotionPage() {
  return (
    <Suspense>
      <PromotionEditor id={null} />
    </Suspense>
  );
}
