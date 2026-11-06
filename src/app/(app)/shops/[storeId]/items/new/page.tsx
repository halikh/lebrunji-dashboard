import { Suspense } from "react";

import { DishScreen } from "@/features/catalog/menu/dish-screen";

/** Adding a dish. Which section it joins comes from `?section=`. */
export default async function NewDishPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return (
    <Suspense>
      <DishScreen storeId={storeId} itemId={null} />
    </Suspense>
  );
}
