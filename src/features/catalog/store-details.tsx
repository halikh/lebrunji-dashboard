"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { useLanguages } from "@/features/reference/use-languages";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { restatePrice } from "@/lib/money";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { CurrencyChangeMode, Store } from "./api/stores";
import { useMenu } from "./use-menu";
import { useSetStoreCurrency, useStore, useUpdateStore } from "./use-stores";

/**
 * A shop's own settings, as opposed to what it sells.
 *
 * ## Why this is a tab and not a wizard
 *
 * The flow study called for a wizard on **create** — one decision per step, so
 * nothing important is a field somebody scrolled past — and a tabbed page for
 * editing, because after the first day you come here to change one thing. This
 * is that page. A shop is created a handful of times ever and edited for years.
 *
 * ## The place is not here any more
 *
 * The pin, the prep window and the WhatsApp number moved to the Branches tab
 * with `0101`. All three are facts about an address, and a shop with two
 * addresses cannot answer any of them once. What is left here is the brand:
 * the name, the picture, the category and the currency, which are the same
 * wherever it trades.
 *
 * ## Why it is here at all
 *
 * The wizard asks for it once and nothing showed it again, so a shop's currency
 * was invisible after the day it was created: an operator opening a shop
 * somebody else set up could only infer it from a formatted price, and could
 * not correct a wrong pick at all. Choosing the wrong one is a first-minute
 * mistake, and it had no first-minute fix.
 *
 * ## It saves with the page, and that is the whole point
 *
 * The first version of this gave the currency its own apply button, on the
 * reasoning that it is more consequential than a renamed shop and deserved its
 * own deliberate act. That reasoning was fine and the result was a bug: the
 * page has one large Save at the bottom, so an operator changed the dropdown,
 * pressed Save, watched every other field save, and saw the currency snap back
 * on the refetch. A field that ignores the page's Save button is a field that
 * does not work, however well argued.
 *
 * So there is one Save and it saves everything. The consequence is shown in
 * place instead, live, the moment the value differs.
 *
 * ## Nothing is converted, and the screen says so
 *
 * Prices are minor units in a column with no currency of its own, so this
 * changes what they mean without changing a digit — and across USD and LBP that
 * is a decimal-scale shift as well as a rate. Rather than describing that, the
 * warning shows it: a real price off this menu, rendered both ways. "The scale
 * differs" is a sentence somebody can read and still not believe.
 *
 * No modal, deliberately. It hangs off the page's Save, which also carries
 * unrelated edits, so a dialog would interrupt somebody who only fixed a
 * typo in the name. The change is exactly reversible — no row is rewritten —
 * and the warning is unmissable and sits against the control that caused it.
 */
