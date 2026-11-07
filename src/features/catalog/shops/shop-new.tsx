"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Field,
  FormError,
  Page,
  PageHeader,
  Section,
  Switch,
  TwoColumn,
  cx,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { MultiSelect, Select } from "@/components/ui/select";
import { useToasts } from "@/components/ui/toast";
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
  type Localized,
} from "@/lib/validation";

import {
  fetchDefaultCountry,
  type MenuLayout,
  type StoreDraft,
} from "../api/stores";
import { useCategories } from "../use-categories";
import { useCreateStore, useStores } from "../use-stores";

import {
  PinField,
  PrepWindowField,
  SaveBar,
  pinProblem,
  revealFirstError,
} from "./form-bits";
import {
  WeekEditor,
  checkWeek,
  draftWeek,
  weekToHours,
  type WeekDraft,
} from "./hours";

const LIST_HREF = "/shops";

type Errors = Partial<
  Record<
    | "name"
    | "category"
    | "currency"
    | "rate"
    | "pin"
    | "address"
    | "whatsapp"
    | "prep"
    | "hours",
    string
  >
>;

const BLANK = {
  name: {} as Localized,
  imageUrl: null as string | null,
  categoryId: "",
  otherCategoryIds: [] as string[],
  currencyCode: "",
  rate: "",
  pin: "",
  address: {} as Localized,
  whatsapp: "",
  prepMin: "10",
  prepMax: "20",
  isActive: false,
  isFeatured: false,
  menuLayout: "list" as MenuLayout,
};

/**
 * Adding a shop: one page of cards — who it is, what it prices in, where an
 * order reaches it, when it opens, and how it shows on the storefront.
 *
 * ## Why one page and not a wizard
 *
 * A shop is created a handful of times ever and has many required parts. The
 * old wizard validated a step at a time, so the second mistake was found only
 * after the first was fixed; here every failure is reported **beside its own
 * field, all at once**, and the page scrolls to the first. The cards are in
 * the order the questions are asked, so the shape of the job is visible
 * before it is started.
 *
 * ## The two answers that cost money
 *
 * - **The pin.** `delivery_fee_for_km` charges an unknown distance at the top
 *   band, so an unpinned shop quietly overcharges every customer. Required,
 *   with the map beside it so it gets *checked*.
 * - **The hours.** A missing day is a closed day, and a missing *week* is open
 *   around the clock (`0170`) — so at least one open day is required (`0228`).
 *   They are written after the shop; if that write fails the shop still
 *   exists, and the operator is sent to its Hours tab rather than invited to
 *   fill the form in again and make a second shop.
 *
 * ## Created hidden
 *
 * A shop with no menu is not one a customer should find. Visibility and
 * Featured both default off: going live is something done once the shop is
 * ready, not something to remember to undo.
 */
