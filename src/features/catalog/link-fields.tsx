"use client";

import { Field } from "@/components/ui/field";
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
} from "./api/links";
import { useCategories } from "./use-categories";
import { useStores } from "./use-stores";

/**
 * "When tapped, go to" — the destination a promotion or an artwork leads to.
 *
 * Two fields, because it is two questions and the second depends on the
 * first: what *kind* of place, then which one. The second is a searchable
 * shop picker, a category picker or a page list, and is absent for Nowhere.
 *
 * The form keeps every half-chosen answer (switching from A shop to A
 * category and back keeps the shop), and `linkColumns` writes only what the
 * final kind uses — see `api/links.ts`.
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
  /** Shown under the target field — "choose a shop", say. */
  error?: string;
  /** Replaces the kind field's own hint — the artwork's "follows its promotion". */
  hint?: string;
}) {
  const stores = useStores("");
  const categories = useCategories("");

  const kindOptions = [
    { value: "", label: t("links.kinds.none") },
    ...LINK_KINDS.map((kind) => ({
      value: kind,
      label: t(`links.kinds.${kind}`),
    })),
  ];

  return (
    <>
      <Field label={t("links.label")} hint={hint ?? t("links.hint")}>
        <Select
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
      </Field>

      {value.kind === "store" && (
        <Field label={t("links.store")} error={error}>
          <Select
            value={value.storeId ?? ""}
            onChange={(next) => onChange({ ...value, storeId: next || null })}
            placeholder={t("links.pickStore")}
            options={(stores.data?.stores ?? []).map((store) => ({
              value: store.id,
              label: pickLocalized(store.name),
            }))}
            disabled={disabled || !stores.isSuccess}
          />
        </Field>
      )}

      {value.kind === "category" && (
        <Field label={t("links.category")} error={error}>
          <Select
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
        </Field>
      )}

      {(value.kind === "tab" || value.kind === "page") && (
        <Field label={t("links.page")} error={error}>
          <Select
            value={value.page ?? ""}
            onChange={(next) =>
              onChange({ ...value, page: (next || null) as LinkPage | null })
            }
            placeholder={t("links.pickPage")}
            options={pagesFor(value.kind).map((page) => ({
              value: page,
              label: t(`links.pages.${page}`),
            }))}
            disabled={disabled}
          />
        </Field>
      )}
    </>
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
