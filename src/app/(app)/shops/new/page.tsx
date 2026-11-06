import { ShopNew } from "@/features/catalog/shops/shop-new";

export const metadata = { title: "New shop" };

/**
 * Adding a shop. A literal segment, so it wins over `[storeId]` — Next
 * matches static folders before dynamic ones.
 */
export default function NewShopPage() {
  return <ShopNew />;
}
