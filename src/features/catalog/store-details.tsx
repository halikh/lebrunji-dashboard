"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
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
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

import type { Branch } from "./api/branches";
import type { CurrencyChangeMode, Store } from "./api/stores";
import { useBranches, useUpdateBranch } from "./use-branches";
import { useCategories } from "./use-categories";
import { useMenu } from "./use-menu";
import { useSetStoreCurrency, useStore, useUpdateStore } from "./use-stores";

/**
 * The shop itself — the answers that are true of the brand rather than of one
 * place it trades from.
 *
 * ## Why it is a tab of its own again
 *
 * It was one, then it was folded into the Branches tab, and the fold is what
 * this file undoes. `0101` moved the pin, the prep window, the WhatsApp number
 * and the hours onto the branch that owns them, which left Details holding
 * three fields — so they were put in the branch panel instead, under a heading
 * saying "The shop".
 *
 * A heading is not enough. The page around those fields is one branch, its
 * title is that branch's name, and every other control on it writes to that
 * branch's row — including an **image uploader**, which is the field an
 * operator reaches for first. Changing the picture there changed the branch's
 * picture and left the shop's alone, which is the opposite of what a section
 * headed "The shop" promises. Two records, one form, one Save: the only thing
 * telling them apart was a subheading.
 *
 * So the shop's answers are on the shop's page. The branch editor is now only
 * about a branch, and the two pictures — the shop's here, the branch's override
 * there — are edited on the pages of the rows they belong to.
 *
 * ## What is deliberately not here
 *
 * The pin, the prep window, the WhatsApp number and the opening hours. All four
 * moved to `branches` in `0101` and answer "where and when does an order reach
 * a kitchen", which is wrong the moment a shop has two addresses. The columns
 * still exist on `stores` for shops created before the move; nothing on this
 * screen writes them.
 *
 * Visibility is not here either. A shop is put on and off the storefront from
 * the shops list, where the switch acts on the row and asks first — see
 * `stores-list.tsx`. Featuring *is* here, because it is a claim about the shop
 * that somebody editing the shop is in the middle of thinking about.
 */
