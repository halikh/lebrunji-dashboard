import { Suspense } from "react";

import { PromotionsScreen } from "@/features/catalog/promotions/promotions-screen";
import { t } from "@/i18n/translations";

export const metadata = { title: t("promotions.tab") };

export default function PromotionsPage() {
  return (
    <Suspense>
      <PromotionsScreen />
    </Suspense>
  );
}
