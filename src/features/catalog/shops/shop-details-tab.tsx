"use client";

import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Section,
  Skeleton,
  Switch,
  cx,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { MultiSelect, Select } from "@/components/ui/select";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import { restatePrice } from "@/lib/money";
import { digitsOf } from "@/lib/phone";
import {
  localizedOrNull,
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

import type { Branch } from "../api/branches";
import {
  EARNINGS_MODELS,
  percentProblem,
  type EarningsModel,
  type StoreEarnings,
} from "../api/earnings";
import type { CurrencyChangeMode, MenuLayout, Store } from "../api/stores";
import { useBranches, useUpdateBranch } from "../use-branches";
import { useCategories } from "../use-categories";
import { useSaveStoreEarnings, useShopEarnings } from "../use-earnings";
import { useMenu } from "../use-menu";
import { useSetStoreCurrency, useStore, useUpdateStore } from "../use-stores";

import {
  Notice,
  PinField,
  PrepWindowField,
  SaveBar,
  pinProblem,
  revealFirstError,
} from "./form-bits";

/**
 * The shop itself — what is true of the brand rather than of one place.
 *
 * ## For a shop that is one place, the place too
 *
 * `0101` moved the pin, the prep window, the WhatsApp number and the hours to
 * the branch, which is right for a chain and a fiction for a shop with one
 * address: its store row and its only branch are the same shopfront. So with
 * one branch this tab owns the whole shopfront and writes both rows — the
 * rename included, since `0121` copies the name to the first branch once and
 * never again. With two or more it is about the brand alone, and each place is
 * edited on its own page — hours included: a chain has no Hours tab, each
 * branch keeps its week on its page. A one-branch shop keeps the Hours tab.
 *
 * Visibility is on the page header and the shops list, where the switch asks
 * first; featuring is here as well, because somebody editing the shop is in
 * the middle of thinking about it, and nothing happens until Save.
 */
export function ShopDetailsTab({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  // Waited on, not raced: the form is keyed on what it read, so it reads the
  // branch before it builds its fields or the pin would arrive after them.
  const branches = useBranches(storeId);
  const earnings = useShopEarnings(storeId);

  if (store.isPending || branches.isPending || earnings.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (store.isError || !store.data || earnings.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={t("store.detailsFailed")}
        action={
          <Button
            onClick={() => {
              void store.refetch();
              void earnings.refetch();
            }}
          >
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const rows = branches.data ?? [];
  const sole = rows.length === 1 ? rows[0] : null;

  return (
    <DetailsForm
      // Keyed on the rows as read: a refetch that changed the shop rebuilds
      // the form rather than leaving edits on top of newer data. After a save
      // the two agree, so nothing typed is lost to the save's own refetch.
      key={signature(store.data, sole, earnings.data.shop)}
      store={store.data}
      sole={sole}
      earnings={earnings.data.shop}
    />
  );
}

function signature(
  store: Store,
  sole: Branch | null,
  earnings: StoreEarnings | null,
): string {
  return JSON.stringify([
    earnings,
    store.id,
    store.name,
    store.imageUrl,
    store.categoryId,
    store.categoryIds,
    store.currencyCode,
    store.isFeatured,
    store.menuLayout,
    store.exchangeRate,
    sole?.id ?? null,
    sole?.latitude ?? null,
    sole?.longitude ?? null,
    sole?.address ?? null,
    sole?.prepMinMinutes ?? null,
    sole?.prepMaxMinutes ?? null,
    sole?.whatsappPhone ?? null,
    sole?.isActive ?? null,
  ]);
}

function pinText(branch: Branch | null): string {
  return branch && branch.latitude !== null && branch.longitude !== null
    ? `${branch.latitude}, ${branch.longitude}`
    : "";
}

type Errors = Partial<
  Record<
    "name" | "rate" | "pin" | "address" | "prep" | "whatsapp" | "percent",
    string
  >
>;

function DetailsForm({
  store,
  sole,
  earnings,
}: {
  store: Store;
  sole: Branch | null;
  /** The shop's `store_earnings` row, or null — commission at no rate. */
  earnings: StoreEarnings | null;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const { format, currencies } = useMoney();
  const categories = useCategories("");
  // Only for the worked example of a currency change. Usually cached by the
  // Menu tab; its absence costs only the example.
  const menu = useMenu(store.id);

  const update = useUpdateStore();
  const updateBranch = useUpdateBranch(store.id);
  const setCurrency = useSetStoreCurrency();
  const saveEarnings = useSaveStoreEarnings(store.id);

  const initialOthers = store.categoryIds.filter(
    (id) => id !== store.categoryId,
  );
  const initial = {
    name: store.name,
    imageUrl: store.imageUrl,
    categoryId: store.categoryId,
    otherCategoryIds: initialOthers,
    currencyCode: store.currencyCode,
    isFeatured: store.isFeatured,
    menuLayout: store.menuLayout,
    rate: store.exchangeRate == null ? "" : String(store.exchangeRate),
    pin: pinText(sole),
    address: sole?.address ?? {},
    prepMin: String(sole?.prepMinMinutes ?? 10),
    prepMax: String(sole?.prepMaxMinutes ?? 20),
    whatsapp: sole?.whatsappPhone ?? "",
    trading: sole?.isActive ?? true,
    model: (earnings?.model ?? "commission") as EarningsModel,
    percent:
      earnings?.commissionPercent == null
        ? ""
        : String(earnings.commissionPercent),
  };

  const [name, setName] = useState<Localized>(initial.name);
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [otherCategoryIds, setOtherCategoryIds] = useState<string[]>(
    initial.otherCategoryIds,
  );
  const [currencyCode, setCurrencyCode] = useState(initial.currencyCode);
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured);
  const [menuLayout, setMenuLayout] = useState<MenuLayout>(initial.menuLayout);
  // A string, like every number in a form here: `95000.` is valid halfway.
  const [rate, setRate] = useState(initial.rate);
  /**
   * What a currency change is *for*. `keep` — the wrong-pick fix — is what
   * almost every change will be; `convert` is a shop genuinely
   * re-denominating, so it is the deliberate choice.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");
  const [pin, setPin] = useState(initial.pin);
  const [address, setAddress] = useState<Localized>(initial.address);
  const [prepMin, setPrepMin] = useState(initial.prepMin);
  const [prepMax, setPrepMax] = useState(initial.prepMax);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  /** Whether the one branch trades — its page is never reached on a one-place shop. */
  const [trading, setTrading] = useState(initial.trading);
  /** How the platform earns from this shop (`0262`). */
  const [model, setModel] = useState<EarningsModel>(initial.model);
  const [percent, setPercent] = useState(initial.percent);

  const [errors, setErrors] = useState<Errors>({});
  const [confirmingCurrency, setConfirmingCurrency] = useState(false);

  const current = {
    name,
    imageUrl,
    categoryId,
    otherCategoryIds,
    currencyCode,
    isFeatured,
    menuLayout,
    rate,
    pin,
    address,
    prepMin,
    prepMax,
    whatsapp,
    trading,
    model,
    percent,
  };
  // `mode` is left out: it is a question *about* a currency change and cannot
  // be reached without moving the currency, which is compared.
  const dirty = changed(current, initial);
  useUnsavedChanges(dirty);

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  const platformRate = currencies?.find((one) => !one.isBase)?.rate ?? null;
  const baseCode = currencies?.find((one) => one.isBase)?.code ?? "";
  const otherCode = currencies?.find((one) => !one.isBase)?.code ?? "";
  const rateLabel =
    baseCode && otherCode
      ? t("store.rate", { other: otherCode, base: baseCode })
      : t("store.rateGeneric");

  const currencyMoved =
    currencyCode !== "" && currencyCode !== store.currencyCode;

  /**
   * A real price off this menu under each answer — `restatePrice` is the
   * arithmetic `api_v1_set_store_currency` runs, so these are the figures that
   * will be written. Null when the menu has nothing priced (or has not loaded);
   * the choice is still asked, only without the example.
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

  function check(): boolean {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const rateTyped = rate.trim() !== "";
    const rateValue = Number(rate);
    const prepCheck = sole
      ? validatePrepWindow(Number(prepMin), Number(prepMax))
      : null;
    const phoneCheck = sole ? validatePhone(digitsOf(whatsapp)) : null;
    const addressCheck = sole
      ? validateLocalizedText(address, codes, TEXT.address)
      : null;

    const found: Errors = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // Empty is the platform's rate, the common answer. A number typed and
      // unusable is refused here rather than by `0120`'s CHECK in Postgres.
      rate:
        rateTyped && (!Number.isFinite(rateValue) || rateValue <= 0)
          ? t("store.ratePositive")
          : undefined,
      // Empty is a shop nobody has located yet; a typed, unreadable one would
      // save as null and read as the field ignoring what was typed.
      pin: sole ? pinProblem(located, { required: false }) : undefined,
      address:
        addressCheck && !addressCheck.ok
          ? t(addressCheck.key, addressCheck.params)
          : undefined,
      prep:
        prepCheck && !prepCheck.ok
          ? t(prepCheck.key, prepCheck.params)
          : undefined,
      // Required, as when the shop is added: clearing it would leave a shop
      // that takes orders and has nowhere to send them.
      // Only on commission, and required there: markup has no rate.
      percent: model === "commission" ? percentProblem(percent) : undefined,
      whatsapp:
        sole && whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phoneCheck && !phoneCheck.ok
            ? t(phoneCheck.key, phoneCheck.params)
            : undefined,
    };
    setErrors(found);
    const ok = !Object.values(found).some(Boolean);
    if (!ok) revealFirstError();
    return ok;
  }

  function requestSave() {
    if (!check()) return;
    // Rewriting every price is the one change here that is hard to take back,
    // so it is said, with a real price, before it happens.
    if (currencyMoved) setConfirmingCurrency(true);
    else void save();
  }

  /**
   * The writes this form implies, in the order they must happen.
   *
   * The currency first and on its own: it rewrites every price atomically, and
   * a failure there must stop the rest — a shop renamed with its prices in a
   * currency it was told had changed is a screen and a database disagreeing
   * about money. Nothing is written when nothing moved.
   */
  async function save() {
    if (currencyMoved) {
      try {
        await setCurrency.mutateAsync({
          storeId: store.id,
          currencyCode,
          mode,
          name: store.name,
        });
      } catch {
        // Reported by the mutation's toast. Stopping is the point.
        return;
      }
    }

    const nameMoved = changed(name, store.name);
    const imageMoved = imageUrl !== store.imageUrl;
    const categoryMoved = categoryId !== "" && categoryId !== store.categoryId;
    const featureMoved = isFeatured !== store.isFeatured;
    const layoutMoved = menuLayout !== store.menuLayout;
    const nextCategoryIds = [
      categoryId || store.categoryId,
      ...otherCategoryIds,
    ];
    // As a set: the order chips were picked in is not something saved.
    const categoriesMoved =
      [...nextCategoryIds].sort().join() !==
      [...store.categoryIds].sort().join();
    // Null is a value — clearing the box puts the shop back on the platform's
    // rate — so this compares rather than testing truthiness.
    const nextRate = rate.trim() !== "" ? Number(rate) : null;
    const rateMoved = nextRate !== store.exchangeRate;

    // One write for the row: separate requests would leave a shop renamed and
    // still mis-filed when the second failed.
    const storeMoved =
      nameMoved ||
      imageMoved ||
      categoryMoved ||
      categoriesMoved ||
      featureMoved ||
      layoutMoved ||
      rateMoved;

    // Its own row, staff-only. On markup the rate is cleared, so a branch
    // that overrides back to commission is not handed a rate nobody sees.
    const nextEarnings: StoreEarnings = {
      model,
      commissionPercent:
        model === "commission" && percent.trim() !== ""
          ? Number(percent)
          : null,
    };
    const earningsMoved =
      model !== initial.model || percent.trim() !== initial.percent;
    if (earningsMoved) {
      saveEarnings.mutate({
        branchId: null,
        earnings: nextEarnings,
        quiet: storeMoved,
      });
    }

    if (storeMoved) {
      update.mutate({
        id: store.id,
        patch: {
          ...(nameMoved && { name }),
          ...(imageMoved && { imageUrl }),
          ...(categoryMoved && { categoryId }),
          ...(categoriesMoved && { categoryIds: nextCategoryIds }),
          ...(featureMoved && { isFeatured }),
          ...(layoutMoved && { menuLayout }),
          ...(rateMoved && { exchangeRate: nextRate }),
        },
        name: store.name,
      });
    }

    if (!sole) return;

    const pinMoved =
      (coordinates?.latitude ?? null) !== sole.latitude ||
      (coordinates?.longitude ?? null) !== sole.longitude;
    const prepMoved =
      Number(prepMin) !== sole.prepMinMinutes ||
      Number(prepMax) !== sole.prepMaxMinutes;
    const phone = digitsOf(whatsapp) || null;
    const phoneMoved = phone !== sole.whatsappPhone;
    const tradingMoved = trading !== sole.isActive;
    // Through `localizedOrNull` both sides, so a box typed into and emptied
    // compares equal to the null it was.
    const addressMoved = changed(
      localizedOrNull(address),
      localizedOrNull(sole.address),
    );

    if (
      nameMoved ||
      pinMoved ||
      addressMoved ||
      prepMoved ||
      phoneMoved ||
      tradingMoved
    ) {
      updateBranch.mutate({
        id: sole.id,
        patch: {
          // With one branch the two names are one name (see the note above).
          ...(nameMoved && { name }),
          ...(pinMoved && {
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
          }),
          ...(prepMoved && {
            prepMinMinutes: Number(prepMin),
            prepMaxMinutes: Number(prepMax),
          }),
          ...(addressMoved && { address }),
          ...(phoneMoved && { whatsappPhone: phone }),
          ...(tradingMoved && { isActive: trading }),
        },
        name: pickLocalized(sole.name),
        // One Save, one notice: quiet when the store write has already said
        // it, spoken when this is the only write there is.
        quiet: storeMoved || earningsMoved,
      });
    }
  }

  function discard() {
    setName(initial.name);
    setImageUrl(initial.imageUrl);
    setCategoryId(initial.categoryId);
    setOtherCategoryIds(initial.otherCategoryIds);
    setCurrencyCode(initial.currencyCode);
    setIsFeatured(initial.isFeatured);
    setMenuLayout(initial.menuLayout);
    setRate(initial.rate);
    setMode("keep");
    setPin(initial.pin);
    setAddress(initial.address);
    setPrepMin(initial.prepMin);
    setPrepMax(initial.prepMax);
    setWhatsapp(initial.whatsapp);
    setTrading(initial.trading);
    setModel(initial.model);
    setPercent(initial.percent);
    setErrors({});
  }

  const pending =
    update.isPending ||
    setCurrency.isPending ||
    updateBranch.isPending ||
    saveEarnings.isPending;
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: pickLocalized(category.name),
  }));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] text-ink-3">
        {sole ? t("store.detailsIntroSole") : t("store.detailsIntro")}
      </p>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title={t("store.identitySection")}>
            <div className="flex flex-col gap-5">
              <LocalizedField
                label={t("store.name")}
                value={name}
                onChange={setName}
                maxLength={TEXT.name}
                hint={sole ? t("store.nameHintSole") : t("store.nameHint")}
                error={errors.name}
                filter="title"
                placeholder={{
                  en: t("store.namePlaceholder"),
                  ar: t("store.namePlaceholderAr"),
                }}
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Editable here: a mis-filed shop used to be fixable only by
                    deleting it and losing the menu with it. Nothing is
                    denominated in a category, so it is a plain write. */}
                <Field
                  label={t("store.category")}
                  hint={t("store.categoryHint")}
                >
                  {(wiring) => (
                    <Select
                      {...wiring}
                      value={categoryId}
                      onChange={(next) => {
                        setCategoryId(next);
                        // Promoted to main, so it leaves the extras.
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
            </div>
          </Section>

          <Section
            title={t("store.pricesSection")}
            description={t("store.pricesSectionHint")}
          >
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label={t("store.currency")}
                  hint={t("store.currencyEditHint")}
                >
                  {(wiring) => (
                    <Select
                      {...wiring}
                      value={currencyCode}
                      onChange={(next) => next && setCurrencyCode(next)}
                      options={(currencies ?? []).map((one) => ({
                        value: one.code,
                        label: one.code,
                      }))}
                    />
                  )}
                </Field>
                {/* What a dollar is worth **at this shop** (`0120`). Empty
                    follows the platform's rate, live. It changes what the app
                    shows beside a price, never what is charged. */}
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

              {currencyMoved && (
                <CurrencyChoice
                  mode={mode}
                  onMode={setMode}
                  preview={preview}
                  code={currencyCode}
                />
              )}

              {/* What the platform keeps (`0262`). Staff only — customers
                  never see a rate or a store price. */}
              <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-2">
                <Field
                  label={t("earnings.model")}
                  hint={
                    // Switching says what it leaves behind: the menu's prices
                    // do not change by themselves either way.
                    model !== initial.model
                      ? model === "markup"
                        ? t("earnings.switchToMarkup")
                        : t("earnings.switchToCommission")
                      : model === "markup"
                        ? t("earnings.markupHint")
                        : t("earnings.commissionHint")
                  }
                >
                  {(wiring) => (
                    <Select
                      {...wiring}
                      value={model}
                      onChange={(next) =>
                        setModel(next === "markup" ? "markup" : "commission")
                      }
                      options={EARNINGS_MODELS.map((one) => ({
                        value: one,
                        label: t(`earnings.${one}`),
                      }))}
                    />
                  )}
                </Field>
                {model === "commission" && (
                  <Field
                    label={t("earnings.percent")}
                    hint={t("earnings.percentHint")}
                    error={errors.percent}
                  >
                    {(wiring) => (
                      <NumberInput
                        {...wiring}
                        value={percent}
                        onChange={(event) => setPercent(event.target.value)}
                        min={0}
                        max={100}
                        step="any"
                        placeholder={t("earnings.percentPlaceholder")}
                      />
                    )}
                  </Field>
                )}
              </div>
            </div>
          </Section>

          {sole && (
            <Section
              title={t("store.placeSection")}
              description={t("store.placeSectionHint")}
              bodyClassName="@container"
            >
              <div className="flex flex-col gap-5">
                {!coordinates && pin.trim() === "" && (
                  <Notice>{t("store.noPinWarning")}</Notice>
                )}
                <PinField
                  value={pin}
                  onChange={setPin}
                  located={located}
                  error={errors.pin}
                  label={t("store.pin")}
                  hint={t("branches.pinHint")}
                  mapLabel={pickLocalized(name)}
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
                    label={t("branches.whatsapp")}
                    hint={t("branches.whatsappHint")}
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
                <div className="rounded-md border border-line px-4 py-3">
                  <Switch
                    checked={trading}
                    onCheckedChange={setTrading}
                    label={t("branches.visibility")}
                    description={
                      trading
                        ? t("branches.liveHint")
                        : t("branches.hiddenHint")
                    }
                  />
                </div>
              </div>
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4">
          {/* The shop's picture — the default every branch without its own
              falls back to, so the one that changes the shop's card. */}
          <Section title={t("images.label")} description={t("store.imageHint")}>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="stores"
              photo="shop"
              disabled={pending}
            />
          </Section>

          <Section title={t("store.storefrontSection")}>
            <div className="flex flex-col gap-5">
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
      </div>

      <SaveBar status={dirty ? t("hours.unsavedShort") : undefined}>
        <Button variant="ghost" onClick={discard} disabled={!dirty || pending}>
          {t("store.discard")}
        </Button>
        <Button
          variant="primary"
          onClick={requestSave}
          pending={pending}
          disabled={!dirty}
        >
          {t("store.save")}
        </Button>
      </SaveBar>

      <ConfirmDialog
        open={confirmingCurrency}
        onOpenChange={setConfirmingCurrency}
        title={t("store.currencyConfirmTitle", { code: currencyCode })}
        description={
          preview
            ? t("store.currencyBecomes", {
                before: preview.before,
                after: mode === "keep" ? preview.keep : preview.convert,
              })
            : t("store.currencyConfirmBody")
        }
        confirmLabel={t("store.currencyConfirm")}
        onConfirm={save}
      >
        <p className="text-[13px] text-ink-3">{t("store.currencyLossy")}</p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * The two answers to a currency change, each showing what it does to a real
 * price. Describing the difference does not work — "restate the digits" and
 * "convert at the rate" are the same sentence to anybody who has not thought
 * about minor units; "12 becomes ل.ل12" against "12 becomes ل.ل1,076,400"
 * needs no explaining.
 */
function CurrencyChoice({
  mode,
  onMode,
  preview,
  code,
}: {
  mode: CurrencyChangeMode;
  onMode: (mode: CurrencyChangeMode) => void;
  preview: { before: string; keep: string; convert: string } | null;
  code: string;
}) {
  const options: { key: CurrencyChangeMode; label: string; result?: string }[] =
    [
      {
        key: "keep",
        label: t("store.currencyKeep"),
        result: preview
          ? t("store.currencyBecomes", {
              before: preview.before,
              after: preview.keep,
            })
          : undefined,
      },
      {
        key: "convert",
        label: t("store.currencyConvert"),
        result: preview
          ? t("store.currencyBecomes", {
              before: preview.before,
              after: preview.convert,
            })
          : undefined,
      },
    ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft/60 p-4">
      <p className="flex items-start gap-2 text-[13.5px] font-medium text-warning-ink">
        <ArrowRightLeft aria-hidden className="mt-0.5 size-4 shrink-0" />
        {preview
          ? t("store.currencyMoved", { before: preview.before })
          : t("store.currencyMovedNoSample", { code })}
      </p>
      <div role="radiogroup" className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.key}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-md border bg-surface px-3 py-2.5 text-[13.5px] transition-colors",
              mode === option.key
                ? "border-accent shadow-focus"
                : "border-line hover:border-line-strong",
            )}
          >
            <input
              type="radio"
              name="currency-mode"
              checked={mode === option.key}
              onChange={() => onMode(option.key)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-ink">{option.label}</span>
              {option.result && (
                <span className="text-ink-3 tabular-nums">{option.result}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <p className="text-[12.5px] text-ink-3">{t("store.currencyLossy")}</p>
    </div>
  );
}
