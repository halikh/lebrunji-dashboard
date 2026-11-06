"use client";

import { BundlesList } from "./bundles-list";

/**
 * A shop's own bundles, for the Bundles tab of its page. The same list as
 * `/bundles`, fixed to this shop; editing from here returns here.
 */
export function ShopBundlesTab({ storeId }: { storeId: string }) {
  return <BundlesList storeId={storeId} fromShop />;
}
