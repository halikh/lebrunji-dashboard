import { Suspense } from "react";

import { DishScreen } from "@/features/catalog/menu/dish-screen";

/** One dish. */
export default async function DishPage({
  params,
}: {
  params: Promise<{ storeId: string; itemId: string }>;
}) {
  const { storeId, itemId } = await params;
  return (
    <Suspense>
      <DishScreen storeId={storeId} itemId={itemId} />
    </Suspense>
  );
}
