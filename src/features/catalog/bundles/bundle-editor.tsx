"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  ListPlus,
  Minus,
  Pencil,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge, Button, Field, Section, Switch, cx } from "@/components/ui";
import { DateField } from "@/components/ui/date-field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { MoneyInput } from "@/components/ui/money-input";
import { AsyncMultiSelect, type SelectOption } from "@/components/ui/select";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { BranchLabel } from "../shops/branch-label";
import { TEXT } from "@/lib/limits";
import { toMajor } from "@/lib/minor-units";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import {
  fetchBundleBranchPrices,
  offSaleItems,
  searchBundleDishes,
  separatePrice,
  type Bundle,
  type BundleDraft,
  type BundlePatch,
  type BundleItem,
} from "../api/bundles";
import type { Branch } from "../api/branches";
import {
  effectiveEarnings,
  fetchItemBranchStorePrices,
  usesMarkup,
} from "../api/earnings";
import { resolveBranchEntry, type MarkupEntry } from "../api/markup-price";
import { fetchStoreQuestions, type StoreQuestion } from "../api/options";
import {
  AsideCard,
  EditorLayout,
  EditorPlaceholder,
} from "../promotions/editor-layout";
import { useNow, windowBackwards } from "../promotions/schedule";
import { useArtworks } from "../use-artworks";
import { useBranches } from "../use-branches";
import {
  bundleKeys,
  useBundles,
  useCreateBundle,
  useUpdateBundle,
} from "../use-bundles";
import { useShopEarnings, useShopStorePrices } from "../use-earnings";
import { MarkupPriceFields, useMarkupPrice } from "../menu/markup-price-fields";
import { optionKeys } from "../use-options";
import { ShopSelect } from "../shops/shop-select";
import { useStores } from "../use-stores";
import { BUNDLE_TONE, bundleState } from "./bundle-status";

/** `bundle_items.quantity` is 1 to 20 — the check in `0204`. */
const MAX_QUANTITY = 20;

/**
 * Where Save and Cancel return to: the shop's Bundles tab when the editor was
 * opened from it, the bundles list otherwise.
 */
function listHref(fromStoreId: string | null) {
  return fromStoreId ? `/shops/${fromStoreId}?tab=bundles` : "/bundles";
}

/**
 * One bundle, on a page of its own: which shop, what is inside and how many of
 * each, its price (and each branch's, where they differ), and when it is on
 * offer. Beside it, what a customer sees — the price against the dishes bought
 * separately — its pictures, and the choices it asks.
 *
 * The rules kept from the old editor, each with its reason:
 * - a bundle belongs to one shop, fixed once saved;
 * - at least two dishes, 1–20 of each;
 * - the price is above zero and below the dishes' separate total — a bundle is
 *   a saving or it is not one;
 * - a dish that is off the menu makes the whole bundle unsellable (QA-021), so
 *   the editor says so rather than letting "Live" stand.
 */
