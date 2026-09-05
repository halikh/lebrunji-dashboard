"use client";

import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { restatePrice } from "@/lib/money";
import type { Localized } from "@/lib/validation";

import type { CurrencyChangeMode, Store } from "./api/stores";
import { useMenu } from "./use-menu";
import { useSetStoreCurrency, useUpdateStore } from "./use-stores";

/**
 * The answers that belong to the shop rather than to a place it trades from.
 *
 * ## It was a tab, then a card, and is now a section of the branch panel
 *
 * `0101` moved the pin, the prep window, the WhatsApp number and the hours onto
 * the branch that owns them, which left Details holding three fields beside a
 * Branches tab carrying everything else about the same shop. Folding it into a
 * card at the top of Branches removed the tab and kept the split: a form above
 * a list, and nothing in either heading saying which one had the field you
 * wanted.
 *
 * So it is here instead. Opening a branch opens everything about the shop *at*
 * that branch — what it is called, what it prices in, and then what is true of
 * this place in particular. One panel, one Save, read from the brand downward.
 *
 * ## Controlled, and with no Save of its own
 *
 * The state lives in `BranchEditor` because the Save does. Two buttons in one
 * panel — one for the shop and one for the branch — is a panel where pressing
 * the wrong one silently loses half the edit, and the operator has no way to
 * know which half.
 *
 * `useSaveShop` below is the other half of that: the writes this section
 * implies, in the order they have to happen, called by that one Save before it
 * writes the branch.
 */
export function ShopFields({
  store,
  name,
  onName,
  nameError,
  currencyCode,
  onCurrencyCode,
  mode,
  onMode,
}: {
  store: Store;
  name: Localized;
  onName: (value: Localized) => void;
  nameError?: string;
  currencyCode: string;
  onCurrencyCode: (code: string) => void;
  mode: CurrencyChangeMode;
  onMode: (mode: CurrencyChangeMode) => void;
}) {
  const { format, currencies } = useMoney();
  // Only for the worked example below. Cached — the Menu tab has usually
  // already loaded it — and its absence costs nothing: no sample, no warning,
  // which is the right answer for a shop with no menu anyway.
  const menu = useMenu(store.id);

  const currencyMoved =
    currencyCode !== "" && currencyCode !== store.currencyCode;

  /**
   * A real price off this menu under each answer.
   *
   * Null when the currency has not moved, or when the shop has nothing priced —
   * and the second case is the one this feature exists for. A shop created five
   * minutes ago has nothing to misprice, so it gets no question and no friction.
   *
   * `restatePrice` is the same arithmetic `api_v1_set_store_currency` runs, so
   * these figures are what will actually be written. A preview computed any
   * other way would be a promise rather than a preview.
   */
  const sample =
    (menu.data ?? []).flatMap((section) => section.items)[0] ?? null;
  const from = currencies?.find((one) => one.code === store.currencyCode);
  const into = currencies?.find((one) => one.code === currencyCode);

  const preview =
    currencyMoved && sample && from && into
      ? {
          before: format(sample.price, from.code),
          keep: format(
            restatePrice(sample.price, from, into, "keep"),
            into.code,
          ),
          convert: format(
            restatePrice(sample.price, from, into, "convert"),
            into.code,
          ),
        }
      : null;

  return (
    <section className="flex flex-col gap-lg">
      {/* Says whose answers these are, because the panel around it is otherwise
          entirely about one branch. Without the heading, changing the name here
          reads as renaming the branch — and it renames the shop. */}
      <div className="flex flex-col gap-xxs">
        <h3 className="ps-md text-[17px]">{t("branches.shopSection")}</h3>
        <p className="ps-md text-[12px] text-text-faint">
          {t("branches.shopSectionHint")}
        </p>
      </div>

      <LocalizedField
        label={t("store.name")}
        value={name}
        onChange={onName}
        maxLength={TEXT.name}
        hint={t("store.nameHint")}
        error={nameError}
        format="upper"
        placeholder={{ en: "NARA KITCHEN", ar: "مطبخ نارة" }}
      />

      <Field label={t("store.currency")} hint={t("store.currencyEditHint")}>
        <Select
          value={currencyCode}
          onChange={onCurrencyCode}
          placeholder={t("store.pickCurrency")}
          options={(currencies ?? []).map((one) => ({
            value: one.code,
            label: one.code,
          }))}
        />
      </Field>

      {preview && (
        <div className="flex flex-col gap-md rounded-md border border-danger-wash bg-danger-wash/40 px-lg py-lg">
          <p role="status" className="text-[13px] text-text">
            {t("store.currencyMoved", { before: preview.before })}
          </p>

          {/*
            Both answers, each showing what it does to a real price off this
            menu. Describing the difference does not work — "restate the digits"
            and "convert at the rate" are the same sentence to anybody who has
            not thought about minor units. "12 becomes ل.ل12" against "12
            becomes ل.ل1,076,400" needs no explaining at all.
          */}
          <ChoiceOfMode
            checked={mode === "keep"}
            onSelect={() => onMode("keep")}
            label={t("store.currencyKeep")}
            result={t("store.currencyBecomes", {
              before: preview.before,
              after: preview.keep,
            })}
          />
          <ChoiceOfMode
            checked={mode === "convert"}
            onSelect={() => onMode("convert")}
            label={t("store.currencyConvert")}
            result={t("store.currencyBecomes", {
              before: preview.before,
              after: preview.convert,
            })}
          />

          <p className="text-[12px] text-text-faint">
            {t("store.currencyLossy")}
          </p>
        </div>
      )}
    </section>
  );
}

