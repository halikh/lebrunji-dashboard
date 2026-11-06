"use client";

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
 * Which sections of each shop's menu were folded.
 *
 * Editing a dish is a page of its own, so coming back remounts the tab — and a
 * menu that forgot what had been folded would hand back a different screen than
 * the one left. Module state rather than storage: it is for the round trip to a
 * dish and back, and a reload starting fresh is fine. Per shop, so one shop's
 * choices do not fold another's sections.
 *
 * Folded rather than open is what is remembered, because sections start open:
 * the most common job — a price, a dish off — should be on screen, not a click
 * away.
 */
const folded = new Map<string, Set<string>>();

export function foldedSections(storeId: string): Set<string> {
  let set = folded.get(storeId);
  if (!set) {
    set = new Set();
    folded.set(storeId, set);
  }
  return set;
}
