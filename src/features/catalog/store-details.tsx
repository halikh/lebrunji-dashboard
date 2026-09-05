"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { digitsOf } from "@/lib/phone";
import { useLanguages } from "@/features/reference/use-languages";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import { restatePrice } from "@/lib/money";
import {
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

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
 * ## The pin is the one that costs money
 *
 * `latitude` and `longitude` are null until somebody sets them, and that is not
 * cosmetic. With no pin `delivery_quote` cannot work out a distance, and
 * `delivery_fee_for_km` charges an unknown distance at the **top band** — so an
 * unpinned shop quietly overcharges every customer it has, and nobody finds out
 * from this screen. It says so, in place, rather than leaving it to be
 * discovered on somebody's bill.
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

/**
 * What the shop prices in — and what changing it actually does.
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
  const [whatsapp, setWhatsapp] = useState(store.whatsappPhone ?? "");
  const [prepMin, setPrepMin] = useState(String(store.prepMinMinutes));
  const [prepMax, setPrepMax] = useState(String(store.prepMaxMinutes));
  const [pin, setPin] = useState(
    store.latitude !== null && store.longitude !== null
      ? `${store.latitude}, ${store.longitude}`
      : "",
  );

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `currencyCode` first — which is compared.
  useUnsavedChanges(
    changed(
      { name, currencyCode, imageUrl, whatsapp, prepMin, prepMax, pin },
      {
        name: store.name,
        currencyCode: store.currencyCode,
        imageUrl: store.imageUrl,
        whatsapp: store.whatsappPhone ?? "",
        prepMin: String(store.prepMinMinutes),
        prepMax: String(store.prepMaxMinutes),
        pin:
          store.latitude !== null && store.longitude !== null
            ? `${store.latitude}, ${store.longitude}`
            : "",
      },
    ),
  );

  const [errors, setErrors] = useState<{
    name?: string;
    prep?: string;
    whatsapp?: string;
    pin?: string;
  }>({});

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

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
          keep: format(restatePrice(sample.price, from, into, "keep"), into.code),
          convert: format(
            restatePrice(sample.price, from, into, "convert"),
            into.code,
          ),
        }
      : null;

  async function save() {
    const min = Number(prepMin);
    const max = Number(prepMax);

    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(min, max);
    const phoneCheck = validatePhone(digitsOf(whatsapp));

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // Empty is fine — the field is optional. The rule itself lives in
      // `validatePhone`, which is the CHECK constraint's, so the wizard and the
      // driver form cannot drift from this one.
      whatsapp:
        whatsapp.trim() === "" || phoneCheck.ok
          ? undefined
          : t(phoneCheck.key, phoneCheck.params),
      // An empty box is "no pin", which is a legitimate state — a shop can be
      // saved without one, with the warning above. Text that is not a location
      // is not, and saving null for it would look exactly like success while
      // leaving the shop unpinned.
      //
      // The two failures are told apart, because one of them has an obvious
      // next step and the other does not: a shortened link needs opening once,
      // and saying so beats "that is not a coordinate pair" about something
      // that plainly is a map link.
      pin: located.ok
        ? undefined
        : located.reason === "empty"
          ? undefined
          : located.reason === "shortened"
            ? t("store.pinShortened")
            : t("store.pinInvalid"),
    };

    setErrors(found);
    if (found.name || found.prep || found.pin || found.whatsapp) return;

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
        whatsappPhone: whatsapp.trim() || null,
        prepMinMinutes: min,
        prepMaxMinutes: max,
        // Both or neither. Half a pin is a row that passes every constraint and
        // means nothing.
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
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

          <section className="flex flex-col gap-lg">
            <h2 className="ps-md text-[17px]">{t("store.prepTitle")}</h2>

            {/* One field would be a lie — a kitchen quotes a range, and the app
              shows both ends of it. The error belongs to the pair rather than
              to either box, because "the smaller one is bigger" is not a fact
              about one number. */}
            <Field
              label={t("store.prepWindow")}
              hint={t("store.prepHint")}
              error={errors.prep}
            >
              <div className="flex items-center gap-sm">
                <NumberInput
                  value={prepMin}
                  onChange={(event) => setPrepMin(event.target.value)}
                  min={1}
                  placeholder="15"
                  className="w-[96px]"
                />
                <span className="text-[14px] text-text-soft">
                  {t("store.prepTo")}
                </span>
                <NumberInput
                  value={prepMax}
                  onChange={(event) => setPrepMax(event.target.value)}
                  min={1}
                  placeholder="30"
                  className="w-[96px]"
                />
                <span className="text-[14px] text-text-soft">
                  {t("store.minutes")}
                </span>
              </div>
            </Field>

            {/* Where the order is sent so the kitchen can start. Optional, and
                the hint says what happens without it rather than leaving an
                empty field to be wondered about — a shop with no number simply
                does not appear on the send list. */}
            <Field
              label={t("store.whatsapp")}
              hint={t("store.whatsappHint")}
              error={errors.whatsapp}
            >
              <PhoneInput
                value={whatsapp}
                onChange={setWhatsapp}
                placeholder={t("store.whatsappPlaceholder")}
              />
            </Field>
          </section>
        </div>

        {/* Sticky, so the map stays in view while the fields on the left are
            worked through. It is the reference the other column is edited
            against, not a section that comes after it. */}
        <section className="flex flex-col gap-lg p-xxl pt-0 lg:sticky lg:top-0 lg:flex-1 lg:self-start lg:ps-0 lg:pt-xxl">
          <h2 className="ps-md text-[17px]">{t("store.locationTitle")}</h2>

          {/* Said here, not left to be found on a customer's bill. */}
          {!coordinates && (
            <p
              role="status"
              className="rounded-md border border-danger-wash bg-danger-wash/40 px-lg py-md text-[13px] text-text"
            >
              {t("store.noPinWarning")}
            </p>
          )}

          <Field
            label={t("store.pin")}
            hint={t("store.pinHint")}
            error={errors.pin}
          >
            {/*
              One box taking a pasted pair, rather than two number fields.
              Nobody knows a shop's latitude; they get it by right-clicking the
              place in Google Maps, where "33.8938, 35.5018" is what lands on
              the clipboard. Splitting it into two fields makes the operator cut
              that string in half by hand, which is a step that exists only
              because of how the form was drawn.
            */}
            <Input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="33.8938, 35.5018"
              inputMode="text"
            />
          </Field>

          {/* As tall as the column allows. A map the size of a thumbnail
              answers "is there a pin"; a large one answers "is it the right
              building", which is the question that matters — and it is the
              reason this column exists rather than the fields simply being
              wider. */}
          <Map
            latitude={coordinates?.latitude ?? null}
            longitude={coordinates?.longitude ?? null}
            label={pickLocalized(name)}
            emptyKey="store.noPinYet"
            className="min-h-[240px] w-full flex-1 rounded-md"
          />
        </section>
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
