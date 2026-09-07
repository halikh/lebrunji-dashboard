"use client";

import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { restatePrice } from "@/lib/money";
import type { Localized } from "@/lib/validation";

import type { CurrencyChangeMode, Store } from "./api/stores";
import { pickLocalized } from "@/i18n/db-text";
import { useCategories } from "./use-categories";
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
  categoryId,
  onCategoryId,
  currencyCode,
  onCurrencyCode,
  isFeatured,
  onIsFeatured,
  exchangeRate,
  onExchangeRate,
  exchangeRateError,
  mode,
  onMode,
}: {
  store: Store;
  name: Localized;
  onName: (value: Localized) => void;
  nameError?: string;
  categoryId: string;
  onCategoryId: (id: string) => void;
  currencyCode: string;
  onCurrencyCode: (code: string) => void;
  isFeatured: boolean;
  onIsFeatured: (on: boolean) => void;
  /** Empty for the platform's rate. A string while it is being typed. */
  exchangeRate: string;
  onExchangeRate: (value: string) => void;
  exchangeRateError?: string;
  mode: CurrencyChangeMode;
  onMode: (mode: CurrencyChangeMode) => void;
}) {
  const { format, currencies } = useMoney();
  /**
   * The platform's own rate, for the placeholder.
   *
   * The non-base row — the base's is 1 by definition, so "the rate" can only
   * mean the other side of the pair. Null while the table is still loading,
   * which leaves the placeholder empty rather than showing a number nobody set.
   */
  const platformRate =
    currencies?.find((one) => !one.isBase)?.rate ?? null;
  // Every category, unfiltered — the same list the shop was filed from when it
  // was created.
  const categories = useCategories("");
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

      {/*
        Which kind of shop this is — and it can be changed now.

        It used to be a wizard-only answer, which made a mis-filing permanent:
        the category decides where the shop appears on Home and what artwork it
        wears, and the only way to correct it was to delete the shop and lose
        the menu with it.

        Nothing is denominated in a category the way prices are in a currency,
        so this is a plain write and needs none of the machinery below it.
      */}
      <Field label={t("store.category")} hint={t("store.categoryHint")}>
        <Select
          value={categoryId}
          onChange={onCategoryId}
          placeholder={t("store.pickCategory")}
          options={(categories.data ?? []).map((category) => ({
            value: category.id,
            label: pickLocalized(category.name),
          }))}
        />
      </Field>

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

      {/*
        Featuring, edited where the shop is edited.

        It was the shops list and nowhere else. That is the right place for it
        — the list is where you compare shops and decide which one leads — but
        being *only* there meant an operator who had opened a shop to change
        three things about it had to save, go back and find the row to change a
        fourth.

        No confirmation dialog here, unlike the list. There the switch acts the
        instant it is flicked, on a live shop, from a column of identical rows,
        which is exactly what the dialog guards. Here nothing happens until
        Save, and the row it belongs to is the panel that is open.

        It is in the shop section rather than the branch one because it is a
        claim about the shop: the app's home screen lists shops, and a card
        resolves the nearest branch afterwards — there is no per-branch home
        screen for a featured branch to lead.
      */}
      <Field
        label={t("store.featured")}
        hint={isFeatured ? t("store.featuredHint") : t("store.featuredHintOff")}
      >
        <Toggle
          on={isFeatured}
          onChange={() => onIsFeatured(!isFeatured)}
          labelOn={t("catalogue.featured")}
          labelOff={t("store.notFeatured")}
        />
      </Field>

      {/*
        What a dollar is worth **at this shop** — `0120`.

        ## Why a shop needs its own

        `currencies.rate` is one number for the whole marketplace, and `0028`
        wrote down why it is set by hand: in this market a rate is a decision
        somebody makes in the morning rather than a quote a market gives. What
        it assumed is that there is *one* such decision. Two shops on the same
        street sell in dollars and quote different lira rates, and a customer
        reading one shop's menu converted at the other's number is reading a
        price that shop would not accept.

        ## Empty is a real answer, and the common one

        It means the platform's rate, and it stays a live reference: a shop left
        alone follows the number on the Pricing screen when that moves. The
        placeholder shows what that number currently is, so leaving the box
        empty is a decision somebody can see the consequence of.

        ## It changes what is shown, not what is charged

        The menu is already priced in this shop's own currency and is charged at
        those figures, so this cannot move a bill. It decides the second
        currency the app writes beside a price. Delivery and fixed-amount
        discounts stay on the platform's rate deliberately — they are the
        marketplace's money, not the shop's, and `0120` says so at length.
      */}
      <Field
        label={t("store.rate")}
        hint={t("store.rateHint")}
        error={exchangeRateError}
      >
        <NumberInput
          value={exchangeRate}
          onChange={(event) => onExchangeRate(event.target.value)}
          min={0}
          step="any"
          placeholder={t("store.ratePlatform", {
            rate: platformRate ? platformRate.toLocaleString("en-GB") : "",
          })}
          aria-label={t("store.rate")}
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
    next: {
      name: Localized;
      categoryId: string;
      currencyCode: string;
      isFeatured: boolean;
      /** Null puts the shop back on the platform's rate. */
      exchangeRate: number | null;
      mode: CurrencyChangeMode;
    },
  ): Promise<boolean> {
    const currencyMoved =
      next.currencyCode !== "" && next.currencyCode !== store.currencyCode;
    // Compared as JSON because these are objects: `===` on two `Localized`
    // values is always false, which would mark the shop changed on every save.
    // The same reasoning `changed()` in `unsaved-changes` records.
    const nameMoved = JSON.stringify(next.name) !== JSON.stringify(store.name);
    const categoryMoved =
      next.categoryId !== "" && next.categoryId !== store.categoryId;
    const featureMoved = next.isFeatured !== store.isFeatured;
    // Null is a value, so this compares rather than checking for truthiness —
    // clearing the box is how a shop goes back to the platform's rate, and a
    // falsy check would refuse to write that.
    const rateMoved = next.exchangeRate !== store.exchangeRate;

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

    // One write for all three, because they are three columns on the same row:
    // separate requests would mean a shop that got renamed and stayed mis-filed
    // when the second failed.
    if (nameMoved || categoryMoved || featureMoved || rateMoved) {
      try {
        await update.mutateAsync({
          id: store.id,
          patch: {
            ...(nameMoved && { name: next.name }),
            ...(categoryMoved && { categoryId: next.categoryId }),
            ...(featureMoved && { isFeatured: next.isFeatured }),
            ...(rateMoved && { exchangeRate: next.exchangeRate }),
          },
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
