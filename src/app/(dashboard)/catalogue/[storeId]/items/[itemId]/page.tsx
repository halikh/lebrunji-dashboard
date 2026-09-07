import { Suspense } from "react";

import { MenuItemScreen } from "@/features/catalog/menu-item-screen";

/** One dish. */
export default async function MenuItemPage({
  params,
}: {
  params: Promise<{ storeId: string; itemId: string }>;
}) {
  const { storeId, itemId } = await params;

  return (
    <Suspense>
      <MenuItemScreen storeId={storeId} itemId={itemId} />
    </Suspense>
  );
}
