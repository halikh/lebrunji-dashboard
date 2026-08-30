import { StoresList } from "@/features/catalog/stores-list";

/**
 * The catalogue starts at the shops.
 *
 * A menu belongs to a shop, so there is no useful "all items" view to land on —
 * the first question is always which shop.
 */
export default function CataloguePage() {
  return <StoresList />;
}
