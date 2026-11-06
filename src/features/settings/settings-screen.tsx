"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CircleHelp,
  Clock,
  FileText,
  HardDrive,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import { Page, PageHeader, Tabs, cx } from "@/components/ui";
import { useConfirmLeave } from "@/components/unsaved-changes";
import { t, type TranslationKey } from "@/i18n/translations";

import { AdvancedTab } from "./advanced-tab";
import { CustomerAppTab } from "./customer-app-tab";
import { GeneralTab } from "./general-tab";
import { HelpTab } from "./help-tab";
import { LegalTab } from "./legal-tab";

/**
 * Settings — how the business runs, and the writing the app does.
 *
 * ## Laid out the way Linear and Stripe lay out settings
 *
 * A short list of pages down the side, grouped by what they are about, and
 * one page at a time beside it. The list is always in view on a desk, so the
 * operator sees every place a setting can live without opening each one; on
 * a phone it folds into tabs across the top.
 *
 * Inside a page, each setting is a row that says what it changes beside the
 * control (`SettingRow`), and each saves on its own — see `GeneralTab`.
 *
 * - **General**: the clock, the time zone, the ordering hours and the
 *   new-order sound. First, because it is what a shop comes back to change.
 * - **Customer app**: the oldest app version still served and where its
 *   Update button goes. Its own page because a careless change locks
 *   customers out.
 * - **Help topics** and **Legal**: the app's prose (`0016` moved it into the
 *   database precisely so it could be edited here).
 * - **Advanced**: clearing unused pictures out of storage.
 *
 * The page is in the URL (`?tab=`, replaced rather than pushed) so the editors
 * can come back to the list they were opened from. Switching unmounts the
 * current page, so it is a way out of a form: it goes through `confirmLeave`.
 */

export type SettingsTab = "general" | "app" | "help" | "legal" | "advanced";

type Entry = {
  key: SettingsTab;
  labelKey: TranslationKey;
  blurbKey: TranslationKey;
  icon: LucideIcon;
};

const GROUPS: { labelKey: TranslationKey; entries: Entry[] }[] = [
  {
    labelKey: "content.navBusiness",
    entries: [
      {
        key: "general",
        labelKey: "general.tab",
        blurbKey: "general.pageBlurb",
        icon: Clock,
      },
      {
        key: "app",
        labelKey: "general.tabCustomerApp",
        blurbKey: "general.customerAppBlurb",
        icon: Smartphone,
      },
    ],
  },
  {
    labelKey: "content.navAppText",
    entries: [
      {
        key: "help",
        labelKey: "content.tabHelpTopics",
        blurbKey: "content.helpBlurb",
        icon: CircleHelp,
      },
      {
        key: "legal",
        labelKey: "content.tabLegal",
        blurbKey: "content.legalBlurb",
        icon: FileText,
      },
    ],
  },
  {
    labelKey: "content.navSystem",
    entries: [
      {
        key: "advanced",
        labelKey: "content.tabAdvanced",
        blurbKey: "content.advancedBlurb",
        icon: HardDrive,
      },
    ],
  },
];

const ENTRIES = GROUPS.flatMap((group) => group.entries);

export function SettingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirmLeave = useConfirmLeave();

  const requested = params.get("tab");
  const current =
    ENTRIES.find((one) => one.key === requested) ?? (ENTRIES[0] as Entry);
  const tab = current.key;

  function show(next: SettingsTab) {
    if (next === tab) return;
    void confirmLeave().then((leave) => {
      if (!leave) return;
      // Only the tab survives a switch: `doc` and `focus` belong to the page
      // being left.
      const query = new URLSearchParams();
      if (next !== "general") query.set("tab", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <Page>
      <PageHeader title={t("content.title")} description={t("content.blurb")} />

      {/* Phones and tablets: the same pages as tabs across the top. */}
      <Tabs
        className="lg:hidden"
        value={tab}
        onChange={show}
        items={ENTRIES.map(({ key, labelKey }) => ({
          key,
          label: t(labelKey),
        }))}
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={t("content.title")}
          className="sticky top-0 hidden flex-col gap-5 lg:flex"
        >
          {GROUPS.map((group) => (
            <div key={group.labelKey} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 text-[12px] font-medium text-ink-4">
                {t(group.labelKey)}
              </p>
              {group.entries.map((entry) => {
                const active = entry.key === tab;
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => show(entry.key)}
                    className={cx(
                      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-start text-[13.5px] font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent-ink"
                        : "text-ink-2 hover:bg-hover hover:text-ink",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cx(
                        "size-4 shrink-0",
                        active ? "text-accent" : "text-ink-4",
                      )}
                    />
                    {t(entry.labelKey)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {/* The page's own heading, so what is being changed is named above
              the controls rather than only in the menu beside them. The lists
              below it carry no second description. */}
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-semibold text-ink">
              {t(current.labelKey)}
            </h2>
            <p className="max-w-2xl text-[13.5px] text-ink-3">
              {t(current.blurbKey)}
            </p>
          </div>

          {tab === "general" && <GeneralTab />}
          {tab === "app" && <CustomerAppTab />}
          {tab === "help" && <HelpTab />}
          {tab === "legal" && <LegalTab />}
          {tab === "advanced" && <AdvancedTab />}
        </div>
      </div>
    </Page>
  );
}
