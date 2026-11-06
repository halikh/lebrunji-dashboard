import { BundleEditor } from "@/features/catalog/bundles/bundle-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("bundles.edit") };

/** `?store=` means it was opened from the shop's Bundles tab, and returns there. */
export default async function BundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ store?: string }>;
}) {
  const { id } = await params;
  const { store } = await searchParams;
  return <BundleEditor key={id} id={id} fromStoreId={store ?? null} />;
}
