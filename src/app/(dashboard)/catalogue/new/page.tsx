import { Suspense } from "react";

import { StoreEditor } from "@/features/catalog/store-editor";

/**
 * Adding a shop.
 *
 * A literal segment, so it wins over `[storeId]` — Next matches static folders
 * before dynamic ones, which is why this is the add form rather than a shop
 * whose id is the word "new".
 */
export default function NewStorePage() {
  return (
    <Suspense>
      <StoreEditor />
    </Suspense>
  );
}
