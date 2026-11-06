import { Suspense } from "react";

import { ArchiveScreen } from "@/features/catalog/archive/archive-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("archive.tab") };

export default function ArchivePage() {
  return (
    <Suspense>
      <ArchiveScreen />
    </Suspense>
  );
}
