import { Suspense } from "react";

import { StoreScreen } from "@/features/catalog/store-screen";

/**
 * A shop's menu.
 *
 * The id comes from the path rather than from state, so the screen is
 * linkable — an operator can send "the menu that is wrong" to somebody.
 */
export default async function StoreMenuPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  // `Suspense`, because the shell reads the tab out of `useSearchParams` —
  // which Next refuses to render on the server without a boundary, since the
  // query string is not known until the request arrives.
  return (
    <Suspense>
      <StoreScreen storeId={storeId} />
    </Suspense>
  );
}
