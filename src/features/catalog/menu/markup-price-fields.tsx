"use client";

import { useState } from "react";

import { Field } from "@/components/ui";
import { MoneyInput } from "@/components/ui/money-input";
import { t } from "@/i18n/translations";

import {
  combinePrice,
  splitPrice,
  type Combined,
  type MarkupEntry,
} from "../api/markup-price";

/**
 * A markup price as a form holds it — the dish editor, a choice, a bundle.
 *
 * The two boxes start from what was saved (`splitPrice`), and stay that way
 * until somebody types: the store price is read in its own query, which may
 * land after the form opened, so an untouched form follows it rather than
 * freezing an empty one.
 *
 * `price` is the plain price box's value, which counts only off markup. On
 * markup the two boxes are the price (user, 2026-11-08): there is no third.
 */
export function useMarkupPrice({
  active,
  price,
  savedPrice,
  savedStorePrice,
}: {
  /** The shop or a branch is on markup; off, nothing here applies. */
  active: boolean;
  price: number | null;
  /** The app price as saved — what `savedStorePrice` was split against. */
  savedPrice: number | null;
  savedStorePrice: number | null;
}) {
  const [draft, setDraft] = useState<MarkupEntry | undefined>(undefined);
  const start = splitPrice(savedPrice, savedStorePrice);
  const entry = draft ?? start;
  const combined: Combined = active ? combinePrice(entry) : { kind: "plain" };

  /** What customers will pay: the sum on a split, the plain box otherwise. */
  const sellPrice = combined.kind === "split" ? combined.price : price;
  /** The store price to save: the shop's price, or none on a plain price. */
  const nextStorePrice =
    combined.kind === "split"
      ? combined.storePrice
      : combined.kind === "plain"
        ? null
        : savedStorePrice;
  const storePriceMoved = active && nextStorePrice !== savedStorePrice;

  return {
    entry,
    setEntry: setDraft,
    combined,
    sellPrice,
    storePriceMoved,
    nextStorePrice,
    /** Off markup: the plain price box is the one that counts. */
    plain: !active,
    /** A sentence for the boxes, or nothing. */
    problem: combined.kind === "invalid" ? t(combined.problem) : undefined,
    /** Moved from what was saved — for the form's dirty check. */
    moved:
      active &&
      draft !== undefined &&
      (draft.shopPrice !== start.shopPrice || draft.markup !== start.markup),
  };
}

/**
 * "Price from the shop" and "Our markup", side by side, then what the
 * customer pays, worked out. The two boxes are the whole price.
 */
export function MarkupPriceFields({
  entry,
  onChange,
  decimals,
  appPrice,
  error,
  disabled,
}: {
  entry: MarkupEntry;
  onChange: (entry: MarkupEntry) => void;
  decimals: number | null;
  /** The price in the app, formatted; null while the currency is unknown. */
  appPrice: string | null;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={t("earnings.shopPrice")}
          hint={t("earnings.shopPriceHint")}
          error={error}
        >
          {(field) => (
            <MoneyInput
              {...field}
              value={entry.shopPrice}
              onChange={(shopPrice) => onChange({ ...entry, shopPrice })}
              decimalDigits={decimals}
              disabled={disabled}
              placeholder={t("earnings.shopPricePlaceholder")}
            />
          )}
        </Field>
        <Field
          label={t("earnings.markupAmount")}
          hint={t("earnings.markupAmountHint")}
        >
          {(field) => (
            <MoneyInput
              {...field}
              value={entry.markup}
              onChange={(markup) => onChange({ ...entry, markup })}
              decimalDigits={decimals}
              disabled={disabled}
              placeholder={t("earnings.markupPlaceholder")}
              // Below zero is typed and refused with a reason, not swallowed.
              min={-1_000_000_000}
              invalid={entry.markup !== null && entry.markup < 0}
            />
          )}
        </Field>
      </div>
      {appPrice && (
        <p className="text-[12.5px] text-ink-3 tabular-nums">
          {t("earnings.appPrice", { price: appPrice })}
        </p>
      )}
    </div>
  );
}
