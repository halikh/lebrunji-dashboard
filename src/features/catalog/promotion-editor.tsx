"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { DateField } from "@/components/ui/date-field";
import { EditorPage } from "@/components/ui/editor-page";
import { LocalizedImageField } from "@/components/ui/localized-image-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import {
  AsyncMultiSelect,
  MultiSelect,
  Select,
  type SelectOption,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { FALLBACK_LANGUAGE, type Localized } from "@/lib/validation";

import {
  PLACEMENTS,
  PROMOTION_KINDS,
  fetchDishesByIds,
  searchDishes,
  type Placement,
  type Promotion,
  type PromotionDraft,
  type PromotionKind,
  type Scope,
  type ScopeType,
} from "./api/promotions";
import { useCategories } from "./use-categories";
import {
  useCreatePromotion,
  usePromotions,
  useUpdatePromotion,
} from "./use-promotions";
import { useStores } from "./use-stores";

const LIST_HREF = "/catalogue?tab=promotions";

/**
 * One promotion, on a page of its own.
 *
 * The panel is gone — see `CategoryEditor` for why, and `useRowFocus` for what
 * replaced the thing it was good at.
 *
 * This is the form that most needed the room. A promotion carries a kind, a
 * value, a floor, a cap, two redemption limits, a first-order flag, a scope
 * with a target picker, a date window, three placements and a card per
 * language — the file's own note calls it "a lot of control for a screen used a
 * handful of times a year". None of that belonged in a 420pt column.
 */
