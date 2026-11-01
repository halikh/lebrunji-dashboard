"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, Field } from "@/components/ui";
import { DateField } from "@/components/ui/date-field";
import { EditorPage } from "@/components/ui/editor-page";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldPair, FormSection } from "@/components/ui/form-section";
import { PreviewImage } from "@/components/ui/image-preview";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import {
  AsyncMultiSelect,
  MultiSelect,
  Select,
  type SelectOption,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import {
  fetchBundleBranchPrices,
  searchBundleDishes,
  separatePrice,
  type Bundle,
  type BundleDraft,
  type BundleItem,
} from "./api/bundles";
import { fetchStoreQuestions, type StoreQuestion } from "./api/options";
import { useArtworks } from "./use-artworks";
import { useBranches } from "./use-branches";
import {
  bundleKeys,
  useBundles,
  useCreateBundle,
  useUpdateBundle,
} from "./use-bundles";
import { optionKeys } from "./use-options";
import { useStores } from "./use-stores";

/**
 * A bundle's list is its shop's Bundles tab (user, 2026-11-02): bundles are a
 * shop's, so they live on the shop's screen and nowhere else.
 */
const listOf = (storeId: string) => `/catalogue/${storeId}?tab=bundles`;

/** The most of one dish a bundle may hold — `bundle_items_quantity_sane`. */
const MAX_QUANTITY = 20;

/**
 * One bundle, on a page of its own — the same frame as `PromotionEditor`.
 *
 * The main column is the bundle as the customer sees it: the shop, its name
 * and picture, what is in it, and what it costs — at the brand price and at
 * each branch that charges otherwise. The side column is what the operator
 * checks: the saving, when it is on offer, and the pictures that advertise it.
 */
export function BundleEditor({
  id,
  fromStoreId = null,
}: {
  id: string | null;
  /** Opened from a shop's Bundles tab: a new one starts on it, and Back returns there. */
  fromStoreId?: string | null;
}) {
  const router = useRouter();

  const bundles = useBundles("");
  const rows = bundles.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  // The shop it came from, else the bundle's own — say, opened from a link on
  // a picture. The catalogue when neither is known yet.
  const shopId = fromStoreId ?? initial?.storeId ?? null;
  const listHref = shopId ? listOf(shopId) : "/catalogue";

  const create = useCreateBundle();
  const update = useUpdateBundle();

  /** What each branch charges now — read before the form mounts, as `WithDishes` waits. */
  const branchPrices = useQuery({
    queryKey: bundleKeys.branchPrices(id ?? ""),
    queryFn: () => fetchBundleBranchPrices(id!),
    enabled: Boolean(id),
  });

  /** Back to the shop's list — a new bundle's shop is the one it was saved on. */
  const back = (focusId: string | null, storeId: string | null = shopId) => {
    if (!storeId) {
      router.replace("/catalogue");
      return;
    }
    const focus = focusId ? `&focus=${focusId}` : "";
    router.replace(`${listOf(storeId)}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("bundles.edit")}
        backHref={listHref}
        backLabel={t("bundles.tab")}
      >
        {bundles.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="bundles.notFound" mood="lost" />
        )}
      </EditorPage>
    );
  }

  if ((id && branchPrices.isPending) || (!id && bundles.isPending)) {
    return (
      <div className="flex flex-1 items-center justify-center p-lg md:p-xxl text-[13px] text-text-faint">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      initialBranchPrices={branchPrices.data ?? {}}
      startStoreId={fromStoreId}
      listHref={listHref}
      pending={create.isPending || update.isPending}
      onSave={(draft, changes, questions) => {
        const done = (focusId: string | null) => back(focusId);
        if (initial) {
          update.mutate(
            { id: initial.id, draft, branchPrices: changes, questions },
            { onSuccess: () => done(initial.id) },
          );
        } else {
          create.mutate(
            { draft, sortOrder: rows.length, branchPrices: changes, questions },
            { onSuccess: (newId) => back(newId, draft.storeId) },
          );
        }
      }}
      onCancel={() => back(initial?.id ?? null)}
    />
  );
}

function Form({
  initial,
  initialBranchPrices,
  startStoreId,
  listHref,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Bundle;
  initialBranchPrices: Record<string, number>;
  startStoreId: string | null;
  listHref: string;
  pending: boolean;
  onSave: (
    draft: BundleDraft,
    branchPrices: Record<string, number | null>,
    questions: { wanted: string[]; current: string[] } | null,
  ) => void;
  onCancel: () => void;
}) {
  const { format, decimalsOf } = useMoney();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const stores = useStores("");

  const [storeId, setStoreId] = useState(
    initial?.storeId ?? startStoreId ?? "",
  );
  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [description, setDescription] = useState<Localized>(
    initial?.description ?? {},
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [price, setPrice] = useState<number | null>(
    initial ? initial.price : null,
  );
  const [items, setItems] = useState<BundleItem[]>(initial?.items ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [startsAt, setStartsAt] = useState<string | null>(
    initial?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(initial?.endsAt ?? null);
  /** Per branch: a figure, or `null` for "the bundle's own price". */
  const [branchPrices, setBranchPrices] =
    useState<Record<string, number | null>>(initialBranchPrices);

  const store =
    (stores.data?.stores ?? []).find((one) => one.id === storeId) ?? null;
  const currencyCode = store?.currencyCode ?? initial?.currencyCode ?? "";
  const decimals = currencyCode ? decimalsOf(currencyCode) : null;
  const branches = useBranches(storeId);

  /**
   * The shop's questions — "Pick your drink", "Make it large" — written once in
   * its Options tab and asked by any dish, or bundle, that links them. Read
   * only once a shop is chosen; the key is the Options tab's, so a question
   * written there shows here without a reload.
   */
  const questions = useQuery({
    queryKey: [...optionKeys.counts(storeId), "questions", ""],
    queryFn: () => fetchStoreQuestions(storeId),
    enabled: Boolean(storeId),
  });
  /** The questions this bundle asks as saved — read off each question's items. */
  const savedQuestionIds = initial
    ? (questions.data ?? [])
        .filter((question) => question.itemIds.includes(initial.id))
        .map((question) => question.id)
    : [];
  /** `null` until the operator changes it: then the saved list is still the answer. */
  const [pickedQuestionIds, setPickedQuestionIds] = useState<string[] | null>(
    null,
  );
  const questionIds = pickedQuestionIds ?? savedQuestionIds;
  const chosenQuestions = questionIds.flatMap((questionId) => {
    const found = (questions.data ?? []).find(
      (question) => question.id === questionId,
    );
    return found ? [found] : [];
  });
  const money = (minor: number) =>
    currencyCode ? format(minor, currencyCode) : String(minor);

  /** Prices of dishes seen in the picker, so a new pick arrives with its own. */
  const seenPrices = useRef(new Map<string, number>());

  const artworks = useArtworks();
  const linked = initial
    ? (artworks.data ?? []).filter(
        (artwork) => artwork.bundle?.id === initial.id,
      )
    : [];

  useUnsavedChanges(
    changed(
      {
        storeId,
        name,
        description,
        imageUrl,
        price,
        items: items.map((item) => [item.menuItemId, item.quantity]),
        isActive,
        startsAt,
        endsAt,
        branchPrices,
        questionIds,
      },
      {
        storeId: initial?.storeId ?? startStoreId ?? "",
        name: initial?.name ?? {},
        description: initial?.description ?? {},
        imageUrl: initial?.imageUrl ?? null,
        price: initial ? initial.price : null,
        items: (initial?.items ?? []).map((item) => [
          item.menuItemId,
          item.quantity,
        ]),
        isActive: initial?.isActive ?? true,
        startsAt: initial?.startsAt ?? null,
        endsAt: initial?.endsAt ?? null,
        branchPrices: initialBranchPrices,
        questionIds: savedQuestionIds,
      },
    ),
  );

  const [errors, setErrors] = useState<{
    store?: string;
    name?: string;
    items?: string;
    price?: string;
    window?: string;
  }>({});

  const separately = separatePrice(items);
  const saving = price !== null ? separately - price : 0;

  function submit() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const found = {
      store: storeId ? undefined : t("bundles.storeRequired"),
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // One dish is a dish with a different price, not a bundle.
      items: items.length < 2 ? t("bundles.itemsRequired") : undefined,
      price:
        price === null
          ? t("validation.priceRequired")
          : price <= 0
            ? t("bundles.pricePositive")
            : undefined,
      window:
        startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)
          ? t("bundles.windowBackwards")
          : undefined,
    };

    setErrors(found);
    if (
      found.store ||
      found.name ||
      found.items ||
      found.price ||
      found.window
    ) {
      return;
    }

    // Only the branches whose figure moved.
    const changes: Record<string, number | null> = {};
    for (const branch of branches.data ?? []) {
      const before = initialBranchPrices[branch.id] ?? null;
      const after = branchPrices[branch.id] ?? null;
      if (before !== after) changes[branch.id] = after;
    }

    onSave(
      {
        storeId,
        name,
        description,
        imageUrl,
        price: price!,
        isActive,
        startsAt,
        endsAt,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
      },
      changes,
      // Only once the operator has touched the list; untouched, nothing moves.
      pickedQuestionIds === null
        ? null
        : { wanted: pickedQuestionIds, current: savedQuestionIds },
    );
  }

  return (
    <EditorPage
      title={initial ? pickLocalized(initial.name) : t("bundles.add")}
      backHref={
        initial
          ? `${listHref}${listHref.includes("?") ? "&" : "?"}focus=${initial.id}`
          : listHref
      }
      backLabel={t("bundles.tab")}
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("bundles.save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <FormSection>
            <FieldPair>
              <Field
                label={t("bundles.store")}
                hint={
                  initial ? t("bundles.storeLocked") : t("bundles.storeHint")
                }
                error={errors.store}
              >
                <Select
                  value={storeId}
                  onChange={(next) => {
                    setStoreId(next);
                    // Another shop's dishes cannot be in it — `bundle_items_same_store`.
                    setItems([]);
                    setBranchPrices({});
                    // Questions are a shop's too.
                    setPickedQuestionIds([]);
                  }}
                  options={(stores.data?.stores ?? []).map((one) => ({
                    value: one.id,
                    label: pickLocalized(one.name),
                  }))}
                  placeholder={t("bundles.storePlaceholder")}
                  // A bundle's dishes, prices and orders are its shop's.
                  disabled={pending || Boolean(initial) || !stores.isSuccess}
                />
              </Field>

              <Field
                label={t("bundles.visibility")}
                hint={t("bundles.visibilityHint")}
              >
                <Toggle
                  on={isActive}
                  onChange={() => setIsActive((current) => !current)}
                  labelOn={t("bundles.live")}
                  labelOff={t("bundles.hidden")}
                />
              </Field>
            </FieldPair>

            <LocalizedField
              label={t("bundles.name")}
              value={name}
              onChange={setName}
              maxLength={TEXT.name}
              error={errors.name}
              filter="title"
              placeholder={{ en: "Burger meal", ar: "وجبة برغر" }}
            />

            <LocalizedField
              label={t("bundles.description")}
              hint={t("bundles.descriptionHint")}
              value={description}
              onChange={setDescription}
              maxLength={TEXT.description}
              multiline
              optional
            />

            <Field label={t("images.label")} hint={t("bundles.imageHint")}>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                folder="menu-items"
                disabled={pending}
              />
            </Field>
          </FormSection>

          <FormSection title={t("bundles.itemsSection")}>
            <Field
              label={t("bundles.pickDishes")}
              hint={t("bundles.pickDishesHint")}
              error={errors.items}
            >
              <AsyncMultiSelect
                value={items.map((item) => ({
                  value: item.menuItemId,
                  label: item.label,
                }))}
                onChange={(next: SelectOption[]) =>
                  setItems((current) =>
                    next.map(
                      (option) =>
                        current.find(
                          (item) => item.menuItemId === option.value,
                        ) ?? {
                          menuItemId: option.value,
                          label: option.label,
                          price: seenPrices.current.get(option.value) ?? 0,
                          quantity: 1,
                        },
                    ),
                  )
                }
                loadOptions={async (input) => {
                  if (!storeId) return [];
                  const found = await searchBundleDishes(input, storeId);
                  for (const dish of found)
                    seenPrices.current.set(dish.id, dish.price);
                  return found.map((dish) => ({
                    value: dish.id,
                    label: dish.label,
                  }));
                }}
                placeholder={t("bundles.pickDishesPlaceholder")}
                disabled={pending || !storeId}
                noOptionsMessage={(input) =>
                  !storeId
                    ? t("bundles.pickShopFirst")
                    : input
                      ? t("promotions.noDishes", { term: input })
                      : t("promotions.typeToFindDishes")
                }
              />
            </Field>

            {items.length > 0 && (
              <ul className="flex flex-col gap-xs">
                {items.map((item) => (
                  <li
                    key={item.menuItemId}
                    className="flex items-center gap-md rounded-md bg-neutral-fill px-lg py-sm"
                  >
                    <span className="min-w-0 flex-grow truncate text-[14px] font-medium">
                      {item.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-[12px] text-text-faint">
                      {currencyCode ? format(item.price, currencyCode) : null}
                    </span>
                    <div className="w-[88px] shrink-0">
                      <NumberInput
                        aria-label={t("bundles.quantityOf", {
                          name: item.label,
                        })}
                        min={1}
                        max={MAX_QUANTITY}
                        step={1}
                        value={String(item.quantity)}
                        onChange={(event) => {
                          const next = Math.min(
                            MAX_QUANTITY,
                            Math.max(
                              1,
                              Math.round(Number(event.target.value) || 1),
                            ),
                          );
                          setItems((current) =>
                            current.map((one) =>
                              one.menuItemId === item.menuItemId
                                ? { ...one, quantity: next }
                                : one,
                            ),
                          );
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>

          {/* Choices the customer makes when adding it — "Pick your drink".
              The shop's own questions, the ones its dishes ask: a bundle asks
              them the same way, and an answer's price is added to the bundle's
              (user, 2026-11-02). Written and edited in the Options tab. */}
          <FormSection title={t("bundles.choicesSection")}>
            <Field
              label={t("bundles.questions")}
              hint={t("bundles.questionsHint")}
            >
              <MultiSelect
                value={questionIds}
                onChange={setPickedQuestionIds}
                placeholder={
                  storeId
                    ? t("bundles.questionsPlaceholder")
                    : t("bundles.pickShopFirst")
                }
                disabled={pending || !storeId || !questions.isSuccess}
                options={(questions.data ?? [])
                  .filter((question) => question.isActive)
                  .map((question) => ({
                    value: question.id,
                    label: pickLocalized(question.title),
                    detail: describeChoices(question, money),
                  }))}
              />
            </Field>

            {chosenQuestions.length > 0 && (
              <ul className="flex flex-col gap-xs">
                {chosenQuestions.map((question) => (
                  <li
                    key={question.id}
                    className="flex flex-col gap-xxs rounded-md bg-neutral-fill px-lg py-sm"
                  >
                    <span className="text-[14px] font-medium">
                      {pickLocalized(question.title)}
                      <span className="font-normal text-text-faint">
                        {" · "}
                        {question.minSelections > 0
                          ? t("bundles.questionRequired")
                          : t("bundles.questionOptional")}
                      </span>
                    </span>
                    <span className="text-[13px] text-text-soft">
                      {describeChoices(question, money)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {storeId && (
              <Link
                href={`/catalogue/${storeId}?tab=options`}
                className="self-start text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t("bundles.questionsManage")}
              </Link>
            )}
          </FormSection>

          <FormSection title={t("bundles.priceSection")}>
            <FieldPair>
              <Field
                label={t("bundles.price")}
                hint={t("bundles.priceHint", { code: currencyCode || "—" })}
                error={errors.price}
              >
                <MoneyInput
                  value={price}
                  onChange={setPrice}
                  decimalDigits={decimals}
                />
              </Field>

              {/* What the dishes cost one by one — the figure the app strikes
                  through beside the bundle's price. Read, not typed: it is the
                  sum of the dishes above at their brand prices. Drawn as a
                  tinted line rather than a box, so it does not look like one
                  more field to fill in. */}
              <Field
                label={t("bundles.originalPrice")}
                hint={t("bundles.originalPriceHint")}
              >
                <p className="flex min-h-[44px] items-center gap-sm rounded-md bg-neutral-fill px-lg text-[14px]">
                  {currencyCode && items.length > 0 ? (
                    <>
                      <span className="font-semibold tabular-nums text-text">
                        {format(separately, currencyCode)}
                      </span>
                      {price !== null && saving > 0 && (
                        <span className="text-[13px] font-medium text-accent-deep">
                          {t("bundles.originalPriceSaving", {
                            saving: format(saving, currencyCode),
                          })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-faint">
                      {t("bundles.originalPriceEmpty")}
                    </span>
                  )}
                </p>
              </Field>
            </FieldPair>

            {/* What each branch charges where it differs — the same rows the
                branch menu writes, `branch_item_prices`, which the app and
                `place_order` both read. Blank follows the price above. */}
            {(branches.data ?? []).length > 1 && (
              <div className="flex flex-col gap-sm">
                <span className="text-[13px] font-semibold text-text">
                  {t("bundles.branchPrices")}
                </span>
                <p className="text-[13px] text-text-soft">
                  {t("bundles.branchPricesHint")}
                </p>
                {(branches.data ?? []).map((branch) => {
                  const code = branch.currencyCode ?? currencyCode;
                  return (
                    <div key={branch.id} className="flex items-center gap-md">
                      <span className="min-w-0 flex-grow truncate text-[14px]">
                        {pickLocalized(branch.name)}
                      </span>
                      <div className="w-[180px] shrink-0">
                        <MoneyInput
                          aria-label={t("bundles.branchPriceOf", {
                            name: pickLocalized(branch.name),
                          })}
                          value={branchPrices[branch.id] ?? null}
                          onChange={(minor) =>
                            setBranchPrices((current) => ({
                              ...current,
                              [branch.id]: minor,
                            }))
                          }
                          decimalDigits={code ? decimalsOf(code) : null}
                          placeholder={t("bundles.branchPriceSame")}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>

          <FormSection title={t("bundles.whenSection")}>
            <FieldPair>
              <Field
                label={t("bundles.startsAt")}
                hint={t("bundles.startsHint")}
              >
                <DateField value={startsAt} onChange={setStartsAt} />
              </Field>
              <Field
                label={t("bundles.endsAt")}
                hint={t("bundles.endsHint")}
                error={errors.window}
              >
                <DateField value={endsAt} onChange={setEndsAt} />
              </Field>
            </FieldPair>
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-lg lg:sticky lg:top-0">
          {/* The answer, not another question — see the promotion editor's. */}
          <div className="flex flex-col gap-xxs rounded-md bg-accent-wash px-lg py-md">
            <span className="text-[12px] font-medium tracking-[0.05em] text-text-faint">
              {t("bundles.previewLabel")}
            </span>
            <p className="text-[14px] font-semibold text-text">
              {currencyCode && price !== null && items.length > 0
                ? saving > 0
                  ? t("bundles.previewSaving", {
                      price: format(price, currencyCode),
                      separately: format(separately, currencyCode),
                      saving: format(saving, currencyCode),
                    })
                  : t("bundles.previewNoSaving", {
                      price: format(price, currencyCode),
                      separately: format(separately, currencyCode),
                    })
                : t("bundles.previewEmpty")}
            </p>
          </div>

          <div className="flex flex-col gap-xs rounded-md bg-neutral-fill px-lg py-md">
            <span className="text-[14px] font-semibold text-text">
              {t("bundles.artworkTitle")}
            </span>
            <p className="text-[13px] text-text-soft">
              {t("bundles.artworkBody")}
            </p>
            {linked.length > 0 ? (
              <ul className="flex flex-col gap-sm">
                {linked.map((artwork) => {
                  const src = pickLocalized(artwork.imageUrl);
                  return (
                    <li key={artwork.id} className="flex items-center gap-md">
                      {src ? (
                        <PreviewImage
                          src={src}
                          name={pickLocalized(initial?.name ?? {})}
                          className="h-[56px] w-[96px] shrink-0 rounded-md object-cover"
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-col gap-xxs">
                        <span className="text-[12px] text-text-soft">
                          {t(`artworks.formats.${artwork.format}`)}
                        </span>
                        <Link
                          href={`/catalogue/artworks/${artwork.id}`}
                          className="self-start text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          {t("bundles.artworkChange")}
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Link
                href={
                  initial
                    ? `/catalogue/artworks/new?bundle=${initial.id}`
                    : "/catalogue?tab=artworks"
                }
                className="self-start text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
              >
                {initial ? t("bundles.artworkAdd") : t("bundles.artworkOpen")}
              </Link>
            )}
          </div>
        </aside>
      </div>
    </EditorPage>
  );
}

/** "Pepsi, 7-Up +$0.50, Miranda" — a question's live answers, extras priced. */
function describeChoices(
  question: StoreQuestion,
  money: (minor: number) => string,
): string {
  return question.choices
    .filter((choice) => choice.isActive)
    .map((choice) =>
      choice.price > 0
        ? `${pickLocalized(choice.name)} +${money(choice.price)}`
        : pickLocalized(choice.name),
    )
    .join(", ");
}
