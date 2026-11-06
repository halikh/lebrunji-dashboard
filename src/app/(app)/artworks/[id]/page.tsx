import { ArtworkEditor } from "@/features/catalog/artworks/artwork-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("artworks.edit") };

export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArtworkEditor key={id} id={id} />;
}
