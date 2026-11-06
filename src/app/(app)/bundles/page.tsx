import { Suspense } from "react";

import { BundlesScreen } from "@/features/catalog/bundles/bundles-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("bundles.tab") };

export default function BundlesPage() {
  return (
    <Suspense>
      <BundlesScreen />
    </Suspense>
  );
}