export function PromotionEditor({ id }: { id: string | null }) {
  const router = useRouter();

  const promotions = usePromotions("");
  const rows = promotions.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreatePromotion();
  const update = useUpdatePromotion();

  const back = (focusId: string | null) => {
    const focus = focusId ? `&focus=${focusId}` : "";
    router.replace(`${LIST_HREF}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("promotions.add")}
        backHref={LIST_HREF}
        backLabel={t("promotions.tab")}
      >
        {promotions.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="promotions.notFound" mood="lost" />
        )}
      </EditorPage>
    );
  }

  return (
    <WithDishes
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => back(initial?.id ?? null);
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name: initial.slug },
            { onSuccess: done },
          );
        } else {
          create.mutate({ draft, priority: rows.length }, { onSuccess: done });
        }
      }}
      onCancel={() => back(initial?.id ?? null)}
    />
  );
}

/**
 * What a promotion's scopes reduce to, for a form.
 *
 * One type and a set of targets, rather than an arbitrary mix. The engine
 * matches on *any* scope, so a mix is expressible in the table and would be a
 * union — but "these three shops **and** the Grills category **and** two dishes"
 * is a lot of control for a screen used a handful of times a year, and every
 * extra control on it is one more thing to read before a promotion goes live.
 *
 * `mixed` is the honest escape hatch. A promotion set up by hand in SQL with
 * scopes of two different types cannot be shown here, so the form says so and
 * **leaves them alone** on save rather than silently collapsing them to
 * whichever type it guessed. A screen that cannot represent something must not
 * be the thing that deletes it.
 */
type ScopeShape =
  | { kind: "single"; scopeType: ScopeType; targetIds: string[] }
  | { kind: "mixed" };

function readScopes(scopes: readonly Scope[]): ScopeShape {
  const types = [...new Set(scopes.map((scope) => scope.scopeType))];
  if (types.length === 0) {
    return { kind: "single", scopeType: "order", targetIds: [] };
  }
  if (types.length > 1) return { kind: "mixed" };

  return {
    kind: "single",
    scopeType: types[0],
    targetIds: scopes.flatMap((scope) =>
      scope.targetId ? [scope.targetId] : [],
    ),
  };
}

/**
 * Resolves what the form needs before it mounts, rather than filling it in
 * afterwards.
 *
 * The dish picker is async — there is no list to look a label up in — so a
 * promotion scoped to three dishes has to fetch those three by id or render
 * three blank chips. Doing that in an effect after mounting would mean a form
 * whose initial state changes a beat later, which is the pattern the plan warns
 * about: state *reset* by an effect rather than derived. So the body waits, and
 * `Form` receives everything as props.
 */
function WithDishes({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Promotion;
  pending: boolean;
  onSave: (draft: PromotionDraft) => void;
  onCancel: () => void;
}) {
  const shape = readScopes(initial?.scopes ?? []);
  const dishIds =
    shape.kind === "single" && shape.scopeType === "menuItem"
      ? shape.targetIds
      : [];

  const dishes = useQuery({
    queryKey: ["promotions", "dishes", ...dishIds],
    queryFn: () => fetchDishesByIds(dishIds),
    enabled: dishIds.length > 0,
  });

  // `enabled: false` leaves a query pending forever, so the wait is gated on
  // there being something to wait for rather than on the query's own state.
  if (dishIds.length > 0 && dishes.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-xxl text-[13px] text-text-faint">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <Form
      initial={initial}
      shape={shape}
      initialDishes={(dishes.data ?? []).map((dish) => ({
        value: dish.id,
        label: dish.label,
      }))}
      // The shop the saved dishes belong to, so reopening lands on the right
      // menu rather than asking the operator to pick it again to see what is
      // already chosen.
      initialDishStoreId={dishes.data?.[0]?.storeId ?? null}
      pending={pending}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

function Form({
  initial,
  shape,
  initialDishes,
  initialDishStoreId,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Promotion;
  shape: ScopeShape;
  initialDishes: SelectOption[];
  initialDishStoreId: string | null;
  pending: boolean;
  onSave: (draft: PromotionDraft) => void;
  onCancel: () => void;
}) {
  const { format, baseCode, baseDecimals } = useMoney();
  // The currency a stated amount is written in. `0080` made this a column the
  // database enforces, so it is read rather than assumed to be the first row.
  const code = baseCode;

  const stores = useStores("");
  const categories = useCategories("");
  const [name, setName] = useState(initial?.slug ?? "");
  const [imageUrl, setImageUrl] = useState<Localized | null>(
    initial?.imageUrl ?? null,
  );
  /**
   * Where the card is shown, and nothing about who gets the discount.
   *
   * `discount_for_order` does not read this — an unplaced promotion still
   * applies at checkout — so the field is about advertising and says so. A new
   * promotion starts on Home, which is where every promotion has been shown
   * since `0053`.
   */
  const [placements, setPlacements] = useState<Placement[]>(
    initial?.placements ?? ["home"],
  );
  const [startsAt, setStartsAt] = useState<string | null>(
    initial?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(initial?.endsAt ?? null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [kind, setKind] = useState<PromotionKind>(
    initial?.kind ?? "percentage",
  );
  const [value, setValue] = useState(numberField(initial?.value));
  const [minSubtotal, setMinSubtotal] = useState(
    numberField(initial?.minSubtotal),
  );
  const [maxDiscount, setMaxDiscount] = useState(
    numberField(initial?.maxDiscount),
  );
  const [perUser, setPerUser] = useState(
    numberField(initial?.maxRedemptionsPerUser),
  );
  const [total, setTotal] = useState(numberField(initial?.maxRedemptionsTotal));
  const [firstOrderOnly, setFirstOrderOnly] = useState(
    initial?.isFirstOrderOnly ?? false,
  );

  const [scopeType, setScopeType] = useState<ScopeType>(
    shape.kind === "single" ? shape.scopeType : "order",
  );
  const [storeIds, setStoreIds] = useState<string[]>(
    shape.kind === "single" && shape.scopeType === "store"
      ? shape.targetIds
      : [],
  );
  const [categoryIds, setCategoryIds] = useState<string[]>(
    shape.kind === "single" && shape.scopeType === "category"
      ? shape.targetIds
      : [],
  );
  const [dishes, setDishes] = useState<SelectOption[]>(initialDishes);

  /**
   * Which shop's menu the dish picker is searching.
   *
   * Not persisted with the promotion — `discount_scopes` stores the dishes, and
   * which shop they came from is derivable from them. It is a step in the
   * asking, not part of the answer.
   *
   * Seeded from the first dish already attached, so reopening a saved
   * promotion lands on the right menu rather than making the operator pick the
   * shop again to see what is already chosen.
   */
  const [dishStoreId, setDishStoreId] = useState<string>(
    initialDishStoreId ?? "",
  );

  /**
   * The guard the panel used to provide.
   *
   * A panel was left by Escape or a tab switch, both caught by
   * `useGuardedAction`; a page is left by navigating, which nothing intercepts.
   *
   * Every field the form writes is compared, not a chosen few: this is the
   * longest form in the dashboard, and a guard that watched half of it would be
   * a guard that let the other half be thrown away silently — which is worse
   * than none, because it teaches the operator that the warning is reliable.
   */
  useUnsavedChanges(
    changed(
      {
        name,
        imageUrl,
        placements,
        startsAt,
        endsAt,
        isActive,
        kind,
        value,
        minSubtotal,
        maxDiscount,
        perUser,
        total,
        firstOrderOnly,
        scopeType,
        storeIds,
        categoryIds,
        dishIds: dishes.map((dish) => dish.value),
      },
      {
        name: initial?.slug ?? "",
        imageUrl: initial?.imageUrl ?? null,
        placements: initial?.placements ?? ["home"],
        startsAt: initial?.startsAt ?? null,
        endsAt: initial?.endsAt ?? null,
        isActive: initial?.isActive ?? true,
        kind: initial?.kind ?? "percentage",
        value: numberField(initial?.value),
        minSubtotal: numberField(initial?.minSubtotal),
        maxDiscount: numberField(initial?.maxDiscount),
        perUser: numberField(initial?.maxRedemptionsPerUser),
        total: numberField(initial?.maxRedemptionsTotal),
        firstOrderOnly: initial?.isFirstOrderOnly ?? false,
        scopeType: shape.kind === "single" ? shape.scopeType : "order",
        storeIds:
          shape.kind === "single" && shape.scopeType === "store"
            ? shape.targetIds
            : [],
        categoryIds:
          shape.kind === "single" && shape.scopeType === "category"
            ? shape.targetIds
            : [],
        dishIds: initialDishes.map((dish) => dish.value),
      },
    ),
  );

  const [errors, setErrors] = useState<{
    name?: string;
    value?: string;
    window?: string;
    targets?: string;
    image?: string;
  }>({});

  /** `freeDelivery` takes the delivery fee, so there is no amount to set. */
  const takesValue = kind !== "freeDelivery";

  function targetsFor(type: ScopeType): string[] {
    if (type === "store") return storeIds;
    if (type === "category") return categoryIds;
    if (type === "menuItem") return dishes.map((dish) => dish.value);
    return [];
  }

  function submit() {
    const parsed = Number(value);
    const targets = targetsFor(scopeType);

    const found = {
      name: name.trim() === "" ? t("promotions.nameRequired") : undefined,

      // The database refuses this too (`discounts_value_sane`, 0066), and it
      // refuses it by constraint name. Caught here so it reads as a form.
      value: !takesValue
        ? undefined
        : value.trim() === "" || !Number.isFinite(parsed) || parsed < 0
          ? t("promotions.valueRequired")
          : kind === "percentage" && parsed > 100
            ? t("promotions.percentTooBig")
            : undefined,

      window:
        startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)
          ? t("promotions.windowBackwards")
          : undefined,

      // A narrowed promotion with nothing chosen is the dangerous empty state:
      // no scope rows means **order-wide**, so saving it would quietly apply
      // the discount to everything rather than to nothing.
      targets:
        scopeType !== "order" && targets.length === 0
          ? t("promotions.targetsRequired")
          : undefined,

      // A card is required, and it means an English one.
      //
      // Required because the card *is* the promotion to a customer — `0013`
      // dropped a discount's text columns on that reasoning, so one saved
      // without a card has nothing to show on a phone but an empty frame.
      //
      // English because it is what every device falls back to (`0128`), and
      // `discounts_image_url_locales` refuses a card without it — without this
      // the save would come back as a constraint name. Two messages, because
      // "add a card" to somebody who added an Arabic one is not a thing they
      // can act on.
      image: !imageUrl
        ? t("promotions.imageRequired")
        : !(imageUrl[FALLBACK_LANGUAGE] ?? "").trim()
          ? t("promotions.imageNeedsEnglish")
          : undefined,
    };

    setErrors(found);
    if (
      found.name ||
      found.value ||
      found.window ||
      found.targets ||
      found.image
    ) {
      return;
    }

    onSave({
      name: name.trim(),
      imageUrl,
      placements,
      startsAt,
      endsAt,
      isActive,
      kind,
      value: takesValue ? parsed : 0,
      minSubtotal: optionalNumber(minSubtotal),
      maxDiscount: optionalNumber(maxDiscount),
      maxRedemptionsPerUser: optionalNumber(perUser),
      maxRedemptionsTotal: optionalNumber(total),
      isFirstOrderOnly: firstOrderOnly,
      // `null` leaves them alone — see `ScopeShape`.
      scopes:
        shape.kind === "mixed"
          ? null
          : scopeType === "order"
            ? []
            : targets.map((targetId) => ({ scopeType, targetId })),
    });
  }

  return (
    <EditorPage
      title={initial ? initial.slug : t("promotions.add")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("promotions.tab")}
      /* Two columns — the card on the left, what it does on the right. See the
         grid below. */
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("promotions.save")}
          </Button>
        </>
      }
    >
      {/**
       * The card, and the discount behind it.
       *
       * A promotion is two things and the form was a single column of them: on
       * the left is the **artwork** — its reference, the picture in each
       * language, and where the card is shown; on the right is what it actually
       * *does* — the kind, what it applies to, when it runs, and whether it is
       * live. They are read together, which is why they sit side by side, and
       * the plain-English summary at the foot of the right column is the answer
       * both halves add up to.
       *
       * One column below `lg`, in the order the form always had.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <Field
            label={t("promotions.name")}
            hint={t("promotions.nameHint")}
            error={errors.name}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ramadan-2026"
              disabled={Boolean(initial)}
            />
          </Field>

          {/* One card per language, because the words are inside the picture —
            `0013` dropped a discount's text columns on exactly that reasoning,
            so an Arabic customer shown the English card is looking at an advert
            they cannot read. See `LocalizedImageField`. */}
          <LocalizedImageField
            label={t("images.label")}
            hint={t("promotions.imageHint")}
            value={imageUrl}
            onChange={setImageUrl}
            folder="promotions"
            disabled={pending}
            error={errors.image}
          />

          {/*
          Where the card is shown — a decision, not something derived.

          Toggles rather than a select: the answers are not exclusive, a
          promotion can reasonably be on two screens, and all three fit at once.
          Each says what it means, because "Store" alone does not distinguish
          "on the shop's page" from "for a shop's promotion".
        */}
          <Field
            label={t("promotions.placement")}
            hint={t("promotions.placementHint")}
          >
            {/*
            One switch per screen, not a set of checkboxes.

            The answers are not exclusive — a promotion can reasonably be on two
            screens — and each one is independently on or off, which is what a
            switch says and a checkbox only implies. It also matches every other
            on/off in the product: the shop's Live, the tag's, the promotion's
            own. A second idiom for the same question is one more thing to read.

            Each carries its own line, because "The shop's page" does not say
            *which* shops, and the answer — the ones this promotion covers — is
            the difference between a useful placement and a puzzling one.
          */}
            <div className="flex flex-col gap-md">
              {PLACEMENTS.map((option) => (
                <div
                  key={option}
                  className="flex items-start justify-between gap-lg rounded-md border border-border bg-surface px-lg py-md"
                >
                  <span className="flex min-w-0 flex-col gap-xxs">
                    <span className="text-[14px] font-semibold text-text">
                      {t(`promotions.placements.${option}`)}
                    </span>
                    <span className="text-[12px] text-text-faint">
                      {t(`promotions.placementsHint.${option}`)}
                    </span>
                  </span>

                  <Toggle
                    on={placements.includes(option)}
                    onChange={() =>
                      setPlacements((current) =>
                        current.includes(option)
                          ? current.filter((one) => one !== option)
                          : // Kept in the declared order rather than appended, so
                            // the value written does not depend on the order the
                            // operator happened to press them in.
                            PLACEMENTS.filter(
                              (one) => one === option || current.includes(one),
                            ),
                      )
                    }
                    labelOn={t("promotions.placementOn")}
                    labelOff={t("promotions.placementOff")}
                    className="w-[104px] shrink-0"
                  />
                </div>
              ))}
            </div>
          </Field>
        </div>

        <div className="flex min-w-0 flex-col gap-lg">
          <Section title={t("promotions.discountSection")}>
            <Field label={t("promotions.kind")} hint={t("promotions.kindHint")}>
              <Select
                value={kind}
                onChange={(next) => setKind(next as PromotionKind)}
                options={PROMOTION_KINDS.map((option) => ({
                  value: option,
                  label: t(`promotions.kinds.${option}`),
                  note: t(`promotions.kindNotes.${option}`),
                }))}
              />
            </Field>

            {takesValue && (
              <Field
                label={
                  kind === "percentage"
                    ? t("promotions.percentLabel")
                    : t("promotions.amountLabel")
                }
                hint={
                  kind === "percentage"
                    ? t("promotions.percentHint")
                    : t("promotions.amountHint", { code })
                }
                error={errors.value}
              >
                <Amount
                  value={value}
                  onChange={setValue}
                  decimalDigits={baseDecimals}
                  max={kind === "percentage" ? 100 : undefined}
                  placeholder={kind === "percentage" ? "20" : "5.00"}
                  // A percentage is not money, so it gets no echo — showing
                  // "$0.20" under a field reading 20 would be worse than nothing.
                  money={kind !== "percentage"}
                />
              </Field>
            )}

            <Field
              label={t("promotions.minSubtotal")}
              hint={t("promotions.minSubtotalHint", { code })}
            >
              <Amount
                value={minSubtotal}
                onChange={setMinSubtotal}
                decimalDigits={baseDecimals}
                placeholder={t("promotions.noMinimum")}
                money
              />
            </Field>

            {/* Only where it can bite. A ceiling on a fixed amount is the same
              number twice, and on free delivery it would cap a fee the operator
              does not set here — a control that cannot change the outcome is
              worse than no control. */}
            {kind === "percentage" && (
              <Field
                label={t("promotions.maxDiscount")}
                hint={t("promotions.maxDiscountHint", { code })}
              >
                <Amount
                  value={maxDiscount}
                  onChange={setMaxDiscount}
                  decimalDigits={baseDecimals}
                  placeholder={t("promotions.noCeiling")}
                  money
                />
              </Field>
            )}
          </Section>

          <Section title={t("promotions.whoSection")}>
            <Field
              label={t("promotions.appliesTo")}
              hint={t("promotions.appliesToHint")}
              error={errors.targets}
            >
              {shape.kind === "mixed" ? (
                <p className="rounded-md border border-border bg-neutral-fill px-lg py-md text-[13px] text-text-soft">
                  {t("promotions.scopesMixed")}
                </p>
              ) : (
                <Select
                  value={scopeType}
                  onChange={(next) => setScopeType(next as ScopeType)}
                  options={(
                    ["order", "store", "category", "menuItem"] as ScopeType[]
                  ).map((option) => ({
                    value: option,
                    label: t(`promotions.scopes.${option}`),
                  }))}
                />
              )}
            </Field>

            {shape.kind === "single" && scopeType === "store" && (
              <Field label={t("promotions.pickShops")}>
                <MultiSelect
                  value={storeIds}
                  onChange={setStoreIds}
                  placeholder={t("promotions.pickShopsPlaceholder")}
                  disabled={pending || !stores.isSuccess}
                  options={(stores.data?.stores ?? []).map((store) => ({
                    value: store.id,
                    label: pickLocalized(store.name),
                  }))}
                />
              </Field>
            )}

            {shape.kind === "single" && scopeType === "category" && (
              <Field label={t("promotions.pickCategories")}>
                <MultiSelect
                  value={categoryIds}
                  onChange={setCategoryIds}
                  placeholder={t("promotions.pickCategoriesPlaceholder")}
                  disabled={pending || !categories.isSuccess}
                  options={(categories.data ?? []).map((category) => ({
                    value: category.id,
                    label: pickLocalized(category.name),
                  }))}
                />
              </Field>
            )}

            {shape.kind === "single" && scopeType === "menuItem" && (
              <>
                {/* The shop first, then its dishes.
                  Searching every menu at once looked convenient and was not: a
                  dozen shops sell something called "Hummus", so the list came
                  back as near-identical names told apart only by a shop in grey
                  after them — and picking the wrong one attaches the promotion
                  to another merchant's dish, which nothing downstream
                  questions.
                  The same move the options tab makes: narrow the set before
                  anything is chosen. */}
                <Field label={t("promotions.pickDishShop")}>
                  <Select
                    value={dishStoreId}
                    onChange={(value) => {
                      setDishStoreId(value);
                      // Dishes already chosen belong to the previous shop, and a
                      // promotion holding two shops' dishes under a single-shop
                      // question is a scope nobody intended. Cleared out loud
                      // rather than left to be noticed on the bill.
                      setDishes([]);
                    }}
                    options={(stores.data?.stores ?? []).map((store) => ({
                      value: store.id,
                      label: pickLocalized(store.name),
                    }))}
                    placeholder={t("promotions.pickDishShopPlaceholder")}
                    disabled={pending || !stores.isSuccess}
                  />
                </Field>

                <Field
                  label={t("promotions.pickDishes")}
                  hint={t("promotions.pickDishesHint")}
                >
                  <AsyncMultiSelect
                    value={dishes}
                    onChange={setDishes}
                    loadOptions={async (input) => {
                      if (!dishStoreId) return [];
                      const found = await searchDishes(input, dishStoreId);
                      return found.map((dish) => ({
                        value: dish.id,
                        label: dish.label,
                      }));
                    }}
                    placeholder={t("promotions.pickDishesPlaceholder")}
                    // Nothing to search until a shop is chosen. Disabled rather
                    // than hidden: the field appearing out of nowhere after the
                    // select is answered is a layout jump, and the operator
                    // should be able to see what the next step is.
                    disabled={pending || !dishStoreId}
                    noOptionsMessage={(input) =>
                      !dishStoreId
                        ? t("promotions.pickShopFirst")
                        : input
                          ? t("promotions.noDishes", { term: input })
                          : t("promotions.typeToFindDishes")
                    }
                  />
                </Field>
              </>
            )}

            <Field
              label={t("promotions.firstOrderLabel")}
              hint={t("promotions.firstOrderHint")}
            >
              <Toggle
                on={firstOrderOnly}
                onChange={() => setFirstOrderOnly((current) => !current)}
                labelOn={t("promotions.firstOrderOn")}
                labelOff={t("promotions.firstOrderOff")}
              />
            </Field>

            <Field
              label={t("promotions.perUser")}
              hint={t("promotions.perUserHint")}
            >
              <NumberInput
                min={1}
                step={1}
                value={perUser}
                onChange={(event) => setPerUser(event.target.value)}
                placeholder={t("promotions.noLimit")}
              />
            </Field>

            <Field
              label={t("promotions.totalCap")}
              hint={
                initial
                  ? t("promotions.totalCapHintUsed", {
                      count: initial.redeemed,
                    })
                  : t("promotions.totalCapHint")
              }
            >
              <NumberInput
                min={1}
                step={1}
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                placeholder={t("promotions.noLimit")}
              />
            </Field>
          </Section>

          <Section title={t("promotions.whenSection")}>
            <Field
              label={t("promotions.startsAt")}
              hint={t("promotions.startsHint")}
            >
              <DateField value={startsAt} onChange={setStartsAt} />
            </Field>

            <Field
              label={t("promotions.endsAt")}
              hint={t("promotions.endsHint")}
              error={errors.window}
            >
              <DateField value={endsAt} onChange={setEndsAt} />
            </Field>

            <Field
              label={t("promotions.visibility")}
              hint={t("promotions.visibilityHint")}
            >
              {/* A plain switch, not a confirming one.
                The switch in the *row* confirms, because flipping it there
                publishes or withdraws a promotion straight away. In here
                nothing has happened yet — the form is a draft until Save — and
                asking "are you sure" about a value that is not yet written is
                the empty question `ConfirmButton` warns about. */}
              <Toggle
                on={isActive}
                onChange={() => setIsActive((current) => !current)}
                labelOn={t("promotions.live")}
                labelOff={t("promotions.hidden")}
              />
            </Field>
          </Section>

          {/* What the promotion comes to, assembled from the fields above. The
            settings are individually clear and jointly hard to hold in your
            head — "20%, minimum $25, capped at $10, first order only" is four
            numbers whose combined effect nobody should have to simulate.

            **Not drawn as a field.** A white ground inside a bordered, rounded
            box is the exact shape of every `Input` on the panel, so a line that
            is only ever read looked like one more thing to fill in — at the
            bottom of a form, which is where somebody is checking they have
            filled everything in. A tinted ground with no border says "this is
            the answer, not another question", and the label says whose answer
            it is. */}
          <div className="flex flex-col gap-xxs rounded-md bg-accent-wash px-lg py-md">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              {t("promotions.previewLabel")}
            </span>
            <p className="text-[14px] font-semibold text-text">
              {describeDraft(
                { kind, value, minSubtotal, firstOrderOnly },
                format,
                code,
              )}
            </p>
          </div>
        </div>
      </div>
    </EditorPage>
  );
}

/**
 * A number, with what it comes to underneath.
 *
 * The convention across this dashboard is that money is typed in **minor
 * units** without separators — the menu's price field says so too. That is
 * unambiguous and completely unreadable: `38000` is either three hundred and
 * eighty dollars or thirty-eight thousand lira, and the operator has no way to
 * check which they just typed.
 *
 * So the figure is echoed through `Price`, which is the dashboard's one place
 * that formats an amount and says it in both currencies. The echo appears only
 * once the field holds a number, because a currency symbol under an empty box
 * is a claim that something has been set.
 */
/**
 * A number, or an amount.
 *
 * A percentage is a plain number and is typed as one. An **amount** goes
 * through `MoneyInput`, which takes what a person would say and stores minor
 * units — so this field asks for `25`, not `2500`, and the operator is not
 * doing the database's arithmetic on the screen where a factor of a hundred is
 * a factor of a hundred off somebody's bill.
 *
 * The value is still carried as a string, because the form holds every field
 * that way and an empty box has to stay distinguishable from a zero: `null` is
 * "no minimum", `0` is "a minimum every basket clears", and
 * `discounts_caps_positive` refuses the second where the first was meant.
 */
function Amount({
  value,
  onChange,
  decimalDigits,
  placeholder,
  max,
  money,
}: {
  value: string;
  onChange: (value: string) => void;
  /** `null` until the base currency lands — `MoneyInput` waits rather than
      guessing a scale. A percentage never needs it. */
  decimalDigits: number | null;
  placeholder?: string;
  max?: number;
  /** Off for a percentage, which is a number and not an amount. */
  money?: boolean;
}) {
  if (!money) {
    return (
      <NumberInput
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    );
  }

  const parsed = value.trim() === "" ? null : Number(value);

  return (
    <MoneyInput
      value={parsed !== null && Number.isFinite(parsed) ? parsed : null}
      onChange={(minor) => onChange(minor === null ? "" : String(minor))}
      decimalDigits={decimalDigits}
      placeholder={placeholder}
    />
  );
}

/**
 * A heading over a run of related fields.
 *
 * The form asks three separate questions — what it takes off, who gets it, and
 * when — and thirteen controls in one column reads as a settings dump. The
 * headings are what turn it back into three decisions.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-lg border-t border-border pt-lg">
      <h3 className="ps-md text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The draft in one sentence, for the preview under the form. */
function describeDraft(
  draft: {
    kind: PromotionKind;
    value: string;
    minSubtotal: string;
    firstOrderOnly: boolean;
  },
  format: (minorUnits: number, code: string) => string,
  code: string,
): string {
  const parsed = Number(draft.value);
  const valid = draft.value.trim() !== "" && Number.isFinite(parsed);

  const amount =
    draft.kind === "freeDelivery"
      ? t("promotions.summaryFreeDelivery")
      : !valid
        ? t("promotions.summaryIncomplete")
        : draft.kind === "percentage"
          ? t("promotions.summaryPercent", { value: parsed })
          : t("promotions.summaryFixed", { amount: format(parsed, code) });

  const parts = [amount];

  const minimum = Number(draft.minSubtotal);
  if (
    draft.minSubtotal.trim() !== "" &&
    Number.isFinite(minimum) &&
    minimum > 0
  ) {
    parts.push(t("promotions.summaryOver", { amount: format(minimum, code) }));
  }
  if (draft.firstOrderOnly) parts.push(t("promotions.summaryFirstOrder"));

  return t("promotions.preview", { summary: parts.join(" · ") });
}

/** A nullable number as a field's string. Empty means "not set", never zero. */
function numberField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * A field's string back to a nullable number.
 *
 * Blank is `null` — no minimum, no cap — and **not** zero. The distinction is
 * load-bearing: `discounts_caps_positive` (0066) refuses a cap of zero outright,
 * so writing one where the operator meant "no limit" would turn an empty field
 * into a refused save with a constraint name in it.
 */
function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
