"use client";

import Link from "next/link";
import { Archive, ChevronRight, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  FormError,
  Notice,
  Page,
  PageHeader,
  SaveBar,
  Section,
  Skeleton,
  Switch,
  TwoColumn,
  buttonClass,
  cx,
  type MenuItem as MenuAction,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { MultiSelect, Select } from "@/components/ui/select";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import {
  linePrice,
  PRICE_UNITS,
  SIZE_UNITS,
  sizeUnitKey,
  unitAmount,
  unitKey,
  type PriceUnit,
  type SizeUnit,
} from "@/lib/units";
import {
  validateLocalizedText,
  validatePrice,
  type Localized,
  type Valid,
} from "@/lib/validation";

import { usesMarkup } from "../api/earnings";
import type { Store } from "../api/stores";
import { useLiveBundlesWith } from "../use-bundles";
import { useShopEarnings, useShopStorePrices } from "../use-earnings";
import { MarkupPriceFields, useMarkupPrice } from "./markup-price-fields";
import { useItemOptionGroups } from "../use-options";
import { useTagVocabulary } from "../use-tags";
import { DishBranches } from "./dish-branches";
import { PerUnit, TagChip, optionsHref, unitSize } from "./shared";

export type DishDraft = {
  /**
   * The section it sits in. A field on the form, so a dish filed under the
   * wrong heading moves without being archived and typed again.
   */
  sectionId: string;
  name: Localized;
  description: Localized;
  /** Minor units, an integer — see `lib/money.ts`. */
  price: number;
  isActive: boolean;
  imageUrl: string | null;
  /** Both null for a dish sold as itself; `0095` refuses one without the other. */
  priceUnit: PriceUnit | null;
  unitQuantity: number | null;
  /** How far one press of the customer's + moves — `0119`. Null with no unit. */
  unitStep: number | null;
  /** Display-only, "900 g" (`0262`). Both null or both set. */
  sizeQuantity: number | null;
  sizeUnit: SizeUnit | null;
  /** Ids into the shared tag vocabulary, edited on the Tags page. */
  tagIds: string[];
  /**
   * What a markup shop is paid for it (`item_store_prices`, the shop's row).
   * Absent when it was not on screen or did not move; null removes it.
   */
  storePrice?: number | null;
};

/**
 * A dish, on a page of its own.
 *
 * ## The layout
 *
 * The form is a column of titled sections in the order a dish is thought
 * about — what it is, what it costs, how it is labelled, whether it is on sale,
 * and, once it exists, what each branch does and which questions it asks. A
 * preview sits beside it on a wide screen, so the price reads the way a
 * customer will read it ("$12.00 · 1 kg · $12.00/kg") while it is being typed.
 *
 * Save lives in a bar stuck to the bottom of the page, so it is in reach
 * however far down the form is, and it is disabled until something changed.
 *
 * ## No slug field
 *
 * A slug is a key nobody using the app sees; the database fills it from the
 * English name inside the insert's own transaction (0070), which is the only
 * way to make it unique without racing a second tab.
 */
export function DishEditor({
  storeId,
  store,
  itemId,
  sectionId,
  initial,
  sections,
  pending,
  error,
  onSave,
  onSaveAndAnother,
  onCancel,
  onArchive,
  onDuplicate,
  duplicateOf,
}: {
  storeId: string;
  store: Store | undefined;
  /** Null while the dish is being added. */
  itemId: string | null;
  /** Where it sits now, or the section whose Add was pressed. */
  sectionId: string;
  initial?: Partial<DishDraft>;
  /** The sections a dish may go in, named "Aisle › Sub-aisle". */
  sections: { id: string; title: Localized }[];
  pending: boolean;
  /** A refusal from the server — what belongs to no field. */
  error: string | null;
  onSave: (draft: DishDraft) => void;
  /** Absent when editing: "add another" only means something while adding. */
  onSaveAndAnother?: (draft: DishDraft) => void;
  onCancel: () => void;
  /** Absent while adding. */
  onArchive?: () => Promise<unknown>;
  /** Opens a new dish filled in from this one. Absent while adding. */
  onDuplicate?: () => void;
  /**
   * The name of the dish this new one was copied from. The form opens filled
   * in, so it counts as unsaved from the start — otherwise Save would wait
   * for an edit the copy may not need.
   */
  duplicateOf?: string;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  // A dish is priced in its shop's currency — not necessarily the base one —
  // so the decimals come from the shop's, or the box stays disabled.
  const { decimalsOf, format } = useMoney();
  const code = store?.currencyCode ?? "";
  const decimals = decimalsOf(code);
  const tags = useTagVocabulary();
  const inBundles = useLiveBundlesWith(storeId, itemId ?? "");
  // A store price matters only where something in the shop is on markup, so
  // the field is there only then (`0262`).
  const earnings = useShopEarnings(storeId);
  const markup = usesMarkup(earnings.data);
  const storePrices = useShopStorePrices(storeId, markup);
  const savedStorePrice = itemId
    ? (storePrices.data?.items.get(itemId) ?? null)
    : null;

  const opened = {
    section: sectionId,
    name: initial?.name ?? {},
    description: initial?.description ?? {},
    price: initial?.price ?? null,
    isActive: initial?.isActive ?? true,
    imageUrl: initial?.imageUrl ?? null,
    tagIds: initial?.tagIds ?? [],
    priceUnit: (initial?.priceUnit ?? "") as PriceUnit | "",
    unitQuantity:
      initial?.unitQuantity == null ? "" : String(initial.unitQuantity),
    unitStep: initial?.unitStep == null ? "" : String(initial.unitStep),
    sizeQuantity:
      initial?.sizeQuantity == null ? "" : String(initial.sizeQuantity),
    sizeUnit: (initial?.sizeUnit ?? "") as SizeUnit | "",
  };

  const [section, setSection] = useState(opened.section);
  const [name, setName] = useState<Localized>(opened.name);
  const [description, setDescription] = useState<Localized>(opened.description);
  const [price, setPrice] = useState<number | null>(opened.price);
  const [isActive, setIsActive] = useState(opened.isActive);
  const [imageUrl, setImageUrl] = useState<string | null>(opened.imageUrl);
  const [tagIds, setTagIds] = useState<string[]>(opened.tagIds);
  const [priceUnit, setPriceUnit] = useState<PriceUnit | "">(opened.priceUnit);
  /** A string while typed — `1.` is not a number and is valid so far. */
  const [unitQuantity, setUnitQuantity] = useState(opened.unitQuantity);
  /** Empty is a real answer: the whole-item stepper. */
  const [unitStep, setUnitStep] = useState(opened.unitStep);
  const [sizeQuantity, setSizeQuantity] = useState(opened.sizeQuantity);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit | "">(opened.sizeUnit);
  // On markup, the price is typed as the shop's plus ours (`markup-price`).
  const split = useMarkupPrice({
    active: markup,
    price,
    savedPrice: opened.price,
    savedStorePrice,
  });
  /** What customers pay — the sum on a split, the plain box otherwise. */
  const sellPrice = split.sellPrice;

  // Against what the form *opened with*, so a blank new dish (live by default)
  // is not unsaved the moment it appears.
  const dirty =
    Boolean(duplicateOf) ||
    changed(
      {
        section,
        name,
        description,
        price: sellPrice,
        isActive,
        imageUrl,
        tagIds,
        priceUnit,
        unitQuantity,
        unitStep,
        sizeQuantity,
        sizeUnit,
      },
      opened,
    ) ||
    split.moved;
  useUnsavedChanges(dirty);

  /** One message per field, every field checked — not a queue of round trips. */
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    price?: string;
    unit?: string;
    step?: string;
    size?: string;
  }>({});
  const [failed, setFailed] = useState(false);

  // After a failed save, take the operator to the first problem — scrolled to
  // and focused, so a screen reader lands on the control and reads its error.
  const form = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);
  useEffect(() => {
    if (attempt.current === 0) return;
    const first = form.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!first) return;
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    first.focus({ preventScroll: true });
  }, [errors]);

  function build(): DishDraft | null {
    // Both or neither — the pair `0095` enforces.
    const amount = unitQuantity.trim() === "" ? null : Number(unitQuantity);
    const step = unitStep.trim() === "" ? null : Number(unitStep);
    const unitProblem =
      priceUnit === ""
        ? undefined
        : amount === null || !Number.isFinite(amount)
          ? t("units.quantityRequired")
          : amount <= 0
            ? t("units.quantityPositive")
            : undefined;
    // Optional, but a typed step must move — `0119`'s CHECK refuses one that
    // cannot, and a Postgres error is not a sentence anybody can act on.
    const stepProblem =
      priceUnit === "" || step === null
        ? undefined
        : !Number.isFinite(step) || step <= 0
          ? t("units.stepPositive")
          : undefined;

    // Both or neither — `menu_items_size_whole` (`0262`).
    const size = sizeQuantity.trim() === "" ? null : Number(sizeQuantity);
    const sizeProblem =
      size === null && sizeUnit === ""
        ? undefined
        : size === null || sizeUnit === "" || !Number.isFinite(size)
          ? t("units.sizeBoth")
          : size <= 0
            ? t("units.sizePositive")
            : undefined;

    const found = {
      name: messageOf(validateLocalizedText(name, codes, TEXT.name)),
      description: messageOf(
        validateLocalizedText(description, codes, TEXT.description, {
          optional: true,
        }),
      ),
      price: split.problem ?? messageOf(validatePrice(sellPrice ?? NaN)),
      unit: unitProblem,
      step: stepProblem,
      size: sizeProblem,
    };

    setErrors(found);
    // Bumped every attempt, so two identical failures still scroll.
    attempt.current += 1;
    const bad = Object.values(found).some(Boolean);
    setFailed(bad);
    if (bad) return null;

    return {
      sectionId: section,
      name,
      description,
      price: sellPrice as number,
      isActive,
      imageUrl,
      tagIds,
      // Cleared together: `0095` and `0119` refuse the trio half set.
      priceUnit: priceUnit === "" ? null : priceUnit,
      unitQuantity: priceUnit === "" ? null : (amount as number),
      unitStep: priceUnit === "" ? null : step,
      sizeQuantity: sizeUnit === "" ? null : size,
      sizeUnit: sizeUnit === "" ? null : sizeUnit,
      ...(split.storePriceMoved && { storePrice: split.nextStorePrice }),
    };
  }

  /**
   * The stepper, spelled out with what each press costs — from `unitAmount`
   * and `linePrice`, the app's own arithmetic, so what is read here is what
   * the phone will do. Three stops show the pattern.
   */
  const stepPreview = (() => {
    if (priceUnit === "") return null;
    const quantity = Number(unitQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    const word = t(unitKey(priceUnit));
    const typedStep = unitStep.trim() === "" ? null : Number(unitStep);
    if (typedStep !== null && (!Number.isFinite(typedStep) || typedStep <= 0)) {
      return null;
    }
    if (typedStep === null) {
      return t("units.stepPreviewNone", {
        size: t("units.size", { quantity, unit: word }),
      });
    }
    const unit = { unit: priceUnit, quantity, step: typedStep };
    const chain = [1, 2, 3]
      .map((press) => {
        const size = t("units.size", {
          quantity: unitAmount(unit, press),
          unit: word,
        });
        if (sellPrice === null || code === "") return size;
        return t("units.stepPreviewStop", {
          size,
          price: format(linePrice(sellPrice, 0, unit, press), code),
        });
      })
      .join(" → ");
    return t("units.stepPreview", { chain });
  })();

  const [archiving, setArchiving] = useState(false);
  const title = pickLocalized(name) || t("menu.newItem");
  const sectionName = pickLocalized(
    sections.find((one) => one.id === section)?.title ?? {},
  );
  const shopName = store ? pickLocalized(store.name) : "";

  // Typed as said — `18.75`, not `1875`. `null` decimals until the shop's
  // currency lands, which disables the box rather than guessing whether 3
  // means 3 or 300.
  const priceField = (
    <Field
      label={t("menu.price")}
      hint={t("menu.priceHint")}
      error={split.plain ? errors.price : undefined}
      className="sm:max-w-xs"
    >
      {(field) => (
        <MoneyInput
          {...field}
          value={price}
          onChange={setPrice}
          decimalDigits={decimals}
          placeholder={t("menu.pricePlaceholder")}
        />
      )}
    </Field>
  );

  const visibilityHint = isActive
    ? t("menu.liveHint")
    : inBundles.length > 0
      ? t("menu.hiddenInBundlesHint", { bundles: inBundles.join(", ") })
      : t("menu.hiddenHint");

  return (
    <Page>
      <PageHeader
        title={itemId ? title : t("menu.newItem")}
        description={
          itemId
            ? t("menu.pageDescription", {
                shop: shopName,
                section: sectionName,
              })
            : duplicateOf
              ? t("menu.pageDuplicateDescription", {
                  name: duplicateOf,
                  shop: shopName,
                  section: sectionName,
                })
              : t("menu.pageNewDescription", {
                  shop: shopName,
                  section: sectionName,
                })
        }
        meta={
          itemId && !opened.isActive ? <Badge>{t("menu.hidden")}</Badge> : null
        }
        more={
          onArchive
            ? [
                ...(onDuplicate
                  ? ([
                      {
                        label: t("menu.duplicate"),
                        icon: <Copy />,
                        onSelect: onDuplicate,
                      },
                      "separator",
                    ] satisfies MenuAction[])
                  : []),
                {
                  label: t("menu.archiveDish"),
                  icon: <Archive />,
                  tone: "danger",
                  onSelect: () => setArchiving(true),
                },
              ]
            : undefined
        }
      />

      {/*
        The record layout Shopify uses for a product: what the dish *is* in the
        wide column — words, picture, price, questions, branches — and the
        short facts about it in the narrow one: whether it is on sale, where it
        is filed, how it is labelled, and how it will read.
      */}
      <div ref={form}>
        <TwoColumn
          main={
            <>
              {(error || failed) && (
                <FormError>{error ?? t("menu.fixErrors")}</FormError>
              )}
              {duplicateOf && <Notice>{t("menu.duplicateNote")}</Notice>}

              <Section
                title={t("menu.basics")}
                description={t("menu.basicsHint")}
              >
                <div className="flex flex-col gap-5">
                  <LocalizedField
                    label={t("menu.name")}
                    value={name}
                    onChange={setName}
                    placeholder={{
                      en: t("menu.namePlaceholder"),
                      ar: t("menu.namePlaceholderAr"),
                    }}
                    hint={t("menu.nameHint")}
                    error={errors.name}
                    maxLength={TEXT.name}
                    filter="title"
                  />
                  <LocalizedField
                    label={t("menu.description")}
                    value={description}
                    onChange={setDescription}
                    placeholder={{
                      en: t("menu.descriptionPlaceholder"),
                      ar: t("menu.descriptionPlaceholderAr"),
                    }}
                    multiline
                    optional
                    hint={t("menu.descriptionHint")}
                    error={errors.description}
                    maxLength={TEXT.description}
                    filter="name"
                  />
                  {/* Display-only (`0262`): "900 g" under the name. "Sold by"
                      below is what prices and counts it. */}
                  <Field
                    label={t("units.sizeLabel")}
                    hint={t("units.sizeHint")}
                    error={errors.size}
                    optional={t("form.optional")}
                  >
                    <div className="grid gap-2 sm:max-w-sm sm:grid-cols-2">
                      <NumberInput
                        value={sizeQuantity}
                        onChange={(event) =>
                          setSizeQuantity(event.target.value)
                        }
                        min={0}
                        step="any"
                        placeholder={t("units.sizeAmount")}
                        aria-label={t("units.sizeAmount")}
                        invalid={Boolean(errors.size)}
                      />
                      <Select
                        value={sizeUnit}
                        aria-label={t("units.sizeUnit")}
                        onChange={(value) => {
                          setSizeUnit(value as SizeUnit | "");
                          if (!value) setSizeQuantity("");
                        }}
                        placeholder={t("units.sizeNone")}
                        isClearable
                        options={SIZE_UNITS.map((unit) => ({
                          value: unit,
                          label: t(sizeUnitKey(unit)),
                        }))}
                      />
                    </div>
                  </Field>
                </div>
              </Section>

              {/* Optional (0153): without one, the app draws its placeholder. */}
              <Section title={t("menu.media")}>
                <Field
                  label={t("images.label")}
                  hint={t("images.hint")}
                  optional={t("form.optional")}
                >
                  {(field) => (
                    <ImageUploader
                      {...field}
                      value={imageUrl}
                      onChange={setImageUrl}
                      folder="menu-items"
                      photo="dish"
                      disabled={pending}
                    />
                  )}
                </Field>
              </Section>

              <Section
                title={t("menu.priceSection")}
                description={t("menu.priceSectionHint")}
              >
                <div className="flex flex-col gap-5">
                  {markup ? (
                    // On markup: the shop's price and ours, and what that
                    // makes in the app. The plain box only while both are
                    // empty — a dish with no price from the shop yet.
                    <MarkupPriceFields
                      entry={split.entry}
                      onChange={split.setEntry}
                      decimals={decimals}
                      disabled={itemId !== null && !storePrices.isSuccess}
                      error={split.plain ? undefined : errors.price}
                      appPrice={
                        sellPrice !== null && code
                          ? format(sellPrice, code)
                          : null
                      }
                    />
                  ) : (
                    priceField
                  )}

                  <Field
                    label={t("units.label")}
                    hint={
                      priceUnit === "" ? t("units.hint") : t("units.stepHint")
                    }
                    error={errors.unit ?? errors.step}
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={priceUnit}
                        aria-label={t("units.label")}
                        onChange={(value) => {
                          setPriceUnit(value as PriceUnit | "");
                          // Cleared together — an amount left on a dish with
                          // no unit is a number nothing reads, and the CHECKs
                          // refuse it.
                          if (!value) {
                            setUnitQuantity("");
                            setUnitStep("");
                          }
                        }}
                        placeholder={t("units.none")}
                        isClearable
                        options={PRICE_UNITS.map((unit) => ({
                          value: unit,
                          label: t(unitKey(unit)),
                        }))}
                      />
                      {priceUnit !== "" && (
                        <>
                          <NumberInput
                            value={unitQuantity}
                            onChange={(event) =>
                              setUnitQuantity(event.target.value)
                            }
                            min={0}
                            step="any"
                            placeholder={t("units.quantity")}
                            aria-label={t("units.quantity")}
                            invalid={Boolean(errors.unit)}
                          />
                          <NumberInput
                            value={unitStep}
                            onChange={(event) =>
                              setUnitStep(event.target.value)
                            }
                            min={0}
                            step="any"
                            placeholder={t("units.step")}
                            aria-label={t("units.step")}
                            invalid={Boolean(errors.step)}
                          />
                        </>
                      )}
                    </div>
                  </Field>
                  {stepPreview && (
                    <p className="-mt-2 rounded-md bg-subtle px-3 py-2 text-[12.5px] text-ink-2 tabular-nums">
                      {stepPreview}
                    </p>
                  )}
                </div>
              </Section>

              <Section
                title={t("menu.optionsSection")}
                description={t("menu.optionsSectionHint")}
                actions={
                  itemId ? (
                    <Link
                      href={optionsHref(storeId, {
                        sectionId: opened.section,
                        itemId,
                      })}
                      className={buttonClass({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      {t("menu.optionsManage")}
                      <ChevronRight className="rtl:rotate-180" />
                    </Link>
                  ) : null
                }
              >
                {itemId ? (
                  <DishOptions itemId={itemId} />
                ) : (
                  <p className="text-[13.5px] text-ink-3">
                    {t("options.saveFirst")}
                  </p>
                )}
              </Section>

              <Section
                title={t("menu.branchesSection")}
                description={t("menu.branchesSectionHint")}
              >
                {itemId ? (
                  <DishBranches
                    storeId={storeId}
                    itemId={itemId}
                    sectionId={opened.section}
                    shopPrice={opened.price ?? 0}
                    shopCode={code}
                  />
                ) : (
                  <p className="text-[13.5px] text-ink-3">
                    {t("menu.branchesSaveFirst")}
                  </p>
                )}
              </Section>
            </>
          }
          aside={
            <>
              <Section title={t("menu.status")}>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  label={t("menu.showInApp")}
                  description={visibilityHint}
                />
              </Section>

              <Section title={t("menu.organisation")}>
                <div className="flex flex-col gap-5">
                  <Field label={t("menu.section")} hint={t("menu.sectionHint")}>
                    {(field) => (
                      <Select
                        {...field}
                        value={section}
                        // Not clearable, but a select can hand back "" — and
                        // a dish with no section is not a state the column
                        // allows.
                        onChange={(value) => value && setSection(value)}
                        disabled={pending}
                        options={sections.map((one) => ({
                          value: one.id,
                          label: pickLocalized(one.title),
                        }))}
                      />
                    )}
                  </Field>
                  <Field
                    label={t("tags.itemLabel")}
                    hint={
                      tags.isSuccess && tags.data.length === 0
                        ? t("tags.itemNone")
                        : t("tags.itemHint")
                    }
                  >
                    {(field) => (
                      <MultiSelect
                        {...field}
                        value={tagIds}
                        onChange={setTagIds}
                        placeholder={t("tags.itemPlaceholder")}
                        disabled={pending || !tags.isSuccess}
                        options={(tags.data ?? []).map((tag) => ({
                          value: tag.id,
                          label: pickLocalized(tag.name),
                          render: (
                            <TagChip
                              label={pickLocalized(tag.name)}
                              iconUrl={tag.iconUrl}
                            />
                          ),
                        }))}
                      />
                    )}
                  </Field>
                </div>
              </Section>

              <Preview
                name={pickLocalized(name)}
                description={pickLocalized(description)}
                imageUrl={imageUrl}
                price={sellPrice}
                code={code}
                shopRate={store?.exchangeRate ?? null}
                unit={{
                  priceUnit: priceUnit === "" ? null : priceUnit,
                  unitQuantity:
                    unitQuantity.trim() === "" ? null : Number(unitQuantity),
                  unitStep: unitStep.trim() === "" ? null : Number(unitStep),
                }}
                tags={(tags.data ?? []).filter((tag) =>
                  tagIds.includes(tag.id),
                )}
                isActive={isActive}
                size={
                  sizeUnit !== "" &&
                  Number.isFinite(Number(sizeQuantity)) &&
                  Number(sizeQuantity) > 0
                    ? t("units.size", {
                        quantity: Number(sizeQuantity),
                        unit: t(sizeUnitKey(sizeUnit)),
                      })
                    : ""
                }
              />
            </>
          }
        />
      </div>

      <SaveBar dirty={dirty}>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        {onSaveAndAnother && (
          <Button
            variant="secondary"
            pending={pending}
            disabled={!dirty}
            onClick={() => {
              const draft = build();
              if (draft) onSaveAndAnother(draft);
            }}
          >
            {t("menu.saveAndAnother")}
          </Button>
        )}
        <Button
          variant="primary"
          pending={pending}
          disabled={!dirty}
          onClick={() => {
            const draft = build();
            if (draft) onSave(draft);
          }}
        >
          {t("menu.save")}
        </Button>
      </SaveBar>

      {onArchive && (
        <ConfirmDialog
          open={archiving}
          onOpenChange={setArchiving}
          title={t("menu.archiveTitle")}
          description={t(
            inBundles.length > 0
              ? "menu.archiveInBundlesBody"
              : "menu.archiveBody",
            { bundles: inBundles.join(", ") },
          )}
          confirmLabel={t("menu.archiveConfirm")}
          tone="danger"
          onConfirm={onArchive}
        />
      )}
    </Page>
  );
}

/** The dish's questions, summarised — they are edited on the Options tab. */
function DishOptions({ itemId }: { itemId: string }) {
  const groups = useItemOptionGroups(itemId);
  if (groups.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }
  const rows = (groups.data ?? []).filter((group) => group.isActive);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px] text-ink-2">{t("menu.optionsNone")}</p>
        <p className="text-[12.5px] text-ink-3">
          {t("menu.optionsManageHint")}
        </p>
      </div>
    );
  }
  return (
    <ul className="-my-2 divide-y divide-line">
      {rows.map((group) => (
        <li key={group.id} className="flex flex-col gap-0.5 py-2.5">
          <span className="text-[14px] font-medium text-ink">
            {pickLocalized(group.title)}
          </span>
          <span className="text-[12.5px] text-ink-3">
            {[
              t(
                group.mode === "single"
                  ? "options.chooseOne"
                  : "options.chooseAny",
              ),
              t(
                group.minSelections >= 1
                  ? "options.required"
                  : "options.optional",
              ),
              group.options
                .filter((option) => option.isActive)
                .map((option) => pickLocalized(option.name))
                .join(", "),
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Roughly how the dish reads on the menu, as it is typed. */
function Preview({
  name,
  description,
  imageUrl,
  price,
  code,
  shopRate,
  unit,
  tags,
  isActive,
  size: displaySize,
}: {
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  code: string;
  shopRate: number | null;
  unit: {
    priceUnit: PriceUnit | null;
    unitQuantity: number | null;
    unitStep: number | null;
  };
  tags: { id: string; name: Localized; iconUrl: string | null }[];
  isActive: boolean;
  /** The display-only size, "900 g", or empty. */
  size: string;
}) {
  const size = unitSize(unit);
  let body: ReactNode = null;
  if (price !== null && code) {
    body = (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Price
          value={price}
          code={code}
          shopRate={shopRate}
          className="text-[15px] font-semibold text-ink tabular-nums"
        />
        {size && <span className="text-[13px] text-ink-3">{size}</span>}
        <PerUnit item={{ price, ...unit }} code={code} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[13px] font-semibold text-ink">
          {t("menu.preview")}
        </h2>
        {!isActive && <Badge>{t("menu.hidden")}</Badge>}
      </div>
      <div
        className={cx(
          "overflow-hidden rounded-lg border border-line bg-surface shadow-xs",
          !isActive && "opacity-60",
        )}
      >
        <div className="flex aspect-[4/3] items-center justify-center bg-subtle">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[12px] text-ink-4">{t("images.label")}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <p
            className={cx(
              "text-[15px] font-semibold",
              name ? "text-ink" : "text-ink-4",
            )}
          >
            {name || t("menu.previewName")}
          </p>
          {displaySize && (
            <p className="text-[12.5px] text-ink-3 tabular-nums">
              {displaySize}
            </p>
          )}
          {description && (
            <p className="line-clamp-2 text-[13px] text-ink-3">{description}</p>
          )}
          {tags.length > 0 && (
            <span className="flex flex-wrap gap-x-2.5 gap-y-1">
              {tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  label={pickLocalized(tag.name)}
                  iconUrl={tag.iconUrl}
                />
              ))}
            </span>
          )}
          {body}
        </div>
      </div>
      <p className="px-1 text-[12px] text-ink-4">{t("menu.previewHint")}</p>
    </div>
  );
}

/** A failure's sentence, or nothing when it passed. */
function messageOf(result: Valid): string | undefined {
  return result.ok ? undefined : t(result.key, result.params);
}
