import { t } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import type { ScopeType } from "../api/promotions";

/*
 * A promotion in one plain sentence — "Free delivery on orders over $20 from
 * Forno or Moody Burger, first order only, 1 Nov to 30 Nov. Up to 2 times per
 * customer."
 *
 * The settings are individually clear and jointly hard to hold in your head;
 * four numbers whose combined effect nobody should have to simulate. The list
 * and the editor both read this, so the sentence an operator checks while
 * editing is the one they scan for later.
 *
 * Every promotion here is free delivery: discounts apply on their own when a
 * basket qualifies, with no code to type.
 */

export type PromotionTerms = {
  /** Minor units of the base currency, already formatted by the caller. */
  minimum: string | null;
  firstOrderOnly: boolean;
  scopeType: ScopeType | "mixed";
  /** Names of what it is narrowed to, as many as are known. */
  targets: string[];
  /** How many it is narrowed to — may exceed `targets` when names are not loaded. */
  targetCount: number;
  startsAt: string | null;
  endsAt: string | null;
  perUser: number | null;
  total: number | null;
};

export function describeTerms(terms: PromotionTerms): string {
  const clauses: string[] = [t("promotions.summary.freeDelivery")];

  clauses.push(
    terms.minimum
      ? t("promotions.summary.over", { amount: terms.minimum })
      : t("promotions.summary.everyOrder"),
  );

  const names = joinNames(terms.targets, terms.targetCount);
  if (terms.scopeType === "store" && names) {
    clauses.push(t("promotions.summary.fromShops", { names }));
  } else if (terms.scopeType === "category" && names) {
    clauses.push(t("promotions.summary.inCategories", { names }));
  } else if (terms.scopeType === "menuItem" && names) {
    clauses.push(t("promotions.summary.withItems", { names }));
  } else if (terms.scopeType === "mixed") {
    clauses.push(t("promotions.summary.mixed"));
  }

  let sentence = clauses.join(" ");
  if (terms.firstOrderOnly) {
    sentence += t("promotions.summary.firstOrder");
  }

  const dates = describeTermsDates(terms.startsAt, terms.endsAt);
  if (dates) sentence += t("promotions.summary.dates", { dates });
  sentence += ".";

  const limits: string[] = [];
  if (terms.perUser) {
    limits.push(t("promotions.summary.perUser", { count: terms.perUser }));
  }
  if (terms.total) {
    limits.push(t("promotions.summary.total", { count: terms.total }));
  }
  if (limits.length > 0) {
    sentence += ` ${t("promotions.summary.limits", { limits: limits.join(t("promotions.summary.and")) })}`;
  }
  return sentence;
}

function describeTermsDates(
  startsAt: string | null,
  endsAt: string | null,
): string | null {
  if (startsAt && endsAt) {
    return t("promotions.between", {
      from: formatDate(startsAt),
      to: formatDate(endsAt),
    });
  }
  if (endsAt) return t("promotions.summary.until", { to: formatDate(endsAt) });
  if (startsAt) {
    return t("promotions.summary.starting", { from: formatDate(startsAt) });
  }
  return null;
}

/** "Forno", "Forno or Moody Burger", "Forno, Moody Burger and 3 more". */
export function joinNames(names: string[], count: number): string | null {
  if (count === 0) return null;
  if (names.length === 0) return t("promotions.summary.count", { count });
  if (names.length === 1 && count === 1) return names[0];
  if (count === 2 && names.length === 2) {
    return t("promotions.summary.either", { a: names[0], b: names[1] });
  }
  const shown = names.slice(0, 2);
  return t("promotions.summary.andMore", {
    names: shown.join(", "),
    count: count - shown.length,
  });
}

/**
 * The same terms as a list, one condition a line — the "Details" of
 * Shopify's discount summary card. The sentence is for scanning a list; this
 * is for checking a form, where the eye goes condition by condition.
 */
export function describeTermsList(terms: PromotionTerms): string[] {
  const lines: string[] = [
    terms.minimum
      ? t("promotions.details.over", { amount: terms.minimum })
      : t("promotions.details.everyOrder"),
  ];

  const names = joinNames(terms.targets, terms.targetCount);
  if (terms.scopeType === "store") {
    lines.push(
      names
        ? t("promotions.details.fromShops", { names })
        : t("promotions.details.noShops"),
    );
  } else if (terms.scopeType === "category") {
    lines.push(
      names
        ? t("promotions.details.inCategories", { names })
        : t("promotions.details.noCategories"),
    );
  } else if (terms.scopeType === "menuItem") {
    lines.push(
      names
        ? t("promotions.details.withItems", { names })
        : t("promotions.details.noItems"),
    );
  } else if (terms.scopeType === "mixed") {
    lines.push(t("promotions.details.mixed"));
  } else {
    lines.push(t("promotions.details.anyShop"));
  }

  lines.push(
    terms.firstOrderOnly
      ? t("promotions.details.firstOrder")
      : t("promotions.details.anyone"),
  );

  const dates = describeTermsDates(terms.startsAt, terms.endsAt);
  lines.push(
    dates
      ? t("promotions.details.dates", { dates })
      : t("promotions.details.noDates"),
  );

  if (terms.total) {
    lines.push(t("promotions.details.total", { count: terms.total }));
  }
  if (terms.perUser) {
    lines.push(t("promotions.details.perUser", { count: terms.perUser }));
  }
  if (!terms.total && !terms.perUser) {
    lines.push(t("promotions.details.noLimits"));
  }
  return lines;
}
