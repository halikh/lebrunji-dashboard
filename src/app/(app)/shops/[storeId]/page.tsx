import { Suspense } from "react";

import { ShopScreen } from "@/features/catalog/shops/shop-screen";

/**
 * One shop. The id comes from the path and the tab from `?tab=`, so any view
 * of a shop can be linked — "the menu that is wrong" sent to somebody.
 */
export default async function ShopPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return (
    <Suspense>
      <ShopScreen storeId={storeId} />
    </Suspense>
  );
}
