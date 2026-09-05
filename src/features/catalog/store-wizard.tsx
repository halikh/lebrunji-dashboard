"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map as PinMap } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import { PhoneInput } from "@/components/ui/phone-input";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { digitsOf } from "@/lib/phone";
import {
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
} from "@/lib/validation";
import type { Localized } from "@/lib/validation";

import { fetchDefaultCountry, type StoreDraft } from "./api/stores";
import { useCategories } from "./use-categories";
import { useCreateStore } from "./use-stores";

/**
 * Adding a shop.
 *
 * ## Why a wizard, when everything else here is a form
 *
 * The flow study's answer, and it is about frequency rather than taste. A menu
 * item is created forty times in an afternoon and wants a form you can fly
 * through; **a shop is created a handful of times, ever**, and has many
 * interdependent required parts — an identity, a category, a currency every
 * price will be denominated in, a map pin that decides what delivery costs, and
 * a prep window that drives the ETA.
 *
 * Those are not fields to scroll past. Put on one page they become a wall that
 * somebody fills in once, badly, and the mistakes are expensive and quiet: a
 * shop with no pin silently charges every customer the **top delivery band**,
 * because `delivery_fee_for_km` treats an unknown distance that way.
 *
 * One decision per step means each of them is read.
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
 * to find. The last step offers the switch and defaults it off, so going live is
 * a thing the operator does when the shop is ready — not a thing they have to
 * remember to undo.
 */

type Step = 0 | 1 | 2 | 3;
const STEPS = 4;