export function StoreDetails({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  /**
   * The shop's places, because a shop with exactly one of them is edited here.
   *
   * See `sole` below for the whole argument. Waited on rather than raced: the
   * form is keyed on what it read, so it has to read the branch before it
   * builds its fields or the pin would arrive after the boxes did.
   */
  const branches = useBranches(storeId);

  if (store.isPending || branches.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-lg p-xxl">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-[64px] rounded-md bg-neutral-fill" />
        ))}
      </div>
    );
  }

  if (store.isError || !store.data) {
    return (
      <div className="flex flex-col items-center gap-lg py-huge text-center">
        <h2 className="text-[18px]">{t("store.detailsFailed")}</h2>
        <Button variant="secondary" onClick={() => void store.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  /**
   * The shop's only branch, when it has only one.
   *
   * ## Why this tab edits it at all
   *
   * `0101` split the brand from the place and this file exists to keep the two
   * apart — read the note at the top. That split is right for a chain and is a
   * fiction for the shop that has one address: the store and its single branch
   * are the same shopfront, and the dashboard was asking for them twice.
   *
   * The cost was not merely typing it twice. `branches.name` is drawn in one
   * place in the app — the branch switcher — and the switcher is hidden on a
   * shop with one branch, so renaming the branch changed *nothing a customer
   * could see*, while the pin that decides the delivery fee lived only on the
   * branch and could not be reached from here at all. A shop's name and its
   * location, edited in two tabs, one of which was a decoy.
   *
   * So with one branch this tab owns the whole shopfront and writes to both
   * rows. With two or more, `sole` is null, the place fields are not drawn, and
   * the Branches tab is where a place is edited — which is correct there,
   * because then the places genuinely differ.
   */
  const rows = branches.data ?? [];
  const sole = rows.length === 1 ? rows[0] : null;

  return (
    /*
      Keyed on the row as it was read, the way the Hours tab keys its grid: a
      refetch that changed the shop rebuilds the form rather than leaving edits
      sitting on top of newer data. After a save the two agree, so nothing is
      thrown away by the invalidation the save itself causes.
     */
    <DetailsForm
      key={signature(store.data, sole)}
      store={store.data}
      sole={sole}
    />
  );
}

/** What the form initialises from — see the `key` above. */
function signature(store: Store, sole: Branch | null): string {
  return JSON.stringify([
    store.id,
    store.name,
    store.imageUrl,
    store.categoryId,
    store.currencyCode,
    store.isFeatured,
    store.exchangeRate,
    // The branch's half, so a pin changed elsewhere rebuilds these fields too.
    sole?.id ?? null,
    sole?.latitude ?? null,
    sole?.longitude ?? null,
    sole?.prepMinMinutes ?? null,
    sole?.prepMaxMinutes ?? null,
    sole?.whatsappPhone ?? null,
  ]);
}

function DetailsForm({ store, sole }: { store: Store; sole: Branch | null }) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const { format, currencies } = useMoney();
  // Every category, unfiltered — the same list the shop was filed from when it
  // was created.
  const categories = useCategories("");
  // Only for the worked example below. Cached — the Menu tab has usually
  // already loaded it — and its absence costs nothing: no sample, no warning,
  // which is the right answer for a shop with no menu anyway.
  const menu = useMenu(store.id);

  const update = useUpdateStore();
  const updateBranch = useUpdateBranch(store.id);
  const setCurrency = useSetStoreCurrency();

  const [name, setName] = useState<Localized>(store.name);
  const [imageUrl, setImageUrl] = useState<string | null>(store.imageUrl);
  const [categoryId, setCategoryId] = useState(store.categoryId);
  const [currencyCode, setCurrencyCode] = useState(store.currencyCode);
  const [isFeatured, setIsFeatured] = useState(store.isFeatured);
  /**
   * The shop's own rate, as typed. Empty is the platform's — `0120`.
   *
   * A string, like every other number in a form here: `95000.` is not a number
   * and is perfectly valid halfway through typing one.
   */
  const [rate, setRate] = useState(
    store.exchangeRate == null ? "" : String(store.exchangeRate),
  );
  /**
   * What a currency change is *for*, defaulted to the common case.
   *
   * `keep` is the wrong-pick fix and is what almost every change will be.
   * `convert` is a shop genuinely re-denominating, which happens once if ever —
   * so it is the deliberate choice rather than the one you land on.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");

  /**
   * The shopfront's own answers, when this shop is a single place — see `sole`.
   *
   * `pin` is a typed string rather than a pair of numbers for the reason the
   * branch editor gives: "33.89," is not a coordinate and is a perfectly
   * reasonable thing to be halfway through typing.
   */
  const [pin, setPin] = useState(
    sole && sole.latitude !== null && sole.longitude !== null
      ? `${sole.latitude}, ${sole.longitude}`
      : "",
  );
  const [prepMin, setPrepMin] = useState(String(sole?.prepMinMinutes ?? 10));
  const [prepMax, setPrepMax] = useState(String(sole?.prepMaxMinutes ?? 20));
  const [whatsapp, setWhatsapp] = useState(sole?.whatsappPhone ?? "");

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  const [errors, setErrors] = useState<{
    name?: string;
    rate?: string;
    pin?: string;
    prep?: string;
    whatsapp?: string;
  }>({});

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `currencyCode` first — which is compared.
  useUnsavedChanges(
    changed(
      {
        name,
        imageUrl,
        categoryId,
        currencyCode,
        isFeatured,
        rate,
        pin,
        prepMin,
        prepMax,
        whatsapp,
      },
      {
        name: store.name,
        imageUrl: store.imageUrl,
        categoryId: store.categoryId,
        currencyCode: store.currencyCode,
        isFeatured: store.isFeatured,
        rate: store.exchangeRate == null ? "" : String(store.exchangeRate),
        pin:
          sole && sole.latitude !== null && sole.longitude !== null
            ? `${sole.latitude}, ${sole.longitude}`
            : "",
        prepMin: String(sole?.prepMinMinutes ?? 10),
        prepMax: String(sole?.prepMaxMinutes ?? 20),
        whatsapp: sole?.whatsappPhone ?? "",
      },
    ),
  );

  /**
   * The platform's own rate, for the placeholder.
   *
   * The non-base row — the base's is 1 by definition, so "the rate" can only
   * mean the other side of the pair. Null while the table is still loading,
   * which leaves the placeholder empty rather than showing a number nobody set.
   */
  const platformRate = currencies?.find((one) => !one.isBase)?.rate ?? null;

  /**
   * "LBP per USD at this shop", built from the table.
   *
   * The pair rather than either idiom: the number typed here is lira and the
   * thing being priced is a dollar, so a label naming one of them leaves the
   * operator guessing which way round it goes. Falls back to a plain label
   * while the currencies are still loading — a heading with two blanks in it
   * reads as broken.
   */
  const baseCode = currencies?.find((one) => one.isBase)?.code ?? "";
  const otherCode = currencies?.find((one) => !one.isBase)?.code ?? "";
  const rateLabel =
    baseCode && otherCode
      ? t("store.rate", { other: otherCode, base: baseCode })
      : t("store.rateGeneric");

  const currencyMoved =
    currencyCode !== "" && currencyCode !== store.currencyCode;

  /**
   * A real price off this menu under each answer.
   *
   * Null when the currency has not moved, or when the shop has nothing priced —
   * and the second case is the one this feature exists for. A shop created five
   * minutes ago has nothing to misprice, so it gets no question and no
   * friction.
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

  /**
   * The writes this form implies, in the order they have to happen.
   *
   * ## Why the currency is its own write, and goes first
   *
   * Two requests rather than one, because they are two different things: the
   * currency rewrites every price in the shop and has to be atomic on its own,
   * while the name is one column on this row. Neither can be folded into the
   * other.
   *
   * It goes first so a failure stops there. The reverse order would leave the
   * shop renamed with its prices in a currency the operator was told had
   * changed — a screen and a database disagreeing about money.
   *
   * ## And why nothing is written when nothing moved
   *
   * A Save pressed after reading the page should not touch the row, and should
   * not fire a toast claiming it did.
   */
  async function save() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);

    // Empty is the answer most shops give — the platform's rate — so it is not
    // a failure. What is refused is a number typed and unusable: `0120`'s CHECK
    // would turn that into a Postgres error the operator cannot read, and the
    // app would fall back to the platform's rate anyway, which looks like the
    // field being ignored.
    const rateTyped = rate.trim() !== "";
    const rateValue = Number(rate);

    /*
     * The shopfront's checks, and only when this shop is one — the same three
     * the branch panel makes, through the same functions, because they are the
     * same three columns.
     *
     * The pin is allowed to be empty and refused when it is typed and
     * unreadable. An empty pin is a shop nobody has located yet; a broken one
     * would be saved as null and read as the same thing, which is the field
     * silently ignoring what was typed into it.
     */
    const prepCheck = sole
      ? validatePrepWindow(Number(prepMin), Number(prepMax))
      : null;
    const phoneCheck =
      sole && whatsapp.trim() !== "" ? validatePhone(digitsOf(whatsapp)) : null;

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      rate:
        rateTyped && (!Number.isFinite(rateValue) || rateValue <= 0)
          ? t("store.ratePositive")
          : undefined,
      pin:
        sole && pin.trim() !== "" && !coordinates
          ? t("store.pinInvalid")
          : undefined,
      prep:
        prepCheck && !prepCheck.ok
          ? t(prepCheck.key, prepCheck.params)
          : undefined,
      whatsapp:
        phoneCheck && !phoneCheck.ok
          ? t(phoneCheck.key, phoneCheck.params)
          : undefined,
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    if (currencyMoved) {
      try {
        await setCurrency.mutateAsync({
          storeId: store.id,
          currencyCode,
          mode,
          name: store.name,
        });
      } catch {
        // Already reported by the mutation's own toast. Stopping here is what
        // keeps the rest of the row from being written against prices that did
        // not move.
        return;
      }
    }

    // Compared as JSON because these are objects: `===` on two `Localized`
    // values is always false, which would mark the shop changed on every save.
    // The same reasoning `changed()` in `unsaved-changes` records.
    const nameMoved = JSON.stringify(name) !== JSON.stringify(store.name);
    const imageMoved = imageUrl !== store.imageUrl;
    const categoryMoved = categoryId !== "" && categoryId !== store.categoryId;
    const featureMoved = isFeatured !== store.isFeatured;
    // Null is a value, so this compares rather than checking for truthiness —
    // clearing the box is how a shop goes back to the platform's rate, and a
    // falsy check would refuse to write that.
    const nextRate = rateTyped ? rateValue : null;
    const rateMoved = nextRate !== store.exchangeRate;

    // One write for all of them, because they are columns on the same row:
    // separate requests would mean a shop that got renamed and stayed mis-filed
    // when the second failed.
    if (nameMoved || imageMoved || categoryMoved || featureMoved || rateMoved) {
      update.mutate({
        id: store.id,
        patch: {
          ...(nameMoved && { name }),
          ...(imageMoved && { imageUrl }),
          ...(categoryMoved && { categoryId }),
          ...(featureMoved && { isFeatured }),
          ...(rateMoved && { exchangeRate: nextRate }),
        },
        name: store.name,
      });
    }

    /*
     * And the same shopfront, on its branch row.
     *
     * ## The name goes too, and that is the point
     *
     * `0121` copies the store's name onto the first branch at creation and then
     * never looks again, so the two drift the first time a shop is renamed —
     * which is the bug this whole arrangement is here to fix. With one branch
     * the two names are one name, so the rename writes both.
     *
     * It stops mattering the moment a second branch exists: `sole` is null
     * then, none of this runs, and each place is named on its own panel. A
     * branch that has been deliberately renamed is therefore never overwritten
     * by this, because a shop with a deliberately-named branch has more than
     * one.
     *
     * ## Why a second request rather than one
     *
     * They are two tables. There is no RPC that writes both, and inventing one
     * to save a round trip would put a schema change on the critical path of a
     * form fix. The failure mode is mild and visible: the branch write reports
     * its own error and the form is still open on what was typed.
     */
    if (!sole) return;

    const pinMoved =
      (coordinates?.latitude ?? null) !== sole.latitude ||
      (coordinates?.longitude ?? null) !== sole.longitude;
    const prepMoved =
      Number(prepMin) !== sole.prepMinMinutes ||
      Number(prepMax) !== sole.prepMaxMinutes;
    const phone = digitsOf(whatsapp) || null;
    const phoneMoved = phone !== sole.whatsappPhone;

    if (nameMoved || pinMoved || prepMoved || phoneMoved) {
      updateBranch.mutate({
        id: sole.id,
        patch: {
          ...(nameMoved && { name }),
          ...(pinMoved && {
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
          }),
          ...(prepMoved && {
            prepMinMinutes: Number(prepMin),
            prepMaxMinutes: Number(prepMax),
          }),
          ...(phoneMoved && { whatsappPhone: phone }),
        },
        name: pickLocalized(sole.name),
      });
    }
  }

  const pending =
    update.isPending || setCurrency.isPending || updateBranch.isPending;

  return (
    /*
      `h-full`, like the Hours tab: the pane around this is an ordinary block,
      so the column has to claim its height or the scroll container inside it
      never gets a bound and the Save bar goes below the fold.
     */
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        {/* Says whose answers these are before any of them is changed. The
            branch editor is one click away and looks similar, and the whole
            point of this tab is that the two are different rows. */}
        <p className="ps-md text-[13px] text-text-faint">
          {t("store.detailsIntro")}
        </p>

        {/**
         * The same two halves the store and branch forms draw. On the left,
         * **who it is**: the name, what kind of shop it is, its picture. On the
         * right, **what it prices in**: the currency, what a change to it does,
         * the shop's own rate, and whether it leads the home screen.
         */}
        <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
          <div className="flex min-w-0 flex-col gap-lg">
            <LocalizedField
              label={t("store.name")}
              value={name}
              onChange={setName}
              maxLength={TEXT.name}
              hint={t("store.nameHint")}
              error={errors.name}
              format="upper"
              placeholder={{ en: "NARA KITCHEN", ar: "مطبخ نارة" }}
            />

            {/*
              Which kind of shop this is — and it can be changed here.

              It used to be a wizard-only answer, which made a mis-filing
              permanent: the category decides where the shop appears on Home and
              what artwork it wears, and the only way to correct it was to
              delete the shop and lose the menu with it.

              Nothing is denominated in a category the way prices are in a
              currency, so this is a plain write and needs none of the machinery
              on the other side of the form.
            */}
            <Field label={t("store.category")} hint={t("store.categoryHint")}>
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

            {/*
              The shop's picture, on the shop's page — which is the whole reason
              this tab exists.

              It was in the branch editor, beside a branch's own override, and
              the two were told apart by a subheading. What an operator did with
              that was change the picture under "The shop" and get a picture on
              one branch. `0110` made the branch's optional and left this one the
              default every branch falls back to, so this is the field that
              changes the shop's card in the app.
            */}
            <Field label={t("images.label")} hint={t("store.imageHint")}>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                folder="stores"
                disabled={pending}
              />
            </Field>
          </div>

          <div className="flex min-w-0 flex-col gap-lg">
            <Field
              label={t("store.currency")}
              hint={t("store.currencyEditHint")}
            >
              <Select
                value={currencyCode}
                onChange={setCurrencyCode}
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
                  Both answers, each showing what it does to a real price off
                  this menu. Describing the difference does not work — "restate
                  the digits" and "convert at the rate" are the same sentence to
                  anybody who has not thought about minor units. "12 becomes
                  ل.ل12" against "12 becomes ل.ل1,076,400" needs no explaining
                  at all.
                */}
                <ChoiceOfMode
                  checked={mode === "keep"}
                  onSelect={() => setMode("keep")}
                  label={t("store.currencyKeep")}
                  result={t("store.currencyBecomes", {
                    before: preview.before,
                    after: preview.keep,
                  })}
                />
                <ChoiceOfMode
                  checked={mode === "convert"}
                  onSelect={() => setMode("convert")}
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

            {/*
              What a dollar is worth **at this shop** — `0120`.

              ## Why a shop needs its own

              `currencies.rate` is one number for the whole marketplace, and
              `0028` wrote down why it is set by hand: in this market a rate is
              a decision somebody makes in the morning rather than a quote a
              market gives. What it assumed is that there is *one* such
              decision. Two shops on the same street sell in dollars and quote
              different lira rates, and a customer reading one shop's menu
              converted at the other's number is reading a price that shop would
              not accept.

              ## Empty is a real answer, and the common one

              It means the platform's rate, and it stays a live reference: a
              shop left alone follows the number on the Pricing screen when that
              moves. The placeholder shows what that number currently is, so
              leaving the box empty is a decision somebody can see the
              consequence of.

              ## It changes what is shown, not what is charged

              The menu is already priced in this shop's own currency and is
              charged at those figures, so this cannot move a bill. It decides
              the second currency the app writes beside a price.
            */}
            <Field
              label={rateLabel}
              hint={t("store.rateHint")}
              error={errors.rate}
            >
              <NumberInput
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                min={0}
                step="any"
                placeholder={t("store.ratePlatform", {
                  rate: platformRate
                    ? platformRate.toLocaleString("en-GB")
                    : "",
                })}
                aria-label={rateLabel}
              />
            </Field>

            {/*
              Featuring, edited where the shop is edited.

              It was the shops list and nowhere else. That is the right place
              for it — the list is where you compare shops and decide which one
              leads — but being *only* there meant an operator who had opened a
              shop to change three things about it had to save, go back and find
              the row to change a fourth.

              No confirmation dialog here, unlike the list. There the switch acts
              the instant it is flicked, on a live shop, from a column of
              identical rows, which is exactly what the dialog guards. Here
              nothing happens until Save, and the row it belongs to is the page
              that is open.
            */}
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

        {/*
          The shopfront, for a shop that is one place — see `sole`.

          Below the brand rather than beside it, because it answers a different
          question: everything above is *who this is*, and this is *where an
          order reaches it*. Absent entirely on a chain, where the answer is
          per branch and the Branches tab asks it there.
        */}
        {sole && (
          <div className="flex flex-col gap-lg border-t border-border pt-xxl">
            <div className="flex flex-col gap-xxs">
              <h3 className="ps-md text-[17px]">{t("store.placeSection")}</h3>
              <p className="ps-md text-[12px] text-text-faint">
                {t("store.placeSectionHint")}
              </p>
            </div>

            <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
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
                    inputMode="text"
                  />
                </Field>

                <Field
                  label={t("branches.whatsapp")}
                  hint={t("branches.whatsappHint")}
                  error={errors.whatsapp}
                >
                  <PhoneInput value={whatsapp} onChange={setWhatsapp} />
                </Field>

                <Field
                  label={t("store.prep")}
                  hint={t("store.prepHint")}
                  error={errors.prep}
                >
                  <div className="flex flex-wrap items-center gap-sm">
                    <NumberInput
                      value={prepMin}
                      onChange={(event) => setPrepMin(event.target.value)}
                      min={0}
                      aria-label={t("store.prepMin")}
                      className="w-[92px]"
                    />
                    <span className="text-[14px] text-text-soft">
                      {t("store.prepTo")}
                    </span>
                    <NumberInput
                      value={prepMax}
                      onChange={(event) => setPrepMax(event.target.value)}
                      min={0}
                      aria-label={t("store.prepMax")}
                      className="w-[92px]"
                    />
                    <span className="text-[14px] text-text-soft">
                      {t("store.minutes")}
                    </span>
                  </div>
                </Field>
              </div>

              {/* The pin, drawn. A pair of numbers is not something anybody can
                  check by reading; a marker on a map is. */}
              <Map
                latitude={coordinates?.latitude ?? null}
                longitude={coordinates?.longitude ?? null}
                label={pickLocalized(name)}
                emptyKey="store.noPinYet"
                className="h-[240px] w-full rounded-md"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button onClick={() => void save()} pending={pending}>
          {t("store.save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * One of the two answers to a currency change, with what it does to a real
 * price.
 */
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
