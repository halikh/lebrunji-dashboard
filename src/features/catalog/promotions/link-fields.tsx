"use client";

import { Field } from "@/components/ui";
import { Select } from "@/components/ui/select";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import {
  LINK_KINDS,
  OTHER_PAGES,
  TAB_PAGES,
  normalise,
  type LinkKind,
  type LinkPage,
  type TapLink,
} from "../api/links";
import { ShopSelect } from "../shops/shop-select";
import { useCategories } from "../use-categories";
import { useStores } from "../use-stores";

/**
 * "When tapped, go to" — where a promotion's or an artwork's picture leads.
 *
 * Two questions, the second depending on the first: what *kind* of place, then
 * which one. The form keeps every half-chosen answer (switching from A shop to
 * A category and back keeps the shop); `linkColumns` writes only what the final
 * kind uses — see `api/links.ts`.
 */
export function LinkFields({
  value,
  onChange,
  disabled = false,
  error,
  hint,
}: {
  value: TapLink;
  onChange: (next: TapLink) => void;
  disabled?: boolean;
  /** Under the target field — "choose a shop". */
  error?: string;
  /** Replaces the kind field's own hint — an artwork's "follows its promotion". */
  hint?: string;
}) {
  const categories = useCategories("");

  const kindOptions = [
    { value: "", label: t("links.kinds.none") },
    ...LINK_KINDS.map((kind) => ({
      value: kind,
      label: t(`links.kinds.${kind}`),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("links.label")} hint={hint ?? t("links.hint")}>
        {(wiring) => (
          <Select
            {...wiring}
            value={value.kind ?? ""}
            onChange={(next) =>
              onChange({
                ...value,
                kind: next === "" ? null : (next as LinkKind),
                // A page chosen for one list is not on the other, so moving
                // between a tab and another page starts the page afresh.
                page:
                  next === "tab" || next === "page"
                    ? pagesFor(next).includes(value.page as LinkPage)
                      ? value.page
                      : null
                    : value.page,
              })
            }
            options={kindOptions}
            disabled={disabled}
          />
        )}
      </Field>

      {value.kind === "store" && (
        <Field label={t("links.store")} error={error}>
          {(wiring) => (
            <ShopSelect
              {...wiring}
              value={value.storeId ?? ""}
              onChange={(next) => onChange({ ...value, storeId: next || null })}
              placeholder={t("links.pickStore")}
              disabled={disabled}
            />
          )}
        </Field>
      )}

      {value.kind === "category" && (
        <Field label={t("links.category")} error={error}>
          {(wiring) => (
            <Select
              {...wiring}
              value={value.categoryId ?? ""}
              onChange={(next) =>
                onChange({ ...value, categoryId: next || null })
              }
              placeholder={t("links.pickCategory")}
              options={(categories.data ?? []).map((category) => ({
                value: category.id,
                label: pickLocalized(category.name),
              }))}
              disabled={disabled || !categories.isSuccess}
            />
          )}
        </Field>
      )}

      {(value.kind === "tab" || value.kind === "page") && (
        <Field label={t("links.page")} error={error}>
          {(wiring) => (
            <Select
              {...wiring}
              value={value.page ?? ""}
              onChange={(next) =>
                onChange({ ...value, page: (next || null) as LinkPage | null })
              }
              placeholder={t("links.pickPage")}
              options={pagesFor(value.kind as "tab" | "page").map((page) => ({
                value: page,
                label: t(`links.pages.${page}`),
              }))}
              disabled={disabled}
            />
          )}
        </Field>
      )}
    </div>
  );
}

function pagesFor(kind: "tab" | "page"): readonly LinkPage[] {
  return kind === "tab" ? TAB_PAGES : OTHER_PAGES;
}

/**
 * A destination in words — "Moody Burger's page", "Checkout" — for the hint
 * that says what an artwork inherits from its promotion.
 */
export function useLinkDescription(link: TapLink): string {
  const stores = useStores("");
  const categories = useCategories("");
  const tidy = normalise(link);

  switch (tidy.kind) {
    case "store": {
      const store = stores.data?.stores.find((one) => one.id === tidy.storeId);
      return t("links.toStore", {
        name: store ? pickLocalized(store.name) : "…",
      });
    }
    case "category": {
      const category = categories.data?.find(
        (one) => one.id === tidy.categoryId,
      );
      return t("links.toCategory", {
        name: category ? pickLocalized(category.name) : "…",
      });
    }
    case "tab":
    case "page":
      return t(`links.pages.${tidy.page as LinkPage}`);
    default:
      return t("links.kinds.none");
  }
}
