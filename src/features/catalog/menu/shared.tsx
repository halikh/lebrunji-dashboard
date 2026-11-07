"use client";

import { CornerDownRight, Layers, List } from "lucide-react";

import { cx } from "@/components/ui";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { itemUnit, pricePerUnit, unitKey } from "@/lib/units";

import type { MenuItem, MenuSection } from "../api/menu";

export { ItemTags, TagChip } from "../tags/tag-chip";

/**
 * Small pieces the Menu tab, the Options tab and the dish page all draw.
 */

/**
 * The size a dish is sold in — "1 kg", "500 g" — or an empty string.
 *
 * A string rather than a component: it sits inside a line that already joins
 * other facts with a separator, and the join should not have to know whether a
 * component rendered anything.
 */
export function unitSize(
  item: Pick<MenuItem, "priceUnit" | "unitQuantity" | "unitStep">,
): string {
  const unit = itemUnit(item);
  if (!unit) return "";
  return t("units.size", {
    quantity: unit.quantity,
    unit: t(unitKey(unit.unit)),
  });
}

/**
 * What a dish comes to per kilo, per litre or per piece — the comparison figure
 * that makes 500 g at $6.00 and 1 kg at $12.00 read as the same value.
 *
 * Nothing for a dish with no unit, and nothing for a single piece, where it
 * would be the same number twice. `pricePerUnit` makes that call.
 */
export function PerUnit({
  item,
  code,
  className,
}: {
  item: Pick<MenuItem, "price" | "priceUnit" | "unitQuantity" | "unitStep">;
  code: string;
  className?: string;
}) {
  const { format } = useMoney();
  const unit = itemUnit(item);
  const per = unit ? pricePerUnit(item.price, unit) : null;
  if (!per || !code) return null;
  return (
    <span className={cx("text-[12px] text-ink-3 tabular-nums", className)}>
      {t("units.per", {
        amount: format(per.amount, code),
        unit: t(unitKey(per.unit)),
      })}
    </span>
  );
}

/** The end of the section a dish is being added to, or moved into. */
export function nextSortOrder(section: MenuSection | undefined): number {
  if (!section) return 0;
  return (
    section.items.reduce(
      (highest, item) => Math.max(highest, item.sortOrder),
      0,
    ) + 1
  );
}

/** The end of one level of the tree — where a new or moved section lands. */
export function nextSectionSort(level: { sortOrder: number }[]): number {
  return level.reduce(
    (highest, one) => Math.max(highest, one.sortOrder + 1),
    0,
  );
}

/** Where the Menu tab lives, and how a dish page sends the operator back. */
export function menuHref(storeId: string, focus?: string) {
  return focus
    ? `/shops/${storeId}?tab=menu&focus=${focus}`
    : `/shops/${storeId}?tab=menu`;
}

export function dishHref(storeId: string, itemId: string) {
  return `/shops/${storeId}/items/${itemId}`;
}

export function newDishHref(storeId: string, sectionId: string) {
  return `/shops/${storeId}/items/new?section=${sectionId}`;
}

/** A new dish filled in from an existing one, in the same section. */
export function duplicateDishHref(
  storeId: string,
  sectionId: string,
  fromId: string,
) {
  return `${newDishHref(storeId, sectionId)}&from=${fromId}`;
}

export function optionsHref(
  storeId: string,
  scope?: { sectionId: string; itemId: string },
) {
  return scope
    ? `/shops/${storeId}?tab=options&section=${scope.sectionId}&item=${scope.itemId}`
    : `/shops/${storeId}?tab=options`;
}

/**
 * Which sections of each shop's menu were opened.
 *
 * Editing a dish is a page of its own, so coming back remounts the tab — and a
 * menu that forgot what had been opened would hand back a different screen than
 * the one left. Module state rather than storage: it is for the round trip to a
 * dish and back, and a reload starting fresh is fine. Per shop, so one shop's
 * choices do not open another's sections.
 *
 * Open rather than folded is what is remembered, because sections start folded
 * (user, 2026-11-07): a supermarket's menu is hundreds of products, and the
 * page should open on its aisles — the outline — with one click into any of
 * them. A search, and a dish returned to, still show what they found.
 */
const opened = new Map<string, Set<string>>();

export function openedSections(storeId: string): Set<string> {
  let set = opened.get(storeId);
  if (!set) {
    set = new Set();
    opened.set(storeId, set);
  }
  return set;
}

/**
 * Which of the three kinds of heading a section is, as the Menu tab and the
 * branch's menu name it.
 *
 * The table has two levels (`parent_id`, 0196), but three kinds of heading:
 *
 * - **aisle** — top level, and a container: it has sub-aisles, or the shop's
 *   layout is Aisles, where a top-level heading only ever holds sub-aisles.
 * - **sub-aisle** — under an aisle; holds dishes.
 * - **section** — top level on a list-layout shop with nothing under it; holds
 *   dishes directly. A restaurant's menu is all sections.
 *
 * A sub-aisle whose aisle is missing is drawn at the top (`menuTree`), so it is
 * named by where it is drawn, not by the column.
 */
export type SectionLevel = "aisle" | "subAisle" | "section";

export function sectionLevel(
  section: Pick<MenuSection, "id" | "parentId">,
  sections: Pick<MenuSection, "id" | "parentId">[],
  layout: "list" | "aisles",
): SectionLevel {
  if (
    section.parentId &&
    sections.some((other) => other.id === section.parentId)
  ) {
    return "subAisle";
  }
  if (layout === "aisles") return "aisle";
  return sections.some((other) => other.parentId === section.id)
    ? "aisle"
    : "section";
}

const LEVEL_LABEL = {
  aisle: "menu.aisleLabel",
  subAisle: "menu.subAisleLabel",
  section: "menu.sectionLabel",
} as const;

export function levelLabel(level: SectionLevel): string {
  return t(LEVEL_LABEL[level]);
}

/**
 * The small tag on a heading that says which level it is — in words and with
 * an icon, so the level never rests on indentation or shade alone. Square
 * corners rather than a pill, so it reads as a kind, not a status.
 */
export function LevelTag({
  level,
  className,
}: {
  level: SectionLevel;
  className?: string;
}) {
  const Icon =
    level === "aisle" ? Layers : level === "subAisle" ? CornerDownRight : List;
  return (
    <span
      className={cx(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] border px-1.5 text-[11.5px] font-medium whitespace-nowrap",
        level === "aisle" && "border-line-strong bg-surface text-ink-2",
        level === "subAisle" && "border-line bg-subtle text-ink-3",
        level === "section" && "border-line bg-hover text-ink-2",
        className,
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0 rtl:-scale-x-100" />
      {levelLabel(level)}
    </span>
  );
}

/** "3 aisles, 12 sub-aisles, 2 sections" — only the levels the menu has. */
export function levelCounts(counts: Record<SectionLevel, number>): string {
  const parts: string[] = [];
  if (counts.aisle > 0) {
    parts.push(
      counts.aisle === 1
        ? t("menu.levelAislesOne")
        : t("menu.levelAisles", { count: counts.aisle }),
    );
  }
  if (counts.subAisle > 0) {
    parts.push(
      counts.subAisle === 1
        ? t("menu.levelSubAislesOne")
        : t("menu.levelSubAisles", { count: counts.subAisle }),
    );
  }
  if (counts.section > 0) {
    parts.push(
      counts.section === 1
        ? t("menu.levelSectionsOne")
        : t("menu.levelSections", { count: counts.section }),
    );
  }
  return parts.join(", ");
}
