"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map as PinMap } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import { digitsOf } from "@/lib/phone";
import {
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
} from "@/lib/validation";
import type { Localized } from "@/lib/validation";

import { fetchDefaultCountry, type StoreDraft } from "./api/stores";
import { useCategories } from "./use-categories";
import { useCreateStore, useStores } from "./use-stores";

const LIST_HREF = "/catalogue?tab=shops";

/**
 * Adding a shop — one page, the same shape as the page that edits one.
 *
 * ## It was a four-step wizard
 *
 * The argument for that was frequency: a menu item is created forty times in an
 * afternoon and wants a form you can fly through, where **a shop is created a
 * handful of times ever** and has many interdependent required parts — an
 * identity, a category, a currency every price is denominated in, a map pin that
 * decides what delivery costs, a prep window that drives the ETA. One decision
 * per step meant each of them was read.
 *
 * What it cost is that adding a shop and editing one were two different screens
 * with two different vocabularies: four steps and a Next here, one form and a
 * Save everywhere else in the dashboard. The operator learned the wizard once
 * and then never saw it again, and the fields they *had* learned — the same
 * fields, in the branch editor — were laid out differently.
 *
 * So it is a form, and the thing the steps were protecting is kept another way:
 * every field is still required, and every failure is reported **beside its own
 * field, all at once**. That is strictly more than the wizard managed — it
 * validated a step at a time, so the second mistake was only discovered after
 * the first was fixed.
 *
 * ## The pin is the one to be careful about
 *
 * An unpinned shop does not fail to quote a delivery. `delivery_fee_for_km`
 * treats an unknown distance as the **top band**, so it quietly charges every
 * customer the most expensive answer there is. That is why the field is
 * required, why the warning sits under it while it is empty, and why the map is
 * on screen rather than a step away.
 *
 * ## What it deliberately does not ask
 *
 * The country (one row of reference data — a list of one is not a question),
 * the slug (generated in the insert's transaction), the sort order (the end),
 * and whether to feature it. Featuring is a claim made to every customer on the
 * home screen and belongs to the confirmed switch on the list, not to a
 * checkbox on a form somebody is filling in for the first time.
 *
 * ## It is created hidden
 *
 * A shop with no menu, no hours and no pin is not one a customer should be able
 * to find, so the switch defaults to off. Going live is a thing the operator
 * does when the shop is ready, not a thing they have to remember to undo.
 */
