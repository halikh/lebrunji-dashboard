"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
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
import { digitsOf } from "@/lib/phone";
import {
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

import type { Branch, BranchDraft } from "./api/branches";
import type { CurrencyChangeMode, Store } from "./api/stores";
import { ShopFields, useSaveShop } from "./shop-fields";
import { ShopLine, StoreFacts, StoreThumb } from "./store-identity";
import { useBranches, useCreateBranch, useUpdateBranch } from "./use-branches";
import { useStore } from "./use-stores";

/**
 * One branch, on a page of its own.
 *
 * ## Why it is no longer a panel
 *
 * This is the widest form in the dashboard: the shop's own name and currency,
 * this place's name, its picture, its pin on a map, a phone number and a prep
 * window. In 420pt the map was a postage stamp and the currency warning wrapped
 * to four lines.
 *
 * What the panel gave and a page has to be told to give back is the list
 * position: Back and Cancel return `?focus=<id>`, and the row scrolls into
 * view. See `useRowFocus`.
 */
export function BranchEditorScreen({
  storeId,
  branchId,
}: {
  storeId: string;
  branchId: string | null;
}) {
  const router = useRouter();

  const store = useStore(storeId);
  const branches = useBranches(storeId);
  const rows = branches.data ?? [];
  const initial = branchId
    ? (rows.find((row) => row.id === branchId) ?? null)
    : null;

  const create = useCreateBranch(storeId);
  const update = useUpdateBranch(storeId);

  const listHref = `/catalogue/${storeId}?tab=branches`;
  const backHref = branchId ? `${listHref}&focus=${branchId}` : listHref;
  const leave = () => router.replace(backHref);

  if (branchId && !initial) {
    return (
      <EditorPage
        title={t("branches.edit")}
        backHref={listHref}
        backLabel={t("branches.tab")}
      >
        {branches.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <p className="text-[14px] text-text-soft">{t("branches.notFound")}</p>
        )}
      </EditorPage>
    );
  }

  return (
    <BranchEditor
      // Keyed on the row, so arriving at a second branch starts from the one
      // that was clicked rather than resuming the other's half-typed pin.
      key={initial?.id ?? "new"}
      initial={initial}
      store={store.data ?? null}
      title={initial ? pickLocalized(initial.name) : t("branches.add")}
      backHref={backHref}
      pending={create.isPending || update.isPending}
      onCancel={leave}
      onSave={(draft) => {
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name: pickLocalized(draft.name) },
            { onSuccess: leave },
          );
        } else {
          create.mutate(
            { draft, sortOrder: rows.length },
            { onSuccess: leave },
          );
        }
      }}
    />
  );
}

