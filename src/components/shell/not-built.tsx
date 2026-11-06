import { Construction } from "lucide-react";

import { EmptyState, Page, PageHeader } from "@/components/ui";
import { t, type TranslationKey } from "@/i18n/translations";

export function NotBuilt({ titleKey }: { titleKey: TranslationKey }) {
  return (
    <Page>
      <PageHeader title={t(titleKey)} />
      <EmptyState
        icon={<Construction />}
        title={t("shell.notBuiltTitle")}
        description={t("shell.notBuiltBody")}
      />
    </Page>
  );
}
