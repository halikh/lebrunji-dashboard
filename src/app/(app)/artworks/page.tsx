import { Suspense } from "react";

import { ArtworksScreen } from "@/features/catalog/artworks/artworks-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("artworks.tab") };

export default function ArtworksPage() {
  return (
    <Suspense>
      <ArtworksScreen />
    </Suspense>
  );
}
