import { Suspense } from "react";

import { PromotionEditor } from "@/features/catalog/promotion-editor";

/** One promotion. */
export default async function PromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <PromotionEditor id={id} />
    </Suspense>
  );
}
