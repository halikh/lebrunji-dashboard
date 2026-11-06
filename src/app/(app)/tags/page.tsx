import { Suspense } from "react";

import { TagsScreen } from "@/features/catalog/tags/tags-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("tags.tab") };

export default function TagsPage() {
  return (
    <Suspense>
      <TagsScreen />
    </Suspense>
  );
}