export function StoreWizard({
  sortOrder,
  onClose,
}: {
  /** Where it goes: the end of the list. */
  sortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const languages = useLanguages();
  const categories = useCategories("");
  const { currencies } = useMoney();
  const create = useCreateStore();

  const country = useQuery({
    queryKey: ["countries", "default"],
    queryFn: fetchDefaultCountry,
    // Reference data, changed by migration rather than by anybody on this
    // screen.
    staleTime: 30 * 60_000,
  });

  const codes = languages.data?.map((language) => language.code) ?? [];

  const [step, setStep] = useState<Step>(0);

  const [name, setName] = useState<Localized>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [pin, setPin] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [prepMin, setPrepMin] = useState("10");
  const [prepMax, setPrepMax] = useState("20");
  const [isActive, setIsActive] = useState(false);

  /**
   * A wizard is dirty as soon as it stops looking like a blank one.
   *
   * Compared against the defaults rather than tracked with a flag, so backing a
   * field out — typing a name and deleting it again — leaves nothing to warn
   * about. `step` is not in the comparison: moving between steps is not an edit.
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
        prepMin: "10",
        prepMax: "20",
        isActive: false,
      },
    ),
  );

  const [errors, setErrors] = useState<{
    name?: string;
    category?: string;
    currency?: string;
    pin?: string;
    prep?: string;
    whatsapp?: string;
  }>({});

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  // Seeded from the first active currency, derived rather than set by an
  // effect: it is a value computed from data already in hand, and an effect
  // would set state during a render it was itself triggered by.
  //
  // Not from the country — `0027` dropped `countries.default_currency_code`,
  // so the country has no opinion about money any more.
  const currency = currencyCode || currencies?.[0]?.code || "";

  /**
   * What is wrong with the step being left, or nothing.
   *
   * Validated per step rather than all at the end. A wizard that accepts four
   * steps and then reports a problem on the first one has wasted the whole
   * point of being a wizard.
   */
  function checkStep(which: Step) {
    if (which === 0) {
      const check = validateLocalizedText(name, codes, TEXT.name);
      return { name: check.ok ? undefined : t(check.key, check.params) };
    }

    if (which === 1) {
      return {
        // Both columns are `not null` with no default, so an empty one is a
        // refusal from Postgres carrying a constraint name. Caught here so it
        // reads as a form.
        category: categoryId ? undefined : t("store.categoryRequired"),
        currency: currency ? undefined : t("store.currencyRequired"),
      };
    }

    if (which === 2) {
      // An empty box is "no pin", which is a legitimate state — the step says
      // what it costs. Text that is *not* a location is not: saving null for it
      // would look exactly like success while leaving the shop unpinned.
      //
      // The two failures are told apart because one has an obvious next step:
      // a shortened link needs opening once, and saying so beats "that is not a
      // coordinate pair" about something that plainly is a map link.
      return {
        pin: located.ok
          ? undefined
          : located.reason === "empty"
            ? undefined
            : located.reason === "shortened"
              ? t("store.pinShortened")
              : t("store.pinInvalid"),
      };
    }

    const check = validatePrepWindow(Number(prepMin), Number(prepMax));
    const phone = validatePhone(digitsOf(whatsapp));

    return {
      prep: check.ok ? undefined : t(check.key, check.params),
      // Optional, so an empty box passes: a shop is often added before anybody
      // has been asked for its number. A *wrong* number does not pass, because
      // the failure it causes is silent — the shop simply never appears on the
      // send list, and nothing on screen says why.
      whatsapp:
        whatsapp.trim() === "" || phone.ok
          ? undefined
          : t(phone.key, phone.params),
    };
  }

  function next() {
    const found = checkStep(step);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setStep((current) => Math.min(current + 1, STEPS - 1) as Step);
  }

  function submit() {
    const found = checkStep(3);
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Named steps, not four anonymous bars.
          A wizard with unlabelled progress tells you how much is left and
          nothing about what it is — so the operator cannot tell whether the
          thing they are looking for is coming, and answers the current step
          defensively in case it is their only chance.

          A completed step is a button back to itself. Forward is not: the steps
          validate on the way out, and letting somebody skip to the end would
          mean collecting the failures they had just been walked past. */}
      <nav
        aria-label={t("store.add")}
        className="flex shrink-0 items-stretch gap-xs border-b border-border px-xxl py-md"
      >
        {STEP_KEYS.map((key, index) => {
          const done = index < step;
          const here = index === step;
          return (
            <button
              key={key}
              type="button"
              disabled={!done}
              aria-current={here ? "step" : undefined}
              onClick={() => setStep(index as Step)}
              className={cx(
                "flex flex-1 flex-col gap-xs text-start",
                !done && "cursor-default",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "h-[3px] w-full rounded-sm",
                  here
                    ? "bg-active"
                    : done
                      ? "bg-active/40"
                      : "bg-neutral-fill",
                )}
              />
              <span
                className={cx(
                  "truncate text-[11px] font-semibold",
                  here ? "text-text" : "text-text-faint",
                )}
              >
                {t(SHORT[index])}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        {/* Capped, because these are short answers. A shop's name stretched
            across a wide panel is harder to read and to aim at, not easier. */}
        <div className="flex w-full max-w-[520px] flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <h3 className="text-[18px] font-semibold">{t(TITLES[step])}</h3>
            <p className="text-[13px] text-text-soft">{t(BLURBS[step])}</p>
          </div>

          {step === 0 && (
            <>
              <LocalizedField
                label={t("store.name")}
                value={name}
                onChange={setName}
                maxLength={TEXT.name}
                error={errors.name}
                placeholder={{ en: "Nara Kitchen", ar: "مطبخ نارا" }}
              />
              <Field label={t("images.label")} hint={t("store.imageHint")}>
                <ImageUploader
                  value={imageUrl}
                  onChange={setImageUrl}
                  folder="stores"
                  disabled={create.isPending}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
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
            </>
          )}

          {step === 2 && (
            <>
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
            </>
          )}

          {step === 3 && (
            <>
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

              {/* Beside the prep window rather than on a step of its own: both
                  answer the same question — how an order reaches this kitchen
                  and how long it takes once it does. Optional, and the hint
                  says what its absence costs, which is the part somebody
                  skipping the field cannot otherwise know. */}
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
            </>
          )}

          {/* The real message, not a stand-in for it. A country that cannot be
            read and a country that is not seeded are different problems with
            different fixes, and collapsing them sends somebody to edit data
            when the request was refused. */}
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
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-sm border-t border-border p-xxl">
        <Button
          variant="secondary"
          disabled={create.isPending}
          onClick={() =>
            step === 0 ? onClose() : setStep((current) => (current - 1) as Step)
          }
        >
          {step === 0 ? t("common.cancel") : t("store.back")}
        </Button>

        {step < STEPS - 1 ? (
          <Button onClick={next}>{t("store.next")}</Button>
        ) : (
          <Button
            onClick={submit}
            pending={create.isPending}
            disabled={!country.data}
          >
            {t("store.create")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Stable keys for the step strip, so a reorder cannot desync it from state. */
const STEP_KEYS = ["name", "placement", "location", "orders"] as const;

/** Two or three words each — the strip is a map, not a second set of headings. */
const SHORT = [
  "store.shortName",
  "store.shortPlacement",
  "store.shortLocation",
  "store.shortOrders",
] as const;

const TITLES = [
  "store.stepName",
  "store.stepPlacement",
  "store.stepLocation",
  "store.stepOrders",
] as const;

const BLURBS = [
  "store.stepNameBlurb",
  "store.stepPlacementBlurb",
  "store.stepLocationBlurb",
  "store.stepOrdersBlurb",
] as const;
