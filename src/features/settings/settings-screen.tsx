"use client";

import { useSearchParams } from "next/navigation";

import { Page, PageHeader } from "@/components/ui";
import { t } from "@/i18n/translations";

import { AdvancedTab } from "./advanced-tab";
import { CustomerAppTab } from "./customer-app-tab";
import { GeneralTab } from "./general-tab";
import { HelpTab } from "./help-tab";
import { LegalTab } from "./legal-tab";
import { SETTINGS_ENTRIES, type SettingsEntry } from "./sections";

export type { SettingsTab } from "./sections";

/**
 * Settings — how the business runs, and the writing the app does.
 *
 * One page at a time, the full width. The list of pages is not on this
 * screen: it is the flyout on the sidebar's Settings entry (`SettingsMenu`),
 * opened by hover or click, so every settings page is one gesture away from
 * anywhere. `sections.ts` says what each page holds.
 *
 * Inside a page, each setting is a row that says what it changes beside the
 * control (`SettingRow`), and each saves on its own — see `GeneralTab`.
 *
 * The page is in the URL (`?tab=`) so the editors can come back to the list
 * they were opened from. The flyout's entries are links, so leaving a form
 * through one goes through the unsaved-changes guard like any other link.
 */
export function SettingsScreen() {
  const params = useSearchParams();
  const requested = params.get("tab");
  const current =
    SETTINGS_ENTRIES.find((one) => one.key === requested) ??
    (SETTINGS_ENTRIES[0] as SettingsEntry);
  const tab = current.key;

  return (
    <Page>
      {/* One heading: the page being changed, with Settings as the eyebrow
          above it — not "Settings" and then the page again underneath. */}
      <PageHeader
        eyebrow={t("content.title")}
        title={t(current.labelKey)}
        description={t(current.blurbKey)}
      />

      <div className="flex min-w-0 flex-col gap-6">
        {tab === "general" && <GeneralTab />}
        {tab === "app" && <CustomerAppTab />}
        {tab === "help" && <HelpTab />}
        {tab === "legal" && <LegalTab />}
        {tab === "advanced" && <AdvancedTab />}
      </div>
    </Page>
  );
}
