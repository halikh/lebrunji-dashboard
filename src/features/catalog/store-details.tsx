"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { digitsOf } from "@/features/drivers/api/couriers";
import { useLanguages } from "@/features/reference/use-languages";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import {
  validateLocalizedText,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

import type { Store } from "./api/stores";
import { useMenu } from "./use-menu";
import { useStore, useUpdateStore } from "./use-stores";

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
 * ## Why it is not part of the Save below
 *
 * Every other field on this page is a fact about the shop that means the same
 * thing before and after. This one re-reads every price the shop has. Folding
 * it into a Save that also carries a renamed shop and a moved pin would make
 * one button do two very different jobs, and the dangerous one would be the
 * invisible half.
 *
 * ## Nothing is converted, and the screen says so
 *
 * Prices are minor units in a column with no currency of its own, so this
 * changes what they mean without changing a digit — and across USD and LBP that
 * is a decimal-scale shift as well as a rate. Rather than describing that, the
 * warning shows it: a real price off this menu, rendered both ways.
 *
 * It is reversible — no row is rewritten — which is why an empty shop can
 * change it with one press and a stocked one has to confirm. The friction is
 * proportional to what is at stake, and for the case this exists for (a wrong
 * pick, noticed immediately) there is nothing at stake yet.
 */
function CurrencySection({ store }: { store: Store }) {
  const { currencies, format } = useMoney();
  const menu = useMenu(store.id);
  const update = useUpdateStore();

  const [picked, setPicked] = useState(store.currencyCode);

  // A priced dish off this very menu, so the example is this shop's money
  // rather than a number I made up. Absent on a shop with no menu yet, which is
  // exactly the shop that needs no warning.
  const sample =
    (menu.data ?? []).flatMap((section) => section.items)[0] ?? null;
  const changed = picked !== "" && picked !== store.currencyCode;

  function apply() {
    update.mutate({
      id: store.id,
      patch: { currencyCode: picked },
      name: store.name,
    });
  }

  // The shop's name as a string: a confirmation names the thing that was
  // clicked, which is the whole reason it catches the wrong row.
  const example = {
    name: pickLocalized(store.name),
    to: picked,
    before: sample ? format(sample.price, store.currencyCode) : "",
    after: sample ? format(sample.price, picked) : "",
  };

  return (
    <section className="flex flex-col gap-lg">
      <h2 className="ps-md text-[17px]">{t("store.currencyTitle")}</h2>

      <Field label={t("store.currency")} hint={t("store.currencyEditHint")}>
        <Select
          value={picked}
          onChange={setPicked}
          placeholder={t("store.pickCurrency")}
          options={(currencies ?? []).map((one) => ({
            value: one.code,
            label: one.code,
          }))}
        />
      </Field>

      {/* Shown rather than described. "The scale differs" is a sentence an
          operator can read and still not believe; "$15.00 will read as
          ل.ل1,500" is the same fact in a form that cannot be misread. */}
      {changed && sample && (
        <p
          role="status"
          className="rounded-md border border-danger-wash bg-danger-wash/40 px-lg py-md text-[13px] text-text"
        >
          {t("store.currencyRelabels", example)}
        </p>
      )}

      {changed &&
        (sample ? (
          <ConfirmButton
            onConfirm={apply}
            titleKey="store.currencyChangeTitle"
            bodyKey="store.currencyChangeBody"
            confirmKey="store.currencyChangeConfirm"
            params={example}
            triggerVariant="secondary"
          >
            {t("store.currencyApply", { code: picked })}
          </ConfirmButton>
        ) : (
          // Nothing priced, nothing to misprice. The shop this feature exists
          // for gets one press.
          <Button
            variant="secondary"
            onClick={apply}
            pending={update.isPending}
            className="self-start"
          >
            {t("store.currencyApply", { code: picked })}
          </Button>
        ))}
    </section>
  );
}

function Form({ store }: { store: Store }) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const update = useUpdateStore();

  const [name, setName] = useState<Localized>(store.name);
  const [imageUrl, setImageUrl] = useState<string | null>(store.imageUrl);
  const [whatsapp, setWhatsapp] = useState(store.whatsappPhone ?? "");
  const [prepMin, setPrepMin] = useState(String(store.prepMinMinutes));
  const [prepMax, setPrepMax] = useState(String(store.prepMaxMinutes));
  const [pin, setPin] = useState(
    store.latitude !== null && store.longitude !== null
      ? `${store.latitude}, ${store.longitude}`
      : "",
  );

  const [errors, setErrors] = useState<{
    name?: string;
    prep?: string;
    whatsapp?: string;
    pin?: string;
  }>({});

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  function save() {
    const min = Number(prepMin);
    const max = Number(prepMax);

    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(min, max);

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // The same rule the CHECK constraint carries, so the operator is told
      // before saving rather than by a constraint name afterwards. Empty is
      // fine — the field is optional.
      whatsapp:
        whatsapp.trim() === "" || /^[1-9][0-9]{6,14}$/.test(digitsOf(whatsapp))
          ? undefined
          : t("drivers.badPhone"),
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

          <CurrencySection store={store} />

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
              <Input
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder={t("store.whatsappPlaceholder")}
                inputMode="tel"
                maxLength={24}
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
        <Button onClick={save} pending={update.isPending}>
          {t("store.save")}
        </Button>
      </div>
    </div>
  );
}
