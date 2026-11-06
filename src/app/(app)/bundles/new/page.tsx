import { BundleEditor } from "@/features/catalog/bundles/bundle-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("bundles.add") };

/**
 * `?store=` comes from a shop's Bundles tab: it starts the bundle in that shop
 * and sends Save back to the tab. `?shop=` comes from the filtered bundles
 * list: it only preselects the shop.
 */
export default async function NewBundlePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; shop?: string }>;
}) {
  const { store, shop } = await searchParams;
  return (
    <BundleEditor
      id={null}
      fromStoreId={store ?? null}
      presetStoreId={shop ?? null}
    />
  );
}
