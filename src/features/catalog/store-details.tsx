"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { useLanguages } from "@/features/reference/use-languages";
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

function Form({ store }: { store: Store }) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const update = useUpdateStore();

  const [name, setName] = useState<Localized>(store.name);
  const [imageUrl, setImageUrl] = useState<string | null>(store.imageUrl);
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
    if (found.name || found.prep || found.pin) return;

    update.mutate({
      id: store.id,
      patch: {
        name,
        imageUrl,
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
    <div className="flex min-h-0 flex-1 flex-col">
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
      <div className="flex min-h-0 flex-1 flex-col gap-xxl overflow-y-auto p-xxl lg:flex-row lg:overflow-hidden">
        {/* The fields scroll; the map does not.

            At 420px the map ran past the bottom of the window, so seeing the
            end of it meant scrolling a page that had nothing else to show —
            and a map you have to scroll to see all of is a map you cannot read
            at a glance, which is its whole job here.

            So on a wide screen the two columns are independent: the fields take
            their own scrollbar when they need one, and the map takes exactly
            the height that is left. Stacked on a narrow screen there is one
            scroll again, and the map falls back to a sensible minimum. */}
        <div className="flex flex-col gap-xxl lg:w-[540px] lg:shrink-0 lg:overflow-y-auto lg:pe-lg">
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

          <section className="flex flex-col gap-lg">
            <h2 className="text-[17px]">{t("store.prepTitle")}</h2>

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
          </section>
        </div>

        {/* Sticky, so the map stays in view while the fields on the left are
            worked through. It is the reference the other column is edited
            against, not a section that comes after it. */}
        <section className="flex min-h-0 flex-col gap-lg lg:flex-1">
          <h2 className="text-[17px]">{t("store.locationTitle")}</h2>

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