export function BundleEditor({
  id,
  fromStoreId = null,
  presetStoreId = null,
}: {
  id: string | null;
  /** Opened from a shop's tab: preselects that shop and returns there. */
  fromStoreId?: string | null;
  /** Preselects a shop without changing where Save returns. */
  presetStoreId?: string | null;
}) {
  const router = useRouter();
  const bundles = useBundles("");
  const rows = bundles.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateBundle();
  const update = useUpdateBundle();

  const branchPrices = useQuery({
    queryKey: bundleKeys.branchPrices(id ?? ""),
    queryFn: () => fetchBundleBranchPrices(id!),
    enabled: Boolean(id),
  });
  // A markup branch's own price from the shop for it (`0262`).
  const branchStorePrices = useQuery({
    queryKey: bundleKeys.branchStorePrices(id ?? ""),
    queryFn: () => fetchItemBranchStorePrices(id!),
    enabled: Boolean(id),
  });

  if (id && !initial) {
    return (
      <EditorPlaceholder
        state={
          bundles.isPending ? "pending" : bundles.isError ? "error" : "missing"
        }
        title={t("bundles.edit")}
        notFound={t("bundles.notFound")}
        onRetry={() => void bundles.refetch()}
      />
    );
  }

  // Branch prices seed the form, so it waits for them; a new one waits for
  // the list, whose length is where it goes in the order.
  if (
    (id && (branchPrices.isPending || branchStorePrices.isPending)) ||
    (!id && bundles.isPending)
  ) {
    return (
      <EditorPlaceholder
        state="pending"
        title={initial ? pickLocalized(initial.name) : t("bundles.add")}
        notFound={null}
      />
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      initialBranchPrices={branchPrices.data ?? {}}
      initialBranchStorePrices={branchStorePrices.data ?? {}}
      startStoreId={fromStoreId ?? presetStoreId}
      cancelHref={listHref(fromStoreId)}
      pending={create.isPending || update.isPending}
      onSave={(draft, patch, changes, storePrice, storeChanges) => {
        const done = () => router.replace(listHref(fromStoreId));
        if (initial) {
          update.mutate(
            {
              id: initial.id,
              draft,
              patch,
              branchPrices: changes,
              storePrice,
              branchStorePrices: storeChanges,
            },
            { onSuccess: done },
          );
        } else {
          create.mutate(
            {
              draft,
              sortOrder: rows.length,
              branchPrices: changes,
              storePrice,
              branchStorePrices: storeChanges,
            },
            { onSuccess: done },
          );
        }
      }}
    />
  );
}

function Form({
  initial,
  initialBranchPrices,
  initialBranchStorePrices,
  startStoreId,
  cancelHref,
  pending,
  onSave,
}: {
  initial?: Bundle;
  initialBranchPrices: Record<string, number>;
  initialBranchStorePrices: Record<string, number>;
  startStoreId: string | null;
  cancelHref: string;
  pending: boolean;
  onSave: (
    draft: BundleDraft,
    /** Only what this form changed, for a bundle that exists. */
    patch: BundlePatch,
    branchPrices: Record<string, number | null>,
    /** On markup and moved; null removes it, absent leaves it (`0262`). */
    storePrice?: number | null,
    /** Markup branches' own prices from the shop that moved; null removes. */
    branchStorePrices?: Record<string, number | null>,
  ) => void;
}) {
  const { format, decimalsOf } = useMoney();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const stores = useStores("");
  const now = useNow();

  // What the form opened with, held for as long as it is open: the list is
  // re-read in the background, and a baseline that followed it would read a
  // colleague's change as this form's own.
  const [start] = useState(() => ({
    storeId: initial?.storeId ?? startStoreId ?? "",
    name: initial?.name ?? ({} as Localized),
    description: initial?.description ?? ({} as Localized),
    imageUrl: initial?.imageUrl ?? null,
    price: initial ? initial.price : null,
    items: initial?.items ?? [],
    isActive: initial?.isActive ?? true,
    startsAt: initial?.startsAt ?? null,
    endsAt: initial?.endsAt ?? null,
  }));

  const [storeId, setStoreId] = useState(start.storeId);
  const [name, setName] = useState<Localized>(start.name);
  const [description, setDescription] = useState<Localized>(start.description);
  const [imageUrl, setImageUrl] = useState<string | null>(start.imageUrl);
  const [price, setPrice] = useState<number | null>(start.price);
  const [items, setItems] = useState<BundleItem[]>(start.items);
  const [isActive, setIsActive] = useState(start.isActive);
  const [startsAt, setStartsAt] = useState<string | null>(start.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(start.endsAt);
  const [branchPrices, setBranchPrices] =
    useState<Record<string, number | null>>(initialBranchPrices);

  const store =
    (stores.data?.stores ?? []).find((one) => one.id === storeId) ?? null;
  const currencyCode = store?.currencyCode ?? initial?.currencyCode ?? "";
  const decimals = currencyCode ? decimalsOf(currencyCode) : null;
  const branches = useBranches(storeId);
  // A bundle is a dish from the basket on, so on markup it has a store price
  // like one (`item_store_prices`, `0262`).
  const earnings = useShopEarnings(storeId || null);
  const markup = usesMarkup(earnings.data);
  const storePrices = useShopStorePrices(storeId || null, markup);
  const loadedStorePrice =
    initial && initial.storeId === storeId
      ? (storePrices.data?.items.get(initial.id) ?? null)
      : null;
  // The first answer and no later one. Until it has come Save stays off: with
  // nothing read, the boxes would say "no markup" and saving would write the
  // app price over the shop's.
  const [storePriceAtOpen, setStorePriceAtOpen] = useState<{
    value: number | null;
  } | null>(null);
  if (storePriceAtOpen === null && storePrices.isSuccess) {
    setStorePriceAtOpen({ value: loadedStorePrice });
  }
  const savedStorePrice = storePriceAtOpen?.value ?? null;
  const storePriceUnknown =
    markup && initial != null && storePriceAtOpen === null;
  // On markup, the shop's price plus ours (`markup-price`).
  const split = useMarkupPrice({
    active: markup,
    price,
    savedPrice: start.price,
    savedStorePrice,
  });
  const sellPrice = split.sellPrice;

  /**
   * Branches on markup (their own row, else the shop's) price the bundle as
   * the branch Menu tab does: the price from the branch and our markup, an
   * empty box meaning the shop's (`resolveBranchEntry`). Only rows somebody
   * typed in are held here; the rest show what is saved.
   */
  const [branchEntries, setBranchEntries] = useState<
    Record<string, MarkupEntry>
  >({});
  const [branchErrors, setBranchErrors] = useState<Record<string, string>>({});
  const onMarkupAt = (branch: Branch) =>
    effectiveEarnings(
      earnings.data?.shop,
      earnings.data?.branches.get(branch.id),
    ).model === "markup";
  /** What the branch falls back to — the shop's, where the currency is. */
  const shopFigures = (branch: Branch) => {
    const inherits =
      branch.currencyCode === null || branch.currencyCode === currencyCode;
    return {
      price: inherits ? sellPrice : null,
      storePrice: inherits
        ? markup
          ? split.nextStorePrice
          : savedStorePrice
        : null,
    };
  };
  const branchEntry = (branch: Branch): MarkupEntry => {
    const typed = branchEntries[branch.id];
    if (typed) return typed;
    const ownPrice = initialBranchPrices[branch.id] ?? null;
    const ownStore = initialBranchStorePrices[branch.id] ?? null;
    const store = ownStore ?? shopFigures(branch).storePrice;
    return {
      shopPrice: ownStore,
      markup: ownPrice !== null && store !== null ? ownPrice - store : null,
    };
  };
  const money = (minor: number) =>
    currencyCode ? format(minor, currencyCode) : String(minor);

  // The questions it asks — set up on the shop's Options tab, like a dish's.
  const questions = useQuery({
    queryKey: [...optionKeys.counts(storeId), "questions", ""],
    queryFn: () => fetchStoreQuestions(storeId),
    enabled: Boolean(storeId) && Boolean(initial),
  });
  const asked = initial
    ? (questions.data ?? []).filter(
        (question) =>
          question.isActive && question.itemIds.includes(initial.id),
      )
    : [];

  // Prices of dishes seen in search, so a newly picked dish arrives with its
  // price for the "separately" sum. A ref: written in the loader, read on pick,
  // never rendered.
  const seenPrices = useRef(new Map<string, number>());

  const artworks = useArtworks();
  const linked = initial
    ? (artworks.data ?? []).filter(
        (artwork) => artwork.bundle?.id === initial.id,
      )
    : [];

  const dirty =
    changed(
      {
        storeId,
        name,
        description,
        imageUrl,
        price: sellPrice,
        items: items.map((item) => [item.menuItemId, item.quantity]),
        isActive,
        startsAt,
        endsAt,
        branchPrices,
      },
      {
        ...start,
        items: start.items.map((item) => [item.menuItemId, item.quantity]),
        branchPrices: initialBranchPrices,
      },
    ) ||
    split.moved ||
    Object.keys(branchEntries).length > 0;
  useUnsavedChanges(dirty);

  const [errors, setErrors] = useState<{
    store?: string;
    name?: string;
    items?: string;
    price?: string;
    window?: string;
  }>({});

  const separately = separatePrice(items);
  const saving = sellPrice !== null ? separately - sellPrice : 0;
  const offSale = offSaleItems({ items });

  function submit() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const found = {
      store: storeId ? undefined : t("bundles.storeRequired"),
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      items: items.length < 2 ? t("bundles.itemsRequired") : undefined,
      price:
        split.problem ??
        (sellPrice === null
          ? t("validation.priceRequired")
          : sellPrice <= 0
            ? t("bundles.pricePositive")
            : // A bundle is a saving or it is not one.
              items.length > 0 && sellPrice >= separately
              ? t("bundles.priceBelowOriginal", {
                  separately: money(separately),
                })
              : undefined),
      window: windowBackwards(startsAt, endsAt)
        ? t("bundles.windowBackwards")
        : undefined,
    };
    // Markup branches someone typed in: the two boxes, resolved.
    const storeChanges: Record<string, number | null> = {};
    const markupPrices: Record<string, number | null> = {};
    const refused: Record<string, string> = {};
    for (const branch of branches.data ?? []) {
      if (!onMarkupAt(branch) || !branchEntries[branch.id]) continue;
      const resolved = resolveBranchEntry(
        branchEntry(branch),
        shopFigures(branch),
      );
      if (resolved.kind === "invalid") {
        refused[branch.id] = t(resolved.problem);
        continue;
      }
      markupPrices[branch.id] =
        resolved.kind === "split" ? resolved.price : null;
      const storeAfter = resolved.kind === "split" ? resolved.storePrice : null;
      if (storeAfter !== (initialBranchStorePrices[branch.id] ?? null)) {
        storeChanges[branch.id] = storeAfter;
      }
    }
    setBranchErrors(refused);

    setErrors(found);
    if (Object.values(found).some(Boolean) || Object.keys(refused).length > 0) {
      return;
    }

    // Only the branches whose price moved — a blank one follows the bundle.
    const changes: Record<string, number | null> = {};
    for (const branch of branches.data ?? []) {
      const before = initialBranchPrices[branch.id] ?? null;
      const after =
        branch.id in markupPrices
          ? (markupPrices[branch.id] ?? null)
          : (branchPrices[branch.id] ?? null);
      if (before !== after) changes[branch.id] = after;
    }

    const pairs = items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    }));
    // Only what this form changed, so saving a typo cannot put back a price
    // or a switch somebody else has set. The two dates are one check.
    const startPairs = start.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    }));
    const patch = {
      ...(changed(name, start.name) && { name }),
      ...(changed(description, start.description) && { description }),
      ...(changed(imageUrl, start.imageUrl) && { imageUrl }),
      ...(changed(sellPrice, start.price) && { price: sellPrice! }),
      ...(changed(isActive, start.isActive) && { isActive }),
      ...(changed([startsAt, endsAt], [start.startsAt, start.endsAt]) && {
        startsAt,
        endsAt,
      }),
      ...(changed(pairs, startPairs) && { items: pairs }),
    };

    onSave(
      {
        storeId,
        name,
        description,
        imageUrl,
        price: sellPrice!,
        isActive,
        startsAt,
        endsAt,
        items: pairs,
      },
      patch,
      changes,
      split.storePriceMoved ? split.nextStorePrice : undefined,
      storeChanges,
    );
  }

  const priceField = (
    <Field
      label={t("bundles.price")}
      hint={t("bundles.priceHint", { code: currencyCode || "—" })}
      error={split.plain ? errors.price : undefined}
    >
      <MoneyInput
        value={price}
        onChange={setPrice}
        decimalDigits={decimals}
        aria-label={t("bundles.price")}
        disabled={pending}
      />
    </Field>
  );

  function setQuantity(menuItemId: string, quantity: number) {
    const next = Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity) || 1));
    setItems((current) =>
      current.map((one) =>
        one.menuItemId === menuItemId ? { ...one, quantity: next } : one,
      ),
    );
  }

  const state = initial ? bundleState(initial, now) : null;
  const otherBranches = branches.data ?? [];

  return (
    <EditorLayout
      dirty={dirty}
      title={initial ? pickLocalized(initial.name) : t("bundles.add")}
      description={initial ? initial.storeName : t("bundles.newDescription")}
      meta={
        state ? (
          <Badge tone={BUNDLE_TONE[state]} dot>
            {t(`bundles.status.${state}`)}
          </Badge>
        ) : undefined
      }
      footer={
        <>
          <Button asChild variant="secondary">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            pending={pending}
            disabled={!dirty || storePriceUnknown}
          >
            {initial ? t("bundles.save") : t("bundles.create")}
          </Button>
        </>
      }
      aside={
        <>
          <AsideCard title={t("bundles.previewLabel")} tone="accent">
            <p
              className="text-[14px] leading-relaxed font-medium text-ink"
              aria-live="polite"
            >
              {currencyCode && sellPrice !== null && items.length > 0
                ? saving > 0
                  ? t("bundles.previewSaving", {
                      price: money(sellPrice),
                      separately: money(separately),
                      saving: money(saving),
                    })
                  : t("bundles.previewNoSaving", {
                      price: money(sellPrice),
                      separately: money(separately),
                    })
                : t("bundles.previewEmpty")}
            </p>
          </AsideCard>

          <AsideCard
            title={t("bundles.artworkTitle")}
            description={t("bundles.artworkBody")}
          >
            {linked.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {linked.map((artwork) => {
                  const src = pickLocalized(artwork.imageUrl);
                  return (
                    <li key={artwork.id} className="flex items-center gap-3">
                      <span className="h-12 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-subtle">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] text-ink">
                        {t(`artworks.formats.${artwork.format}`)}
                      </span>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/artworks/${artwork.id}`}>
                          <Pencil />
                          {t("bundles.artworkChange")}
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : initial ? (
              <Button asChild size="sm">
                <Link href={`/artworks/new?bundle=${initial.id}`}>
                  <ImagePlus />
                  {t("bundles.artworkAdd")}
                </Link>
              </Button>
            ) : (
              <p className="text-[12.5px] text-ink-3">
                {t("bundles.artworkOpen")}
              </p>
            )}
          </AsideCard>

          {/* The choices it asks — "Pick your drink" — set up on the shop's
              Options tab, opened on this bundle: the same place and the same
              questions a dish's are. */}
          <AsideCard
            title={t("bundles.choicesTitle")}
            description={t("bundles.choicesBody")}
          >
            {asked.length > 0 ? (
              <ul className="mb-3 flex flex-col gap-2">
                {asked.map((question) => (
                  <li key={question.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      {pickLocalized(question.title)}
                      <Badge tone="neutral">
                        {question.minSelections > 0
                          ? t("bundles.questionRequired")
                          : t("bundles.questionOptional")}
                      </Badge>
                    </span>
                    <span className="text-[12.5px] text-ink-3">
                      {describeChoices(question, money)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : initial ? (
              <p className="mb-3 text-[12.5px] text-ink-3">
                {t("bundles.choicesNone")}
              </p>
            ) : null}
            {initial ? (
              <Button asChild size="sm">
                <Link
                  href={`/shops/${initial.storeId}?tab=options&section=bundles&item=${initial.id}`}
                >
                  <ListPlus />
                  {asked.length > 0
                    ? t("bundles.choicesChange")
                    : t("bundles.choicesAdd")}
                </Link>
              </Button>
            ) : (
              <p className="text-[12.5px] text-ink-3">
                {t("bundles.choicesSaveFirst")}
              </p>
            )}
          </AsideCard>
        </>
      }
    >
      <Section
        title={t("bundles.detailsSection")}
        bodyClassName="flex flex-col gap-5"
      >
        <Field
          label={t("bundles.store")}
          hint={initial ? t("bundles.storeLocked") : t("bundles.storeHint")}
          error={errors.store}
          className="sm:max-w-sm"
        >
          {(wiring) => (
            <ShopSelect
              {...wiring}
              value={storeId}
              onChange={(next) => {
                // Another shop's dishes and branches mean nothing here.
                setStoreId(next);
                setItems([]);
                setBranchPrices({});
              }}
              placeholder={t("bundles.storePlaceholder")}
              disabled={pending || Boolean(initial)}
            />
          )}
        </Field>

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

        <Field
          label={t("images.label")}
          hint={t("bundles.imageHint")}
          optional={t("form.optional")}
        >
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            folder="menu-items"
            photo="dish"
            disabled={pending}
          />
        </Field>

        <div className="rounded-lg border border-line p-4">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            label={t("bundles.visibility")}
            description={t("bundles.visibilityHint")}
            disabled={pending}
          />
        </div>
      </Section>

      <Section
        title={t("bundles.itemsSection")}
        description={t("bundles.pickDishesHint")}
        bodyClassName="flex flex-col gap-4"
      >
        <Field label={t("bundles.pickDishes")} error={errors.items}>
          {(wiring) => (
            <AsyncMultiSelect
              {...wiring}
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
                        onSale: true,
                      },
                  ),
                )
              }
              loadOptions={async (input) => {
                if (!storeId) return [];
                const found = await searchBundleDishes(input, storeId);
                for (const dish of found) {
                  seenPrices.current.set(dish.id, dish.price);
                }
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
          )}
        </Field>

        {items.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {items.map((item) => (
              <li
                key={item.menuItemId}
                className={cx(
                  "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
                  !item.onSale && "bg-warning-soft/60",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="text-[12.5px] text-ink-3 tabular-nums">
                    {currencyCode ? money(item.price) : null}
                    {!item.onSale && (
                      <span className="ms-2 font-medium text-warning-ink">
                        {t("bundles.dishOffSale")}
                      </span>
                    )}
                  </span>
                </span>

                <div
                  role="group"
                  aria-label={t("bundles.quantityOf", { name: item.label })}
                  className="flex items-center rounded-md border border-line-strong bg-surface shadow-xs"
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("bundles.fewer", { name: item.label })}
                    disabled={pending || item.quantity <= 1}
                    onClick={() =>
                      setQuantity(item.menuItemId, item.quantity - 1)
                    }
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center text-[14px] font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("bundles.more", { name: item.label })}
                    disabled={pending || item.quantity >= MAX_QUANTITY}
                    onClick={() =>
                      setQuantity(item.menuItemId, item.quantity + 1)
                    }
                  >
                    <Plus />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("bundles.removeDish", { name: item.label })}
                  disabled={pending}
                  onClick={() =>
                    setItems((current) =>
                      current.filter(
                        (one) => one.menuItemId !== item.menuItemId,
                      ),
                    )
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {offSale.length > 0 && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] text-warning-ink"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t("bundles.itemsOffSale")}
          </p>
        )}
      </Section>

      <Section
        title={t("bundles.priceSection")}
        bodyClassName="flex flex-col gap-5"
      >
        {/* On markup: the shop's price and ours, worked out into the
            bundle's price; the plain box only while both are empty. */}
        {markup && (
          <MarkupPriceFields
            entry={split.entry}
            onChange={split.setEntry}
            decimals={decimals}
            disabled={pending || (initial != null && !storePrices.isSuccess)}
            error={split.plain ? undefined : errors.price}
            appPrice={
              currencyCode && sellPrice !== null ? money(sellPrice) : null
            }
          />
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {!markup && priceField}

          {/* Read, not typed: the dishes above at their brand prices — the
              figure the app strikes through beside the bundle's. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">
              {t("bundles.originalPrice")}
            </span>
            <div className="flex h-9 items-center gap-2 rounded-md bg-subtle px-3 text-[14px]">
              {currencyCode && items.length > 0 ? (
                <>
                  <span className="font-semibold text-ink tabular-nums">
                    {money(separately)}
                  </span>
                  {sellPrice !== null && saving > 0 && (
                    <span className="text-[13px] font-medium text-success-ink">
                      {t("bundles.originalPriceSaving", {
                        saving: money(saving),
                      })}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-ink-4">
                  {t("bundles.originalPriceEmpty")}
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-ink-3">
              {t("bundles.originalPriceHint")}
            </p>
          </div>
        </div>

        {/* What each branch charges where it differs — `branch_item_prices`,
            which the app and `place_order` both read. Blank follows the bundle
            price. Only shown for a shop with more than one place. */}
        {otherBranches.length > 1 && (
          <div className="flex flex-col gap-2">
            <div>
              <h3 className="text-[13px] font-medium text-ink">
                {t("bundles.branchPrices")}
              </h3>
              <p className="text-[12.5px] text-ink-3">
                {t("bundles.branchPricesHint")}
              </p>
            </div>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {otherBranches.map((branch) => {
                const code = branch.currencyCode ?? currencyCode;
                const branchName = pickLocalized(branch.name);
                return (
                  <li
                    key={branch.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
                  >
                    <BranchLabel
                      branch={branch}
                      className="flex-1 text-[14px] text-ink"
                      aside={
                        branch.currencyCode &&
                        branch.currencyCode !== currencyCode && (
                          <span className="text-[12px] text-ink-3">
                            {branch.currencyCode}
                          </span>
                        )
                      }
                    />
                    {onMarkupAt(branch) ? (
                      <BranchMarkupEntry
                        entry={branchEntry(branch)}
                        onChange={(next) => {
                          setBranchEntries((current) => ({
                            ...current,
                            [branch.id]: next,
                          }));
                          setBranchErrors(
                            ({ [branch.id]: _, ...rest }) => rest,
                          );
                        }}
                        shop={shopFigures(branch)}
                        ownPrice={initialBranchPrices[branch.id] ?? null}
                        decimals={code ? decimalsOf(code) : null}
                        code={code}
                        name={branchName}
                        error={branchErrors[branch.id]}
                        disabled={pending}
                      />
                    ) : (
                      <div className="w-full sm:w-44">
                        <MoneyInput
                          aria-label={t("bundles.branchPriceOf", {
                            name: branchName,
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
                          disabled={pending}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      <Section
        title={t("bundles.whenSection")}
        bodyClassName="grid grid-cols-1 gap-5 sm:grid-cols-2"
      >
        <Field label={t("bundles.startsAt")} hint={t("bundles.startsHint")}>
          <DateField
            value={startsAt}
            onChange={setStartsAt}
            disabled={pending}
          />
        </Field>
        <Field
          label={t("bundles.endsAt")}
          hint={t("bundles.endsHint")}
          error={errors.window}
        >
          <DateField
            value={endsAt}
            onChange={setEndsAt}
            invalid={Boolean(errors.window)}
            disabled={pending}
          />
        </Field>
      </Section>
    </EditorLayout>
  );
}

function describeChoices(
  question: StoreQuestion,
  money: (minor: number) => string,
): string {
  return question.choices
    .filter((choice) => choice.isActive)
    .map((choice) =>
      choice.price > 0
        ? t("bundles.choiceWithPrice", {
            name: pickLocalized(choice.name),
            price: money(choice.price),
          })
        : pickLocalized(choice.name),
    )
    .join(", ");
}

/**
 * One markup branch's bundle price: from the branch and our markup, an empty
 * box meaning the shop's (placeholders), and what that makes in the app.
 * Saved with the form, not on leaving the box as on the branch Menu tab.
 */
function BranchMarkupEntry({
  entry,
  onChange,
  shop,
  ownPrice,
  decimals,
  code,
  name,
  error,
  disabled,
}: {
  entry: MarkupEntry;
  onChange: (entry: MarkupEntry) => void;
  /** The shop's figures this branch falls back to, in its currency or null. */
  shop: { price: number | null; storePrice: number | null };
  ownPrice: number | null;
  decimals: number | null;
  code: string;
  name: string;
  error?: string;
  disabled: boolean;
}) {
  const { format } = useMoney();
  const shopMarkup =
    shop.price !== null && shop.storePrice !== null
      ? shop.price - shop.storePrice
      : null;
  const resolved = resolveBranchEntry(entry, shop);
  const appPrice =
    resolved.kind === "split"
      ? resolved.price
      : resolved.kind === "follow"
        ? (ownPrice ?? shop.price)
        : null;

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="text-[11.5px] font-medium text-ink-4">
            {t("earnings.fromShopShort")}
          </span>
          <span className="w-32">
            <MoneyInput
              value={entry.shopPrice}
              onChange={(shopPrice) => onChange({ ...entry, shopPrice })}
              decimalDigits={decimals}
              disabled={disabled}
              invalid={Boolean(error)}
              placeholder={
                shop.storePrice !== null
                  ? toMajor(shop.storePrice, decimals)
                  : undefined
              }
              aria-label={t("earnings.shopPriceFor", { name })}
            />
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="text-[11.5px] font-medium text-ink-4">
            {t("earnings.markupShort")}
          </span>
          <span className="w-32">
            <MoneyInput
              value={entry.markup}
              onChange={(markup) => onChange({ ...entry, markup })}
              decimalDigits={decimals}
              disabled={disabled}
              invalid={Boolean(error)}
              min={-1_000_000_000}
              placeholder={
                shopMarkup !== null ? toMajor(shopMarkup, decimals) : undefined
              }
              aria-label={t("earnings.markupFor", { name })}
            />
          </span>
        </span>
      </div>
      {error ? (
        <p className="text-[12.5px] text-danger-ink">{error}</p>
      ) : (
        appPrice !== null &&
        code && (
          <p className="text-[12px] text-ink-3 tabular-nums">
            {t("earnings.appPrice", { price: format(appPrice, code) })}
          </p>
        )
      )}
    </div>
  );
}