export function ShopNew() {
  const router = useRouter();
  const toast = useToasts();
  const guarded = useGuardedAction();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const categories = useCategories("");
  const { currencies } = useMoney();
  const create = useCreateStore();

  // The end of the list. Usually a cache hit from the shops list; arriving
  // cold it lands a moment later and only affects a number nobody sees.
  const stores = useStores("");
  const sortOrder = stores.data?.stores.length ?? 0;

  const country = useQuery({
    queryKey: ["countries", "default"],
    queryFn: fetchDefaultCountry,
    staleTime: 30 * 60_000,
  });

  const [name, setName] = useState(BLANK.name);
  const [imageUrl, setImageUrl] = useState(BLANK.imageUrl);
  const [categoryId, setCategoryId] = useState(BLANK.categoryId);
  const [otherCategoryIds, setOtherCategoryIds] = useState(
    BLANK.otherCategoryIds,
  );
  const [currencyCode, setCurrencyCode] = useState(BLANK.currencyCode);
  const [rate, setRate] = useState(BLANK.rate);
  const [pin, setPin] = useState(BLANK.pin);
  const [address, setAddress] = useState(BLANK.address);
  const [whatsapp, setWhatsapp] = useState(BLANK.whatsapp);
  const [prepMin, setPrepMin] = useState(BLANK.prepMin);
  const [prepMax, setPrepMax] = useState(BLANK.prepMax);
  const [isActive, setIsActive] = useState(BLANK.isActive);
  const [isFeatured, setIsFeatured] = useState(BLANK.isFeatured);
  const [menuLayout, setMenuLayout] = useState(BLANK.menuLayout);
  const [week, setWeek] = useState<WeekDraft>(() => draftWeek());
  const [errors, setErrors] = useState<Errors>({});

  // Compared against the blank form rather than tracked with a flag, so a
  // field typed into and emptied again leaves nothing to warn about.
  useUnsavedChanges(
    changed(
      {
        name,
        imageUrl,
        categoryId,
        otherCategoryIds,
        currencyCode,
        rate,
        pin,
        address,
        whatsapp,
        prepMin,
        prepMax,
        isActive,
        isFeatured,
        menuLayout,
        hours: weekToHours(week),
      },
      { ...BLANK, hours: [] },
    ),
  );

  const located = parseLocation(pin);
  const platformRate = currencies?.find((one) => !one.isBase)?.rate ?? null;
  const baseCode = currencies?.find((one) => one.isBase)?.code ?? "";
  const otherCode = currencies?.find((one) => !one.isBase)?.code ?? "";
  const rateLabel =
    baseCode && otherCode
      ? t("store.rate", { other: otherCode, base: baseCode })
      : t("store.rateGeneric");
  const rateTyped = rate.trim() !== "";
  const rateValue = Number(rate);

  function check(): Errors {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    // Required since 0198: the app prints it under every shop's name.
    const addressCheck = validateLocalizedText(address, codes, TEXT.address);
    const prepCheck = validatePrepWindow(Number(prepMin), Number(prepMax));
    const phone = validatePhone(digitsOf(whatsapp));
    return {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      category: categoryId ? undefined : t("store.categoryRequired"),
      currency: currencyCode ? undefined : t("store.currencyRequired"),
      rate:
        rateTyped && (!Number.isFinite(rateValue) || rateValue <= 0)
          ? t("store.ratePositive")
          : undefined,
      pin: pinProblem(located, { required: true }),
      address: addressCheck.ok
        ? undefined
        : t(addressCheck.key, addressCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // Required: a shop that is listed, takes orders and has nowhere to send
      // them is worse than one that cannot be added yet.
      whatsapp:
        whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phone.ok
            ? undefined
            : t(phone.key, phone.params),
      hours: checkWeek(week) ?? undefined,
    };
  }

  function submit() {
    const found = check();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      revealFirstError();
      return;
    }
    if (!country.data || !located.ok) return;

    const draft: StoreDraft = {
      name,
      categoryId,
      categoryIds: [categoryId, ...otherCategoryIds],
      currencyCode,
      imageUrl,
      latitude: located.latitude,
      longitude: located.longitude,
      prepMinMinutes: Number(prepMin),
      prepMaxMinutes: Number(prepMax),
      whatsappPhone: whatsapp.trim() || null,
      address,
      isActive,
      isFeatured,
      menuLayout,
      // Empty is null — the platform's rate — never zero, which `0120` refuses.
      exchangeRate: rateTyped ? rateValue : null,
    };

    create.mutate(
      {
        draft,
        countryId: country.data.id,
        sortOrder,
        name,
        hours: weekToHours(week),
      },
      {
        onSuccess: ({ id, hoursSaved }) => {
          if (!hoursSaved) {
            // The shop is made; only its week did not land. Straight to the
            // Hours tab with the reason — not a form to fill in again.
            toast.danger(t("store.hoursNotSaved"));
            router.replace(`/shops/${id}?tab=hours`);
            return;
          }
          // Straight to the new shop's menu, which is what comes next.
          router.replace(`/shops/${id}`);
        },
      },
    );
  }

  // What is still missing, said before Create is pressed rather than after —
  // Shopify's setup guide in miniature. Each line jumps to its card.
  const ready: ReadyItem[] = [
    {
      label: t("store.name"),
      done: validateLocalizedText(name, codes, TEXT.name).ok,
      target: "new-shop",
    },
    { label: t("store.category"), done: categoryId !== "", target: "new-shop" },
    {
      label: t("store.pin"),
      done: located.ok,
      target: "new-place",
    },
    {
      label: t("branches.address"),
      done: validateLocalizedText(address, codes, TEXT.address).ok,
      target: "new-place",
    },
    {
      label: t("store.whatsapp"),
      done: whatsapp.trim() !== "" && validatePhone(digitsOf(whatsapp)).ok,
      target: "new-place",
    },
    {
      label: t("store.stepHours"),
      done: checkWeek(week) === null,
      target: "new-hours",
    },
    {
      label: t("store.currency"),
      done: currencyCode !== "",
      target: "new-prices",
    },
  ];

  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: pickLocalized(category.name),
  }));

  return (
    <Page>
      <PageHeader
        title={t("store.add")}
        description={t("store.addDescription")}
      />

      {/* Shopify's record layout: what the shop is, where and when it
          trades down the main column; how it is priced and shown, and what
          is still missing, in the aside. */}
      <TwoColumn
        main={
          <>
            <div id="new-shop" className="scroll-mt-4">
              <Section
                title={t("store.stepShop")}
                description={t("store.stepShopHint")}
              >
                <div className="flex flex-col gap-5">
                  <LocalizedField
                    label={t("store.name")}
                    value={name}
                    onChange={setName}
                    maxLength={TEXT.name}
                    hint={t("store.nameHint")}
                    error={errors.name}
                    filter="title"
                    placeholder={{
                      en: t("store.namePlaceholder"),
                      ar: t("store.namePlaceholderAr"),
                    }}
                  />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      label={t("store.category")}
                      hint={t("store.categoryHint")}
                      error={errors.category}
                    >
                      {(wiring) => (
                        <Select
                          {...wiring}
                          value={categoryId}
                          onChange={(next) => {
                            setCategoryId(next);
                            // Promoted to main, so it leaves the extras — listing it
                            // twice would offer a removal that does nothing.
                            setOtherCategoryIds((ids) =>
                              ids.filter((id) => id !== next),
                            );
                          }}
                          placeholder={t("store.pickCategory")}
                          options={categoryOptions}
                        />
                      )}
                    </Field>
                    <Field
                      label={t("store.otherCategories")}
                      hint={t("store.otherCategoriesHint")}
                      optional={t("store.optional")}
                    >
                      {(wiring) => (
                        <MultiSelect
                          {...wiring}
                          value={otherCategoryIds}
                          onChange={setOtherCategoryIds}
                          placeholder={t("store.otherCategoriesPlaceholder")}
                          options={categoryOptions.filter(
                            (option) => option.value !== categoryId,
                          )}
                        />
                      )}
                    </Field>
                  </div>
                  <Field
                    label={t("images.label")}
                    hint={t("store.imageHint")}
                    optional={t("store.optional")}
                  >
                    <ImageUploader
                      value={imageUrl}
                      onChange={setImageUrl}
                      folder="stores"
                      photo="shop"
                      disabled={create.isPending}
                    />
                  </Field>
                </div>
              </Section>
            </div>
            <div id="new-place" className="scroll-mt-4">
              <Section
                title={t("store.stepPlace")}
                description={t("store.stepPlaceHint")}
                bodyClassName="@container"
              >
                <div className="flex flex-col gap-5">
                  <PinField
                    value={pin}
                    onChange={setPin}
                    located={located}
                    error={errors.pin}
                    label={t("store.pin")}
                    hint={t("store.pinHintNew")}
                    mapLabel={pickLocalized(name) || t("store.name")}
                    emptyKey="store.mapEmpty"
                  />
                  <LocalizedField
                    label={t("branches.address")}
                    hint={t("branches.addressHint")}
                    value={address}
                    onChange={setAddress}
                    placeholder={{
                      en: t("branches.addressPlaceholder"),
                      ar: t("branches.addressPlaceholderAr"),
                    }}
                    error={errors.address}
                    maxLength={TEXT.address}
                  />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      label={t("store.whatsapp")}
                      hint={t("store.whatsappHint")}
                      error={errors.whatsapp}
                    >
                      {(wiring) => (
                        <PhoneInput
                          {...wiring}
                          value={whatsapp}
                          onChange={setWhatsapp}
                          placeholder={t("store.whatsappPlaceholder")}
                        />
                      )}
                    </Field>
                    <PrepWindowField
                      min={prepMin}
                      max={prepMax}
                      onMin={setPrepMin}
                      onMax={setPrepMax}
                      error={errors.prep}
                    />
                  </div>
                </div>
              </Section>
            </div>
            <div id="new-hours" className="scroll-mt-4">
              <Section
                title={t("store.stepHours")}
                description={t("store.hoursBlurb")}
              >
                <WeekEditor
                  week={week}
                  onChange={(next) => {
                    setWeek(next);
                    setErrors((current) => ({ ...current, hours: undefined }));
                  }}
                  error={errors.hours}
                />
              </Section>
            </div>
          </>
        }
        aside={
          <div className="flex flex-col gap-6">
            <ReadyList items={ready} />
            <div id="new-prices" />
            <Section
              className="scroll-mt-4"
              title={t("store.stepPrices")}
              description={t("store.stepPricesHint")}
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label={t("store.currency")}
                  hint={t("store.currencyHintNew")}
                  error={errors.currency}
                >
                  {(wiring) => (
                    <Select
                      {...wiring}
                      value={currencyCode}
                      onChange={setCurrencyCode}
                      placeholder={t("store.pickCurrency")}
                      options={(currencies ?? []).map((one) => ({
                        value: one.code,
                        label: one.code,
                      }))}
                    />
                  )}
                </Field>
                <Field
                  label={rateLabel}
                  hint={t("store.rateHint")}
                  error={errors.rate}
                  optional={t("store.optional")}
                >
                  {(wiring) => (
                    <NumberInput
                      {...wiring}
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                      min={0}
                      step="any"
                      placeholder={t("store.ratePlatform", {
                        rate: platformRate
                          ? platformRate.toLocaleString("en-GB")
                          : "",
                      })}
                    />
                  )}
                </Field>
              </div>
            </Section>
            <Section title={t("store.storefrontSection")}>
              <div className="flex flex-col gap-5">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  label={t("store.visibilityLive")}
                  description={
                    isActive ? t("store.liveHint") : t("store.hiddenHintNew")
                  }
                />
                {/* No confirmation here, unlike the list: nothing happens until
                  the shop is created, and the row it belongs to is this form. */}
                <Switch
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                  label={t("store.featured")}
                  description={
                    isFeatured
                      ? t("store.featuredHint")
                      : t("store.featuredHintOff")
                  }
                />
                <Field
                  label={t("store.menuLayout")}
                  hint={
                    menuLayout === "aisles"
                      ? t("store.menuLayoutAislesHint")
                      : t("store.menuLayoutListHint")
                  }
                  className="sm:max-w-xs"
                >
                  {(wiring) => (
                    <Select
                      {...wiring}
                      value={menuLayout}
                      onChange={(next) =>
                        setMenuLayout(next === "aisles" ? "aisles" : "list")
                      }
                      options={[
                        { value: "list", label: t("store.menuLayoutList") },
                        { value: "aisles", label: t("store.menuLayoutAisles") },
                      ]}
                    />
                  )}
                </Field>
              </div>
            </Section>
          </div>
        }
      />

      {/* The real message: a country that cannot be read and one that is not
          seeded are different problems with different fixes. */}
      {country.error instanceof Error && (
        <FormError>{country.error.message}</FormError>
      )}
      {create.error instanceof Error && (
        <FormError>{create.error.message}</FormError>
      )}

      <SaveBar>
        <Button
          variant="ghost"
          onClick={guarded(() => router.push(LIST_HREF))}
          disabled={create.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          pending={create.isPending}
          disabled={!country.data}
        >
          {t("store.create")}
        </Button>
      </SaveBar>
    </Page>
  );
}

type ReadyItem = { label: string; done: boolean; target: string };

/** The required answers, ticked off as they are given. */
function ReadyList({ items }: { items: ReadyItem[] }) {
  const done = items.filter((item) => item.done).length;
  return (
    <Section
      title={t("store.readyTitle")}
      description={t("store.readyCount", { done, total: items.length })}
    >
      <ul className="-mx-2 flex flex-col">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(item.target)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-[13.5px] transition-colors hover:bg-hover"
            >
              {item.done ? (
                <CheckCircle2
                  aria-hidden
                  className="size-4 shrink-0 text-success"
                />
              ) : (
                <Circle aria-hidden className="size-4 shrink-0 text-ink-4" />
              )}
              <span className={cx(item.done ? "text-ink-3" : "text-ink")}>
                {item.label}
              </span>
              <span className="sr-only">
                {item.done ? t("store.readyDone") : t("store.readyMissing")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
