import { ArtworkEditor } from "@/features/catalog/artworks/artwork-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("artworks.add") };

/**
 * `?discount=` and `?bundle=` preselect what the picture advertises — the
 * promotion and bundle editors link here to add theirs.
 */
export default async function NewArtworkPage({
  searchParams,
}: {
  searchParams: Promise<{ discount?: string; bundle?: string }>;
}) {
  const { discount, bundle } = await searchParams;
  return (
    <ArtworkEditor
      id={null}
      initialDiscountId={discount ?? null}
      initialBundleId={bundle ?? null}
    />
  );
}
