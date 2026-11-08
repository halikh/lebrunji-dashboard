import {
  CircleHelp,
  Clock,
  FileText,
  HardDrive,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import type { TranslationKey } from "@/i18n/translations";

/**
 * The pages of Settings, grouped by what they are about. Declared once: the
 * sidebar's Settings flyout lists them, and the settings screen reads the
 * current one's name and blurb from here.
 *
 * - **General**: the clock, the time zone, the ordering hours and the
 *   new-order sound. First, because it is what a shop comes back to change.
 * - **Customer app**: the oldest app version still served and where its
 *   Update button goes. Its own page because a careless change locks
 *   customers out.
 * - **Help topics** and **Legal**: the app's prose (`0016` moved it into the
 *   database precisely so it could be edited here).
 * - **Advanced**: clearing unused pictures out of storage.
 */

export type SettingsTab = "general" | "app" | "help" | "legal" | "advanced";

export type SettingsEntry = {
  key: SettingsTab;
  labelKey: TranslationKey;
  blurbKey: TranslationKey;
  icon: LucideIcon;
};

export const SETTINGS_GROUPS: {
  labelKey: TranslationKey;
  entries: SettingsEntry[];
}[] = [
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

export const SETTINGS_ENTRIES = SETTINGS_GROUPS.flatMap(
  (group) => group.entries,
);

/** Where a settings page lives. General is the bare `/settings`. */
export function settingsHref(key: SettingsTab): string {
  return key === "general" ? "/settings" : `/settings?tab=${key}`;
}

/**
 * The page a location belongs to, or null outside Settings. A help topic's or
 * a legal section's editor (`/settings/help/…`) belongs to its list.
 */
export function settingsTabAt(
  pathname: string,
  tab: string | null,
): SettingsTab | null {
  if (pathname === "/settings") {
    return SETTINGS_ENTRIES.find((one) => one.key === tab)?.key ?? "general";
  }
  if (pathname.startsWith("/settings/help")) return "help";
  if (pathname.startsWith("/settings/legal")) return "legal";
  return null;
}