export function StoreDetails({ storeId }: { storeId: string }) {
  const store = useStore(storeId);

  if (store.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-lg p-xxl">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-[64px] rounded-md border border-border bg-surface opacity-60"
          />
        ))}
      </div>
    );
  }

  if (store.isError || !store.data) {
    return (
      <div className="flex flex-col items-center gap-lg py-huge text-center">
        <div className="flex flex-col gap-xs">
          <h2 className="text-[18px]">{t("catalogue.failedTitle")}</h2>
          <p className="text-[14px] text-text-soft">
            {t("catalogue.failedBody")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void store.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  // Keyed on the row, so arriving at a different shop rebuilds the form rather
  // than leaving the previous one's values in the fields.
  return <Form key={store.data.id} store={store.data} />;
}

function CurrencySection({
  value,
  onChange,
  mode,
  onModeChange,
  preview,
}: {
  value: string;
  onChange: (code: string) => void;
  mode: CurrencyChangeMode;
  onModeChange: (mode: CurrencyChangeMode) => void;
  /**
   * A real price off this menu under each answer, or null when there is nothing
   * to restate — a shop with no dishes, or a currency that has not moved.
   */
  preview: { before: string; keep: string; convert: string } | null;
}) {
  const { currencies } = useMoney();

  return (
    <section className="flex flex-col gap-lg">
      <h2 className="ps-md text-[17px]">{t("store.currencyTitle")}</h2>

      <Field label={t("store.currency")} hint={t("store.currencyEditHint")}>
        <Select
          value={value}
          onChange={onChange}
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
            onSelect={() => onModeChange("keep")}
            label={t("store.currencyKeep")}
            result={t("store.currencyBecomes", {
              before: preview.before,
              after: preview.keep,
            })}
          />
          <ChoiceOfMode
            checked={mode === "convert"}
            onSelect={() => onModeChange("convert")}
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

function Form({ store }: { store: Store }) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const update = useUpdateStore();
  const setCurrency = useSetStoreCurrency();
  const { format, currencies } = useMoney();
  // Only for the worked example below. Cached — the Menu tab has usually
  // already loaded it — and its absence costs nothing: no sample, no warning,
  // which is the right answer for a shop with no menu anyway.
  const menu = useMenu(store.id);

  const [name, setName] = useState<Localized>(store.name);
  const [currencyCode, setCurrencyCode] = useState(store.currencyCode);
  /**
   * What the change is *for*, defaulted to the common case.
   *
   * `keep` is the wrong-pick fix and is what almost every change here will be.
   * `convert` is a shop genuinely re-denominating, which happens once if ever —
   * so it is the deliberate choice rather than the one you land on.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");
  const [imageUrl, setImageUrl] = useState<string | null>(store.imageUrl);

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `currencyCode` first — which is compared.
  useUnsavedChanges(
    changed(
      { name, currencyCode, imageUrl },
      {
        name: store.name,
        currencyCode: store.currencyCode,
        imageUrl: store.imageUrl,
      },
    ),
  );

  const [errors, setErrors] = useState<{
    name?: string;
  }>({});

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

  async function save() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
    };

    setErrors(found);
    if (found.name) return;

    /*
     * The currency first, and only if it moved.
     *
     * Two writes rather than one, because they are two different things: the
     * currency rewrites every price in the shop and has to be atomic on its
     * own, while the rest is a handful of columns on this row. Neither can be
     * folded into the other.
     *
     * It goes first so a failure stops here. The reverse order would leave the
     * shop renamed and its prices in a currency the operator was told had
     * changed — a screen and a database disagreeing about money.
     */
    if (currencyMoved) {
      try {
        await setCurrency.mutateAsync({
          storeId: store.id,
          currencyCode,
          mode,
          name: store.name,
        });
      } catch {
        // Already reported by the mutation's own toast. Returning here is what
        // stops the rest of the save from running on a shop whose prices did
        // not move.
        return;
      }
    }

    update.mutate({
      id: store.id,
      patch: {
        name,
        imageUrl,
      },
      name: store.name,
    });
  }

  return (
    // `h-full`, not `flex-1`.
    //
    // `flex-1` only means anything inside a flex container, and the tab wrapper
    // around this is an ordinary block — so the pane grew to fit its content
    // and pushed the Save row off the bottom of the screen, which is the one
    // place it must never be.
    <div className="flex h-full min-h-0 flex-col">
      {/*
        Two columns from `lg`, and the split is by what each thing *wants*, not
        by cutting the form in half.

        In one column this page was a 560px strip of fields with half a screen
        of nothing beside it. The fix is not to stretch the inputs into that
        space — a text field a thousand pixels wide is harder to read and to
        aim at, and a name is a short answer whatever the monitor is. It is to
        put something in the right column that is genuinely better for being
        large.

        The map is that thing. It is the only part of this page where more
        pixels mean more information — a pin you can actually place a street
        from — and it is also the part that costs money to get wrong.

        So: what the shop *is* on the left, where it *is* on the right.
      */}
      {/* One scrollbar, for the page.

          The columns used to scroll independently — the fields in their own
          box, the map fixed beside them — on the reasoning that a map you have
          to scroll is a map you cannot read at a glance. That is true of the
          map and it was bought at the wrong price: an inner scrollbar in the
          middle of a page is a second thing to find and a second thing to
          reach the end of, and the wheel does nothing once the pointer strays
          out of it. The form got longer, and the seam started showing.

          So the page scrolls and the map stays put by being **sticky** instead
          — same effect while there is room, no second scrollbar, and it
          releases naturally when the fields run past it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
        {/* The padding is on the scrolling column, not on the box around it.
            A scroll container clips what leaves it, and the focus ring is a
            box-shadow drawn a few pixels *outside* the input — so with the
            padding one level up, the ring on the first field was sliced down
            its left edge. Inside the scroller there is room for it. */}
        <div className="flex flex-col gap-xxl p-xxl lg:w-[540px] lg:shrink-0">
          <section className="flex flex-col gap-lg">
            <LocalizedField
              label={t("store.name")}
              value={name}
              onChange={setName}
              maxLength={TEXT.name}
              hint={t("store.nameHint")}
              error={errors.name}
              placeholder={{ en: "Nara Kitchen", ar: "مطبخ نارة" }}
            />

            <Field label={t("images.label")} hint={t("store.imageHint")}>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                folder="stores"
                disabled={update.isPending}
              />
            </Field>
          </section>

          <CurrencySection
            value={currencyCode}
            onChange={setCurrencyCode}
            mode={mode}
            onModeChange={setMode}
            preview={preview}
          />
        </div>
      </div>

      {/* Pinned, like the item editor's. On a form this long the operator
          should never have to scroll to find Save. */}
      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button
          onClick={() => void save()}
          pending={update.isPending || setCurrency.isPending}
        >
          {t("store.save")}
        </Button>
      </div>
    </div>
  );
}
