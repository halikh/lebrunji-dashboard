import { Suspense } from "react";

import { CatalogueScreen } from "@/features/catalog/catalogue-screen";

/**
 * The catalogue starts at the shops.
 *
 * A menu belongs to a shop, so there is no useful "all items" view to land on —
 * the first question is always which shop.
 */
export default function CataloguePage() {
  // `Suspense`, because the shell reads its tab out of `useSearchParams` —
  // which Next refuses to render on the server without a boundary, since the
  // query string is not known until the request arrives.
  return (
    <Suspense>
      <CatalogueScreen />
    </Suspense>
  );
}
