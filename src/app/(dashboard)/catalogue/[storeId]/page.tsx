import { StoreMenu } from "@/features/catalog/store-menu";

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
  return <StoreMenu storeId={storeId} />;
}
