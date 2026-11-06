import { Suspense } from "react";

import { CategoriesScreen } from "@/features/catalog/categories/categories-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("categories.tab") };

export default function CategoriesPage() {
  return (
    <Suspense>
      <CategoriesScreen />
    </Suspense>
  );
}
