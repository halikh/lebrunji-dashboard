import { Suspense } from "react";

import { MenuItemScreen } from "@/features/catalog/menu-item-screen";

/** Adding a dish. Which section it joins comes from `?section=`. */
export default async function NewMenuItemPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  return (
    <Suspense>
      <MenuItemScreen storeId={storeId} itemId={null} />
    </Suspense>
  );
}
