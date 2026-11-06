import { PromotionEditor } from "@/features/catalog/promotions/promotion-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("promotions.add") };

export default function NewPromotionPage() {
  return <PromotionEditor id={null} />;
}