function BranchEditor({
  initial,
  store,
  title,
  backHref,
  pending,
  onSave,
  onCancel,
}: {
  initial: Branch | null;
  /**
   * The shop this branch belongs to, or null while it is still loading.
   *
   * The panel edits it — see `ShopFields` — and the branch's own picture and
   * currency are shown against it, because both fall back to it. Null only
   * happens on the first paint, and the section simply is not drawn until the
   * row arrives rather than rendering empty fields somebody could type into.
   */
  store: Store | null;
  /** The branch's name, or "Add a branch". */
  title: string;
  backHref: string;
  pending: boolean;
  onSave: (draft: BranchDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const shop = useSaveShop();
  const { currencies } = useMoney();

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [whatsapp, setWhatsapp] = useState(initial?.whatsappPhone ?? "");
  const [prepMin, setPrepMin] = useState(String(initial?.prepMinMinutes ?? 10));
  const [prepMax, setPrepMax] = useState(String(initial?.prepMaxMinutes ?? 20));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [pin, setPin] = useState(
    initial && initial.latitude !== null && initial.longitude !== null
      ? `${initial.latitude}, ${initial.longitude}`
      : "",
  );
  /**
   * This branch's own picture and currency — null for "the shop's".
   *
   * Null rather than the shop's values copied in, on both. A form that
   * pre-filled them would save a copy the moment anything else on the panel
   * changed, quietly turning a branch that follows the brand into one that no
   * longer does. See the note on `Branch`.
   */
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [currencyCode, setCurrencyCode] = useState<string | null>(
    initial?.currencyCode ?? null,
  );

  /** The shop's own answers, edited in the same panel and saved first. */
  const [shopName, setShopName] = useState<Localized>(store?.name ?? {});
  const [shopCategory, setShopCategory] = useState(store?.categoryId ?? "");
  const [shopCurrency, setShopCurrency] = useState(store?.currencyCode ?? "");
  // The shop's, not this branch's — see the note beside the control.
  const [shopFeatured, setShopFeatured] = useState(store?.isFeatured ?? false);
  /**
   * The shop's own rate, as typed. Empty is the platform's — `0120`.
   *
   * A string, like every other number in a form here: `95000.` is not a number
   * and is perfectly valid halfway through typing one.
   */
  const [shopRate, setShopRate] = useState(
    store?.exchangeRate == null ? "" : String(store.exchangeRate),
  );
  /**
   * What a currency change is *for*, defaulted to the common case.
   *
   * `keep` is the wrong-pick fix and is what almost every change will be.
   * `convert` is a shop genuinely re-denominating, which happens once if ever —
   * so it is the deliberate choice rather than the one you land on.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");

  const [errors, setErrors] = useState<{
    shopRate?: string;
    name?: string;
    shopName?: string;
    prep?: string;
    whatsapp?: string;
    pin?: string;
  }>({});

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `shopCurrency` first — which is compared.
  useUnsavedChanges(
    changed(
      {
        name,
        whatsapp,
        prepMin,
        prepMax,
        isActive,
        pin,
        imageUrl,
        currencyCode,
        shopName,
        shopCategory,
        shopCurrency,
        shopFeatured,
        shopRate,
      },
      {
        name: initial?.name ?? {},
        whatsapp: initial?.whatsappPhone ?? "",
        prepMin: String(initial?.prepMinMinutes ?? 10),
        prepMax: String(initial?.prepMaxMinutes ?? 20),
        isActive: initial?.isActive ?? true,
        pin:
          initial && initial.latitude !== null && initial.longitude !== null
            ? `${initial.latitude}, ${initial.longitude}`
            : "",
        imageUrl: initial?.imageUrl ?? null,
        currencyCode: initial?.currencyCode ?? null,
        shopName: store?.name ?? {},
        shopCategory: store?.categoryId ?? "",
        shopCurrency: store?.currencyCode ?? "",
        shopFeatured: store?.isFeatured ?? false,
        shopRate: store?.exchangeRate == null ? "" : String(store.exchangeRate),
      },
    ),
  );

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  async function save() {
    const min = Number(prepMin);
    const max = Number(prepMax);

    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(min, max);
    const phoneCheck = validatePhone(digitsOf(whatsapp));
    // Only when the shop is loaded. Nothing can have been typed into a section
    // that was not drawn, so an absent store is not an empty name.
    const shopNameCheck = store
      ? validateLocalizedText(shopName, codes, TEXT.name)
      : null;

    // Empty is the answer most shops give — the platform's rate — so it is
    // not a failure. What is refused is a number typed and unusable: `0120`'s
    // CHECK would turn that into a Postgres error the operator cannot read,
    // and the app would fall back to the platform's rate anyway, which looks
    // like the field being ignored.
    const rateTyped = shopRate.trim() !== "";
    const rateValue = Number(shopRate);
    const rateProblem =
      rateTyped && (!Number.isFinite(rateValue) || rateValue <= 0)
        ? t("store.ratePositive")
        : undefined;

    const found = {
      shopRate: rateProblem,
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      shopName:
        !shopNameCheck || shopNameCheck.ok
          ? undefined
          : t(shopNameCheck.key, shopNameCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      /*
       * Required now, where it used to be optional.
       *
       * The old reasoning was that a branch is often added before anybody has
       * been given its number, and that is true — but what it bought was a
       * branch that is *listed and takes orders* with nowhere for an order to
       * go. The order is placed, the customer is told the kitchen has it, and
       * nothing arrives at a kitchen. Asked for at creation, the cost is one
       * phone call before the branch goes live; left optional, the cost is an
       * order.
       */
      whatsapp:
        whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phoneCheck.ok
            ? undefined
            : t(phoneCheck.key, phoneCheck.params),
      /*
       * Required too, and for money rather than for tidiness.
       *
       * `delivery_fee_for_km` charges an unknown distance at the **top band**,
       * so an unpinned branch does not fail to quote — it quotes the most
       * expensive answer there is, on every order, silently. That is the
       * failure `no-pin-warning.tsx` exists to shout about after the fact; this
       * is the same fact asked before it can happen.
       */
      pin: located.ok
        ? undefined
        : located.reason === "empty"
          ? t("branches.pinRequired")
          : located.reason === "shortened"
            ? t("store.pinShortened")
            : t("store.pinInvalid"),
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    /*
     * The shop first, and only what moved.
     *
     * Its currency rewrites every price in the shop and has to be atomic on its
     * own, so it cannot be folded into the branch's write — see `useSaveShop`.
     * Going first means a failure stops before the branch is touched: the
     * reverse order would leave a branch saved against a shop whose prices did
     * not move, which is a screen and a database disagreeing about money.
     */
    if (
      store &&
      !(await shop.saveShop(store, {
        name: shopName,
        categoryId: shopCategory,
        currencyCode: shopCurrency,
        isFeatured: shopFeatured,
        // Empty is null, which is what puts the shop back on the platform's
        // rate — not zero, which `0120` refuses and which would read as a shop
        // quoting nothing per dollar.
        exchangeRate: shopRate.trim() === "" ? null : Number(shopRate),
        mode,
      }))
    ) {
      return;
    }

    // The pin and the number are checked above, so their fallbacks are
    // unreachable — they are here because the columns are still nullable in the
    // database and the types say so. See `requireTradeable` in the branch API
    // for where that is enforced on every path.
    onSave({
      name,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      prepMinMinutes: min,
      prepMaxMinutes: max,
      whatsappPhone: whatsapp.trim(),
      imageUrl,
      currencyCode,
      isActive,
    });
  }

  return (
    <EditorPage
      title={title}
      backHref={backHref}
      backLabel={t("branches.tab")}
      /**
       * Who this branch belongs to, said the way the shop page says it.
       *
       * The page opened on a back link and a name, and a branch's name is very
       * often the shop's — so "Nara Kitchen" under "Branches" answered neither
       * *which shop* nor *which branch of it*. The picture, the shop's name and
       * its category-and-phone line are exactly what the shop page above shows,
       * which is what makes the two read as one object.
       *
       * The picture resolves the way the form's own uploader does: this
       * branch's, or the shop's when it follows the brand.
       */
      media={
        store ? (
          <StoreThumb
            store={imageUrl ? { ...store, imageUrl } : store}
            className="size-[46px] rounded-md"
          />
        ) : undefined
      }
      meta={store ? <ShopLine store={store} /> : undefined}
      aside={store ? <StoreFacts store={store} /> : undefined}
      /* Two columns' worth of room — see the grid below, and `EditorPage`. */
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} pending={pending || shop.pending}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      {/* The brand first, then this place. Anything typed here changes the
          shop and every branch of it, which is why the section says so. */}
      {store && (
        <>
          <ShopFields
            store={store}
            name={shopName}
            onName={setShopName}
            nameError={errors.shopName}
            categoryId={shopCategory}
            onCategoryId={setShopCategory}
            currencyCode={shopCurrency}
            onCurrencyCode={setShopCurrency}
            isFeatured={shopFeatured}
            onIsFeatured={setShopFeatured}
            exchangeRate={shopRate}
            onExchangeRate={setShopRate}
            exchangeRateError={errors.shopRate}
            mode={mode}
            onMode={setMode}
          />

          <hr className="border-border" />

          <div className="flex flex-col gap-xxs">
            <h3 className="ps-md text-[17px]">{t("branches.branchSection")}</h3>
            <p className="ps-md text-[12px] text-text-faint">
              {t("branches.branchSectionHint")}
            </p>
          </div>
        </>
      )}

      {/**
       * Two equal columns on a wide screen, one on a narrow one.
       *
       * The shop's section above stays full width, because it is about a
       * different record and a rule closes it — splitting *that* would read as
       * two shops rather than as one shop and its branch.
       *
       * Below it the split is what a branch is made of. On the left, **who it
       * is**: its name and its picture. On the right, **where it is and how it
       * works**: the pin, the map, the prep window, the number an order goes to,
       * the currency and whether it is live.
       *
       * The map is the reason this page wanted the width in the first place —
       * the note at the top of this file records it being a postage stamp in a
       * 420pt panel, and a 640pt column was not much better.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <LocalizedField
            label={t("branches.name")}
            hint={t("branches.nameHint")}
            value={name}
            onChange={setName}
            placeholder={{ en: t("branches.namePlaceholder"), ar: "الحمرا" }}
            error={errors.name}
            maxLength={TEXT.name}
          />

          {/*
        This branch's own picture, or the shop's.

        The uploader is handed the resolved value, so the box is never empty
        while the shop has a photograph — what an operator sees is what a
        customer sees. Clearing it puts the branch back to following the shop
        rather than to showing nothing, which is what `Remove` means here and
        what the hint says.
      */}
          <Field
            label={t("images.label")}
            hint={
              imageUrl
                ? t("branches.imageOwnHint")
                : t("branches.imageSharedHint")
            }
          >
            <ImageUploader
              value={imageUrl ?? store?.imageUrl ?? null}
              onChange={setImageUrl}
              folder="stores"
              disabled={pending}
            />
          </Field>

          {/*
        And its currency, which is the same idea and is money.

        The empty option is not a blank — it is "the same as the shop", named
        with the shop's code in it so the consequence of leaving it alone is
        on screen. `0110` resolves `coalesce(branch, store)` on the side that
        quotes *and* the side that charges, so a value picked here is what the
        customer pays in.
      */}
          <Field
            label={t("branches.currency")}
            hint={t("branches.currencyHint")}
          >
            <Select
              value={currencyCode ?? ""}
              onChange={(next) => setCurrencyCode(next || null)}
              options={[
                {
                  value: "",
                  label: t("branches.currencySame", {
                    code: shopCurrency || store?.currencyCode || "",
                  }),
                },
                ...(currencies ?? []).map((one) => ({
                  value: one.code,
                  label: one.code,
                })),
              ]}
            />
          </Field>

          {/* The number is a fact about this *place* — which kitchen an order
              lands in — so it belongs beside the branch's own name, picture and
              currency rather than in the column about where it is on a map.

              It also balances the two. The right column carries a 260pt map, so
              the left ran out of fields halfway down and left a screen of empty
              beside it; this is the field that fills it. The store form makes
              the same move for the same reason. */}
          <Field
            label={t("branches.whatsapp")}
            hint={t("branches.whatsappHint")}
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
            label={t("branches.pin")}
            hint={t("branches.pinHint")}
            error={errors.pin}
          >
            <Input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="33.8938, 35.5018"
              inputMode="text"
            />
          </Field>

          <Map
            latitude={coordinates?.latitude ?? null}
            longitude={coordinates?.longitude ?? null}
            label={pickLocalized(name)}
            emptyKey="store.noPinYet"
            className="h-[200px] w-full rounded-md"
          />

          <Field
            label={t("branches.prep")}
            hint={t("branches.prepHint")}
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

          <Field
            label={t("branches.visibility")}
            hint={isActive ? t("branches.liveHint") : t("branches.hiddenHint")}
          >
            <Toggle
              on={isActive}
              onChange={() => setIsActive((current) => !current)}
              labelOn={t("branches.live")}
              labelOff={t("branches.hidden")}
            />
          </Field>
        </div>
      </div>
    </EditorPage>
  );
}
