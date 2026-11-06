import { PromotionEditor } from "@/features/catalog/promotions/promotion-editor";
import { t } from "@/i18n/translations";

export const metadata = { title: t("promotions.edit") };

export default async function PromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PromotionEditor key={id} id={id} />;
}