export function StoreEditor() {
  const router = useRouter();
  const languages = useLanguages();
  const categories = useCategories("");
  const { currencies } = useMoney();
  const create = useCreateStore();

  /**
   * Where the new shop goes: the end of the list.
   *
   * Read here rather than passed in, since this is reached by URL and not by a
   * button that happened to know the count. The list is the same query the
   * shops tab already holds, so on the ordinary route in this is a cache hit;
   * arriving cold it lands a moment later and only affects a number nobody
   * sees.
   */
  const stores = useStores("");
  const sortOrder = stores.data?.stores.length ?? 0;

  const onClose = () => router.replace(LIST_HREF);

  const country = useQuery({
    queryKey: ["countries", "default"],
    queryFn: fetchDefaultCountry,
    // Reference data, changed by migration rather than by anybody on this
    // screen.
    staleTime: 30 * 60_000,
  });

  const codes = languages.data?.map((language) => language.code) ?? [];
  const guarded = useGuardedAction();

  const [name, setName] = useState<Localized>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [pin, setPin] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  // Off, like Visibility beside it. A shop with no menu, no hours and no pin is
  // not one to put at the top of the home screen — but an operator adding a
  // shop they have just agreed a promotion for can say so here rather than
  // leaving, finding it in the list and flicking a second switch.
  const [isFeatured, setIsFeatured] = useState(false);
  const [prepMin, setPrepMin] = useState("10");
  const [prepMax, setPrepMax] = useState("20");
  const [isActive, setIsActive] = useState(false);

  const [errors, setErrors] = useState<{
    name?: string;
    category?: string;
    currency?: string;
    pin?: string;
    prep?: string;
    whatsapp?: string;
  }>({});

  /**
   * A new shop is dirty as soon as it stops looking like a blank one.
   *
   * Compared against the defaults rather than tracked with a flag, so backing a
   * field out — typing a name and deleting it again — leaves nothing to warn
   * about.
   */
  useUnsavedChanges(
    changed(
      {
        name,
        imageUrl,
        categoryId,
        currencyCode,
        pin,
        whatsapp,
        isFeatured,
        prepMin,
        prepMax,
        isActive,
      },
      {
        name: {},
        imageUrl: null,
        categoryId: "",
        currencyCode: "",
        pin: "",
        whatsapp: "",
        isFeatured: false,
        prepMin: "10",
        prepMax: "20",
        isActive: false,
      },
    ),
  );

  const currency = currencyCode;
  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  /**
   * Every answer at once, each failure beside the field that caused it.
   *
   * All of it on one pass, which is what a form can do and the wizard could
   * not: it checked a step on the way out, so a shop missing both a category
   * and a pin reported them one screen apart and one fix at a time.
   */
  function check() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(Number(prepMin), Number(prepMax));
    const phone = validatePhone(digitsOf(whatsapp));

    return {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // Both columns are `not null` with no default, so an empty one is a
      // refusal from Postgres carrying a constraint name. Caught here so it
      // reads as a form.
      category: categoryId ? undefined : t("store.categoryRequired"),
      currency: currency ? undefined : t("store.currencyRequired"),
      // The three failures are told apart because two have an obvious next
      // step: an empty box needs an answer, and a shortened link needs opening
      // once — and saying so beats "that is not a coordinate pair" about
      // something that plainly is a map link.
      pin: located.ok
        ? undefined
        : located.reason === "empty"
          ? t("branches.pinRequired")
          : located.reason === "shortened"
            ? t("store.pinShortened")
            : t("store.pinInvalid"),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // Required, because a shop that is listed, takes orders and has nowhere
      // to send them is worse than one that cannot be added yet. A *wrong*
      // number was always refused: the failure it causes is silent — the shop
      // never appears on the send list and nothing on screen says why.
      whatsapp:
        whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phone.ok
            ? undefined
            : t(phone.key, phone.params),
    };
  }

  function submit() {
    const found = check();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (!country.data) return;

    const draft: StoreDraft = {
      name,
      categoryId,
      currencyCode: currency,
      imageUrl,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      prepMinMinutes: Number(prepMin),
      prepMaxMinutes: Number(prepMax),
      whatsappPhone: whatsapp.trim() || null,
      isFeatured,
      isActive,
    };

    create.mutate(
      { draft, countryId: country.data.id, sortOrder, name },
      {
        onSuccess: (id) => {
          onClose();
          // Straight to the new shop's menu, which is what the operator came to
          // build. Landing back on the list would mean finding the row they
          // just created and clicking it.
          router.push(`/catalogue/${id}`);
        },
      },
    );
  }

  return (
    <EditorPage
      title={t("store.add")}
      backHref={LIST_HREF}
      backLabel={t("catalogue.stores")}
      /* Two columns, like the page that edits a shop — see the grid below. */
      width="wide"
      footer={
        <>
          <Button
            variant="secondary"
            disabled={create.isPending}
            // Guarded, unlike the `onClose` a successful create calls: asking
            // whether to discard the shop that was just made would be a
            // question about nothing.
            onClick={guarded(onClose)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={submit}
            pending={create.isPending}
            disabled={!country.data}
          >
            {t("store.create")}
          </Button>
        </>
      }
    >
      {/**
       * The same two halves the branch editor draws, for the same reason.
       *
       * On the left, **who it is**: the name, what kind of shop it is, what its
       * prices are denominated in, its picture and the number an order goes to.
       * On the right, **where it is and how it works**: the pin, the map, the
       * prep window, and how it appears on the storefront.
       *
       * One column below `lg`, in that order.
       *
       * ## The two columns flow independently, and that is the trade
       *
       * Their rows do not line up: each field is as tall as its own label,
       * control and hint, so by the fourth one the two sides are twenty-odd
       * points out of step.
       *
       * This was tried the other way — `grid-rows-subgrid`, so both columns
       * share the parent’s row tracks and every pair starts on the same
       * line. It aligned, and it was worse: a row is as tall as the taller
       * of its two cells, and the right column holds a 260pt map against
       * fields of ninety. Category ended up with a hand’s width of nothing
       * above it and Currency was pushed most of a screen down. Alignment
       * bought with that much dead space is not a tidier form, it is a
       * sparser one.
       *
       * So the columns flow. If the drift ever has to go, the fix is not a
       * grid — it is giving the map a column of its own, or moving it off
       * this form.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <LocalizedField
            label={t("store.name")}
            value={name}
            onChange={setName}
            maxLength={TEXT.name}
            error={errors.name}
            format="upper"
            placeholder={{ en: "NARA KITCHEN", ar: "مطبخ نارا" }}
          />

          <Field
            label={t("store.category")}
            hint={t("store.categoryHint")}
            error={errors.category}
          >
            <Select
              value={categoryId}
              onChange={setCategoryId}
              placeholder={t("store.pickCategory")}
              options={(categories.data ?? []).map((category) => ({
                value: category.id,
                label: pickLocalized(category.name),
              }))}
            />
          </Field>

          <Field
            label={t("store.currency")}
            // Not a preference: every price on the menu is denominated in it,
            // and changing it later reprices nothing — the numbers stay and
            // simply mean something else.
            hint={t("store.currencyHint")}
            error={errors.currency}
          >
            <Select
              value={currency}
              onChange={setCurrencyCode}
              placeholder={t("store.pickCurrency")}
              options={(currencies ?? []).map((one) => ({
                value: one.code,
                label: one.code,
              }))}
            />
          </Field>

          <Field label={t("images.label")} hint={t("store.imageHint")}>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="stores"
              disabled={create.isPending}
            />
          </Field>

          {/* The number is a fact about the *shop*, so it belongs in the column
              that says what the shop is — beside its name, its category and its
              currency — rather than in the one about where it is and how long
              it takes.

              It also balances the two. The right column carries a 260pt map, so
              the left ran out of fields halfway down and left a screen of empty
              beside it; this is the field that fills it. */}
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
        </div>

        <div className="flex min-w-0 flex-col gap-lg">
          <Field
            label={t("store.pin")}
            hint={t("store.pinHint")}
            error={errors.pin}
          >
            <Input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="33.8938, 35.5018"
            />
          </Field>

          {/* The consequence, said before it happens rather than found on a
              bill: an unpinned shop is charged at the top band, because
              `delivery_fee_for_km` treats an unknown distance that way. */}
          {!coordinates && (
            <p className="rounded-md border border-border bg-danger-wash/40 px-lg py-md text-[13px]">
              {t("store.noPinWarning")}
            </p>
          )}

          <PinMap
            latitude={coordinates?.latitude ?? null}
            longitude={coordinates?.longitude ?? null}
            label={pickLocalized(name) || t("store.name")}
            emptyKey="store.mapEmpty"
            className="h-[260px] w-full rounded-md"
          />

          <Field
            label={t("store.prep")}
            hint={t("store.prepHint")}
            error={errors.prep}
          >
            <div className="flex items-center gap-md">
              <span className="flex-1">
                <NumberInput
                  min={0}
                  step={1}
                  value={prepMin}
                  onChange={(event) => setPrepMin(event.target.value)}
                  aria-label={t("store.prepMin")}
                />
              </span>
              <span className="shrink-0 text-[13px] text-text-soft">
                {t("store.prepTo")}
              </span>
              <span className="flex-1">
                <NumberInput
                  min={0}
                  step={1}
                  value={prepMax}
                  onChange={(event) => setPrepMax(event.target.value)}
                  aria-label={t("store.prepMax")}
                />
              </span>
              <span className="shrink-0 text-[13px] text-text-soft">
                {t("store.minutes")}
              </span>
            </div>
          </Field>

          {/* Both storefront switches in one cell: they answer the same
              question at two strengths — can a customer find this shop, and
              should it be the first one they see. */}
          <div className="flex flex-col gap-lg">
            <Field
              label={t("store.visibility")}
              hint={isActive ? t("store.liveHint") : t("store.hiddenHintNew")}
            >
              <Toggle
                on={isActive}
                onChange={() => setIsActive((current) => !current)}
                labelOn={t("store.live")}
                labelOff={t("store.hidden")}
              />
            </Field>

            {/* No confirmation here, unlike the shops list.

                There the switch acts the instant it is flicked, on a live shop,
                from a column of identical rows — which is what the dialog is
                for. Here nothing happens until Save, the shop does not exist
                yet, and the row it belongs to is the form being filled in. */}
            <Field
              label={t("store.featured")}
              hint={
                isFeatured
                  ? t("store.featuredHint")
                  : t("store.featuredHintOff")
              }
            >
              <Toggle
                on={isFeatured}
                onChange={() => setIsFeatured((current) => !current)}
                labelOn={t("catalogue.featured")}
                labelOff={t("store.notFeatured")}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* The real message, not a stand-in for it. A country that cannot be read
          and a country that is not seeded are different problems with different
          fixes, and collapsing them sends somebody to edit data when the
          request was refused. */}
      {country.error instanceof Error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {country.error.message}
        </p>
      )}

      {create.error instanceof Error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {create.error.message}
        </p>
      )}
    </EditorPage>
  );
}
