import {
  BarChart3,
  Bike,
  ClipboardList,
  FolderTree,
  Gift,
  Image as ImageIcon,
  ListChecks,
  type LucideIcon,
  Archive,
  Percent,
  Settings,
  Store,
  Tags,
  Truck,
  Users,
} from "lucide-react";

import type { TranslationKey } from "@/i18n/translations";

/**
 * Every section, declared once. The sidebar renders it, the command palette
 * searches it, and the top bar reads the current section's name from it.
 */
export type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Extra words the command palette should match on. */
  keywords?: string;
};

export type NavGroup = { labelKey: TranslationKey; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    labelKey: "shell.groupOperate",
    items: [
      {
        href: "/orders",
        labelKey: "nav.orders",
        icon: ClipboardList,
        keywords: "queue live home today",
      },
      {
        href: "/todo",
        labelKey: "nav.todo",
        icon: ListChecks,
        keywords: "missing tasks",
      },
    ],
  },
  {
    labelKey: "shell.groupCatalogue",
    items: [
      {
        href: "/shops",
        labelKey: "shell.shops",
        icon: Store,
        keywords: "stores restaurants menu branches hours",
      },
      { href: "/categories", labelKey: "categories.tab", icon: FolderTree },
      { href: "/tags", labelKey: "tags.tab", icon: Tags },
      {
        href: "/artworks",
        labelKey: "artworks.tab",
        icon: ImageIcon,
        keywords: "pictures images",
      },
      {
        href: "/archive",
        labelKey: "archive.tab",
        icon: Archive,
        keywords: "restore deleted",
      },
    ],
  },
  {
    labelKey: "shell.groupMarketing",
    items: [
      {
        href: "/promotions",
        labelKey: "promotions.tab",
        icon: Percent,
        keywords: "discounts offers",
      },
      {
        href: "/bundles",
        labelKey: "bundles.tab",
        icon: Gift,
        keywords: "combos deals",
      },
    ],
  },
  {
    labelKey: "shell.groupPeople",
    items: [
      { href: "/customers", labelKey: "nav.customers", icon: Users },
      {
        href: "/drivers",
        labelKey: "nav.drivers",
        icon: Bike,
        keywords: "couriers riders",
      },
    ],
  },
  {
    labelKey: "shell.groupBusiness",
    items: [
      {
        href: "/pricing",
        labelKey: "nav.pricing",
        icon: Truck,
        keywords: "delivery fees bands",
      },
      {
        href: "/reports",
        labelKey: "nav.reports",
        icon: BarChart3,
        keywords: "stats sales export",
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  labelKey: "nav.settings",
  icon: Settings,
  keywords: "help legal general app",
};

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV.flatMap((group) => group.items),
  SETTINGS_ITEM,
];

/** The section a path belongs to. Longest match wins. */
export function activeItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter((item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
