import type { TranslationKey } from "@/i18n/translations";

/**
 * The sections, declared once.
 *
 * The rail renders this, and the command palette will search it. Two lists
 * would drift the first time a section was added — and the one that drifted
 * would be the palette, because nobody notices a missing entry in a search box.
 */
export type Section = {
  href: string;
  labelKey: TranslationKey;
  /** Which phase of the plan builds it. `null` means it is here now. */
  phase: number | null;
  icon: IconName;
};

export type IconName =
  | "orders"
  | "catalogue"
  | "pricing"
  | "customers"
  | "drivers"
  | "reports"
  | "settings"
  | "sign-out";

export const SECTIONS: readonly Section[] = [
  // The queue is first and is home: signing in lands on live orders, not on a
  // statistics page. Statistics are something you go and look at; orders are
  // something that happens to you.
  { href: "/", labelKey: "nav.orders", phase: null, icon: "orders" },
  {
    href: "/catalogue",
    labelKey: "nav.catalogue",
    phase: null,
    icon: "catalogue",
  },
  { href: "/pricing", labelKey: "nav.pricing", phase: 5, icon: "pricing" },
  {
    href: "/customers",
    labelKey: "nav.customers",
    phase: 6,
    icon: "customers",
  },
  // Beside customers rather than under settings, because it is the same kind of
  // thing: a list of people, searched by name or number, each with a page. It
  // started as a settings tab and outgrew it the moment a driver had a history
  // worth reading.
  { href: "/drivers", labelKey: "nav.drivers", phase: null, icon: "drivers" },
  { href: "/reports", labelKey: "nav.reports", phase: 6, icon: "reports" },
  { href: "/settings", labelKey: "nav.settings", phase: 7, icon: "settings" },
];

/**
 * Which section a path belongs to.
 *
 * Longest match wins, so `/catalogue/menu-items` marks Catalogue rather than
 * falling back to `/`. Exported so the palette and the rail agree about what
 * "here" means.
 */
export function activeSection(pathname: string): Section | undefined {
  return SECTIONS.filter((section) =>
    section.href === "/"
      ? pathname === "/"
      : pathname === section.href || pathname.startsWith(`${section.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