/** One of the two answers, with what it does to a real price. */
function ChoiceOfMode({
  checked,
  onSelect,
  label,
  result,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  result: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-sm text-[13px]">
      <input
        type="radio"
        name="currency-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-[2px] size-[16px] shrink-0 accent-[var(--color-active)]"
      />
      <span className="flex min-w-0 flex-col gap-xxs">
        <span className="font-semibold text-text">{label}</span>
        <span className="tabular-nums text-text-soft">{result}</span>
      </span>
    </label>
  );
}

/**
 * The writes the section above implies, in the order they have to happen.
 *
 * Returns whether the shop is now saved, so the caller knows whether to go on
 * and write the branch.
 *
 * ## Why the currency is its own write, and goes first
 *
 * Two requests rather than one, because they are two different things: the
 * currency rewrites every price in the shop and has to be atomic on its own,
 * while the name is one column on this row. Neither can be folded into the
 * other.
 *
 * It goes first so a failure stops there. The reverse order would leave the
 * shop renamed with its prices in a currency the operator was told had changed
 * — a screen and a database disagreeing about money.
 *
 * ## And why nothing is written when nothing moved
 *
 * This runs on every branch save, including the ones that only moved a pin. The
 * shop is a shared row: writing it unconditionally would mean every branch edit
 * touched the brand, and a "saved" toast about the shop would fire at an
 * operator who never went near those fields.
 */
export function useSaveShop() {
  const update = useUpdateStore();
  const setCurrency = useSetStoreCurrency();

  async function saveShop(
    store: Store,
    next: { name: Localized; currencyCode: string; mode: CurrencyChangeMode },
  ): Promise<boolean> {
    const currencyMoved =
      next.currencyCode !== "" && next.currencyCode !== store.currencyCode;
    // Compared as JSON because these are objects: `===` on two `Localized`
    // values is always false, which would mark the shop changed on every save.
    // The same reasoning `changed()` in `unsaved-changes` records.
    const nameMoved = JSON.stringify(next.name) !== JSON.stringify(store.name);

    if (currencyMoved) {
      try {
        await setCurrency.mutateAsync({
          storeId: store.id,
          currencyCode: next.currencyCode,
          mode: next.mode,
          name: store.name,
        });
      } catch {
        // Already reported by the mutation's own toast. Returning false is what
        // stops the branch being written against a shop whose prices did not
        // move.
        return false;
      }
    }

    if (nameMoved) {
      try {
        await update.mutateAsync({
          id: store.id,
          patch: { name: next.name },
          name: store.name,
        });
      } catch {
        return false;
      }
    }

    return true;
  }

  return {
    saveShop,
    pending: update.isPending || setCurrency.isPending,
  };
}
