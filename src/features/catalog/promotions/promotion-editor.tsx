"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Pencil } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Section,
  Switch,
} from "@/components/ui";
import { ChoiceList } from "@/components/ui/choice-list";
import { DateField } from "@/components/ui/date-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import {
  AsyncMultiSelect,
  MultiSelect,
  type SelectOption,
} from "@/components/ui/select";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { NO_LINK, missingTarget, type TapLink } from "../api/links";
import {
  fetchDishesByIds,
  searchDishes,
  type Promotion,
  type PromotionDraft,
  type Scope,
  type ScopeType,
} from "../api/promotions";
import { useArtworks } from "../use-artworks";
import { useCategories } from "../use-categories";
import {
  useCreatePromotion,
  usePromotions,
  useUpdatePromotion,
} from "../use-promotions";
import { ShopMultiSelect, ShopSelect } from "../shops/shop-select";
import { useStores } from "../use-stores";
import { AsideCard, EditorLayout, EditorPlaceholder } from "./editor-layout";
import { LinkFields } from "./link-fields";
import {
  SCHEDULE_TONE,
  scheduleState,
  useNow,
  windowBackwards,
} from "./schedule";
import { describeTermsList } from "./summary";

const LIST_HREF = "/promotions";
const SCOPE_TYPES: ScopeType[] = ["order", "store", "category", "menuItem"];

/**
 * One promotion, on a page of its own.
 *
 * Every promotion is free delivery, applied on its own when a basket
 * qualifies — there is no code to type, and so no code field. What is decided
 * here is *who* qualifies (a minimum spend, a set of shops, categories or
 * dishes, first orders only), how often, and when. The sentence beside the
 * form is all of that read back in plain words, so the combined effect is
 * checked rather than simulated.
 */
export function PromotionEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const promotions = usePromotions("");
  const rows = promotions.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreatePromotion();
  const update = useUpdatePromotion();

  if (id && !initial) {
    return (
      <EditorPlaceholder
        state={
          promotions.isPending
            ? "pending"
            : promotions.isError
              ? "error"
              : "missing"
        }
        title={t("promotions.edit")}
        notFound={t("promotions.notFound")}
        onRetry={() => void promotions.refetch()}
      />
    );
  }

  return (
    <WithDishes
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => router.replace(LIST_HREF);
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name: initial.slug },
            { onSuccess: done },
          );
        } else {
          // A new promotion goes last — the lowest priority.
          create.mutate({ draft, priority: rows.length }, { onSuccess: done });
        }
      }}
    />
  );
}

/**
 * The scopes as the form can show them: one kind with its targets, or
 * "mixed" for a row set up with several kinds at once — which the form leaves
 * exactly as it is rather than flattening.
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

/** Loads the names of the dishes it is narrowed to before the form opens. */
function WithDishes({
  initial,
  pending,
  onSave,
}: {
  initial?: Promotion;
  pending: boolean;
  onSave: (draft: PromotionDraft) => void;
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

  if (dishIds.length > 0 && dishes.isPending) {
    return (
      <EditorPlaceholder
        state="pending"
        title={initial?.slug ?? t("promotions.add")}
        notFound={null}
      />
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
      initialDishStoreId={dishes.data?.[0]?.storeId ?? null}
      pending={pending}
      onSave={onSave}
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
}: {
  initial?: Promotion;
  shape: ScopeShape;
  initialDishes: SelectOption[];
  initialDishStoreId: string | null;
  pending: boolean;
  onSave: (draft: PromotionDraft) => void;
}) {
  const { format, baseCode, baseDecimals } = useMoney();
  const stores = useStores("");
  const categories = useCategories("");
  const artworks = useArtworks();
  const now = useNow();

  const linked = initial
    ? (artworks.data ?? []).filter(
        (artwork) => artwork.discount?.id === initial.id,
      )
    : [];

  const start = {
    name: initial?.slug ?? "",
    startsAt: initial?.startsAt ?? null,
    endsAt: initial?.endsAt ?? null,
    isActive: initial?.isActive ?? true,
    minSubtotal:
      initial?.minSubtotal && initial.minSubtotal > 0
        ? initial.minSubtotal
        : null,
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
    link: initial?.link ?? NO_LINK,
  };

  const [name, setName] = useState(start.name);
  const [startsAt, setStartsAt] = useState<string | null>(start.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(start.endsAt);
  const [isActive, setIsActive] = useState(start.isActive);
  const [minSubtotal, setMinSubtotal] = useState<number | null>(
    start.minSubtotal,
  );
  const [perUser, setPerUser] = useState(start.perUser);
  const [total, setTotal] = useState(start.total);
  // Shopify's shape: each condition is a choice first ("No minimum" or "A
  // minimum spend", "No limit" or a limit) and a number only once chosen, so
  // an empty box never has to mean "none". Switching a choice off keeps what
  // was typed, in case it is switched back.
  const [hasMinimum, setHasMinimum] = useState(start.minSubtotal !== null);
  const [perUserOn, setPerUserOn] = useState(start.perUser !== "");
  const [totalOn, setTotalOn] = useState(start.total !== "");
  const minimum =
    hasMinimum && minSubtotal && minSubtotal > 0 ? minSubtotal : null;
  const perUserValue = perUserOn ? perUser : "";
  const totalValue = totalOn ? total : "";
  const [firstOrderOnly, setFirstOrderOnly] = useState(start.firstOrderOnly);
  const [scopeType, setScopeType] = useState<ScopeType>(start.scopeType);
  const [storeIds, setStoreIds] = useState<string[]>(start.storeIds);
  const [categoryIds, setCategoryIds] = useState<string[]>(start.categoryIds);
  const [dishes, setDishes] = useState<SelectOption[]>(initialDishes);
  const [link, setLink] = useState<TapLink>(start.link);
  // Which shop's dishes the picker searches. Narrowed first because a dozen
  // shops sell something called "Hummus", and picking the wrong one attaches
  // the promotion to another merchant's dish.
  const [dishStoreId, setDishStoreId] = useState<string>(
    initialDishStoreId ?? "",
  );

  const dirty = changed(
    {
      name,
      startsAt,
      endsAt,
      isActive,
      minSubtotal: minimum,
      perUser: perUserValue,
      total: totalValue,
      firstOrderOnly,
      scopeType,
      storeIds,
      categoryIds,
      dishIds: dishes.map((dish) => dish.value),
      link,
    },
    start,
  );
  useUnsavedChanges(dirty);

  const [errors, setErrors] = useState<{
    name?: string;
    window?: string;
    targets?: string;
    link?: string;
    minimum?: string;
    perUser?: string;
    total?: string;
  }>({});

  function targetsFor(type: ScopeType): string[] {
    if (type === "store") return storeIds;
    if (type === "category") return categoryIds;
    if (type === "menuItem") return dishes.map((dish) => dish.value);
    return [];
  }

  function capError(on: boolean, value: string): string | undefined {
    if (!on) return undefined;
    if (value.trim() === "") return t("promotions.capRequired");
    const parsed = optionalNumber(value);
    if (value.trim() !== "" && parsed === null) {
      return t("promotions.capWhole");
    }
    if (parsed !== null && (parsed < 1 || !Number.isInteger(parsed))) {
      return parsed === 0
        ? t("promotions.capsPositive")
        : t("promotions.capWhole");
    }
    return undefined;
  }

  function submit() {
    const targets = targetsFor(scopeType);
    const found = {
      name: name.trim() === "" ? t("promotions.nameRequired") : undefined,
      window: windowBackwards(startsAt, endsAt)
        ? t("promotions.windowBackwards")
        : undefined,
      // A narrowed promotion with nothing chosen would apply to everything.
      targets:
        shape.kind === "single" && scopeType !== "order" && targets.length === 0
          ? t("promotions.targetsRequired")
          : undefined,
      link: missingTarget(link) ? t("links.targetRequired") : undefined,
      minimum:
        hasMinimum && minimum === null
          ? t("promotions.minimumRequired")
          : undefined,
      perUser: capError(perUserOn, perUser),
      total: capError(totalOn, total),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    onSave({
      name: name.trim(),
      startsAt,
      endsAt,
      isActive,
      minSubtotal: minimum,
      maxRedemptionsPerUser: optionalNumber(perUserValue),
      maxRedemptionsTotal: optionalNumber(totalValue),
      isFirstOrderOnly: firstOrderOnly,
      // `null` leaves a mixed set exactly as it is; empty is order-wide.
      scopes:
        shape.kind === "mixed"
          ? null
          : scopeType === "order"
            ? []
            : targets.map((targetId) => ({ scopeType, targetId })),
      link,
    });
  }

  const storeOptions = (stores.data?.stores ?? []).map((store) => ({
    value: store.id,
    label: pickLocalized(store.name),
  }));
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: pickLocalized(category.name),
  }));
  const namesOf = (ids: string[], options: SelectOption[]) =>
    ids.flatMap((one) => {
      const option = options.find((o) => o.value === one);
      return option ? [option.label] : [];
    });

  const targets =
    scopeType === "store"
      ? namesOf(storeIds, storeOptions)
      : scopeType === "category"
        ? namesOf(categoryIds, categoryOptions)
        : scopeType === "menuItem"
          ? dishes.map((dish) => dish.label)
          : [];

  const details = describeTermsList({
    minimum: minimum ? format(minimum, baseCode) : null,
    firstOrderOnly,
    scopeType: shape.kind === "mixed" ? "mixed" : scopeType,
    targets,
    targetCount: shape.kind === "mixed" ? 0 : targetsFor(scopeType).length,
    startsAt,
    endsAt,
    perUser: positiveOrNull(perUserValue),
    total: positiveOrNull(totalValue),
  });

  const state = initial ? scheduleState(initial, now) : null;

  return (
    <EditorLayout
      dirty={dirty}
      title={initial ? initial.slug : t("promotions.add")}
      description={
        initial
          ? initial.maxRedemptionsTotal
            ? t("promotions.redeemedOf", {
                count: initial.redeemed,
                cap: initial.maxRedemptionsTotal,
              })
            : t("promotions.redeemed", { count: initial.redeemed })
          : t("promotions.newDescription")
      }
      meta={
        state ? (
          <Badge tone={SCHEDULE_TONE[state]} dot>
            {t(`promotions.status.${state}`)}
          </Badge>
        ) : undefined
      }
      footer={
        <>
          <Button asChild variant="secondary">
            <Link href={LIST_HREF}>{t("common.cancel")}</Link>
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            pending={pending}
            disabled={!dirty}
          >
            {initial ? t("promotions.save") : t("promotions.create")}
          </Button>
        </>
      }
      aside={
        <>
          {/* Shopify's discount summary: the name, where it stands, every
              condition as one line, and how it has performed — read back
              while the form is filled, so the combined effect is checked
              rather than simulated. */}
          <AsideCard title={t("promotions.summaryTitle")}>
            <div className="flex flex-col gap-4" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                  {name.trim() || t("promotions.summaryNoName")}
                </span>
                {state ? (
                  <Badge tone={SCHEDULE_TONE[state]} dot>
                    {t(`promotions.status.${state}`)}
                  </Badge>
                ) : (
                  <Badge tone="neutral">{t("promotions.summaryDraft")}</Badge>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[12.5px] font-medium text-ink-3">
                  {t("promotions.summaryDetails")}
                </h3>
                <ul className="flex list-disc flex-col gap-1 ps-4 text-[13px] text-ink-2 marker:text-ink-4">
                  {details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  <li>{t("promotions.noCodes")}</li>
                </ul>
              </div>
              {initial && (
                <div className="flex flex-col gap-1 border-t border-line pt-3">
                  <h3 className="text-[12.5px] font-medium text-ink-3">
                    {t("promotions.summaryPerformance")}
                  </h3>
                  <p className="text-[13px] text-ink tabular-nums">
                    {initial.maxRedemptionsTotal
                      ? t("promotions.redeemedOf", {
                          count: initial.redeemed,
                          cap: initial.maxRedemptionsTotal,
                        })
                      : t("promotions.redeemed", { count: initial.redeemed })}
                  </p>
                </div>
              )}
            </div>
          </AsideCard>

          {/* Pictures live with the other artwork (`0129`); one promotion may
              have a banner and a tile, or none. Add is offered only when there
              is genuinely nothing. */}
          <AsideCard
            title={t("promotions.artworkTitle")}
            description={t("promotions.artworkBody")}
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
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] text-ink">
                          {t(`artworks.formats.${artwork.format}`)}
                        </span>
                      </span>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/artworks/${artwork.id}`}>
                          <Pencil />
                          {t("promotions.artworkChange")}
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : initial ? (
              <Button asChild size="sm">
                <Link href={`/artworks/new?discount=${initial.id}`}>
                  <ImagePlus />
                  {t("promotions.artworkAdd")}
                </Link>
              </Button>
            ) : (
              <p className="text-[12.5px] text-ink-3">
                {t("promotions.artworkSaveFirst")}
              </p>
            )}
          </AsideCard>

          {/* Where a tap on any of its pictures leads — `0137`. Set once for
              the campaign; a picture can still override it. */}
          <Section title={t("promotions.tapSection")}>
            <LinkFields
              value={link}
              onChange={setLink}
              disabled={pending}
              error={errors.link}
            />
          </Section>
        </>
      }
    >
      <Section
        title={t("promotions.basicsSection")}
        bodyClassName="flex flex-col gap-5"
      >
        <Field
          label={t("promotions.name")}
          hint={t("promotions.nameHint")}
          error={errors.name}
        >
          {(wiring) => (
            <Input
              {...wiring}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("promotions.namePlaceholder")}
              // The slug is derived once and never changes: artwork and
              // reports refer to it.
              disabled={Boolean(initial) || pending}
              className="sm:max-w-sm"
            />
          )}
        </Field>
        <div className="rounded-lg border border-line p-4">
          {/* A plain switch: nothing is published until Save. The switch on
              the list row is the one that asks, because it acts at once. */}
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            label={t("promotions.visibility")}
            description={t("promotions.visibilityHint")}
            disabled={pending}
          />
        </div>
      </Section>

      <Section
        title={t("promotions.discountSection")}
        description={t("promotions.discountSectionHint")}
      >
        <ChoiceList
          label={t("promotions.minimumQuestion")}
          value={hasMinimum ? "amount" : "none"}
          onChange={(next) => setHasMinimum(next === "amount")}
          disabled={pending}
          choices={[
            { value: "none", label: t("promotions.noMinimum") },
            {
              value: "amount",
              label: t("promotions.minSubtotal"),
              children: (
                <Field
                  label={t("promotions.minSubtotalAmount")}
                  hint={t("promotions.minSubtotalHint", {
                    code: baseCode || "—",
                  })}
                  error={errors.minimum}
                  className="sm:max-w-xs"
                >
                  <MoneyInput
                    value={minSubtotal}
                    onChange={setMinSubtotal}
                    decimalDigits={baseDecimals}
                    aria-label={t("promotions.minSubtotal")}
                    disabled={pending}
                  />
                </Field>
              ),
            },
          ]}
        />
      </Section>

      <Section
        title={t("promotions.whoSection")}
        description={t("promotions.appliesToHint")}
        bodyClassName="flex flex-col gap-5"
      >
        {shape.kind === "mixed" ? (
          <p className="rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-2">
            {t("promotions.scopesMixed")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <ChoiceList
              label={t("promotions.appliesTo")}
              value={scopeType}
              onChange={setScopeType}
              disabled={pending}
              choices={SCOPE_TYPES.map((option) => ({
                value: option,
                label: t(`promotions.scopes.${option}`),
                children:
                  option === "store" ? (
                    <ShopMultiSelect
                      aria-label={t("promotions.pickShops")}
                      value={storeIds}
                      onChange={setStoreIds}
                      placeholder={t("promotions.pickShopsPlaceholder")}
                      disabled={pending}
                    />
                  ) : option === "category" ? (
                    <MultiSelect
                      aria-label={t("promotions.pickCategories")}
                      value={categoryIds}
                      onChange={setCategoryIds}
                      placeholder={t("promotions.pickCategoriesPlaceholder")}
                      disabled={pending || !categories.isSuccess}
                      options={categoryOptions}
                    />
                  ) : option === "menuItem" ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <Field label={t("promotions.pickDishShop")}>
                        {(wiring) => (
                          <ShopSelect
                            {...wiring}
                            value={dishStoreId}
                            onChange={(value) => {
                              setDishStoreId(value);
                              setDishes([]);
                            }}
                            placeholder={t(
                              "promotions.pickDishShopPlaceholder",
                            )}
                            disabled={pending}
                          />
                        )}
                      </Field>
                      <Field
                        label={t("promotions.pickDishes")}
                        hint={t("promotions.pickDishesHint")}
                      >
                        {(wiring) => (
                          <AsyncMultiSelect
                            {...wiring}
                            value={dishes}
                            onChange={setDishes}
                            loadOptions={async (input) => {
                              if (!dishStoreId) return [];
                              const found = await searchDishes(
                                input,
                                dishStoreId,
                              );
                              return found.map((dish) => ({
                                value: dish.id,
                                label: dish.label,
                              }));
                            }}
                            placeholder={t("promotions.pickDishesPlaceholder")}
                            disabled={pending || !dishStoreId}
                            noOptionsMessage={(input) =>
                              !dishStoreId
                                ? t("promotions.pickShopFirst")
                                : input
                                  ? t("promotions.noDishes", { term: input })
                                  : t("promotions.typeToFindDishes")
                            }
                          />
                        )}
                      </Field>
                    </div>
                  ) : undefined,
              }))}
            />
            {errors.targets && (
              <p role="alert" className="text-[12.5px] text-danger-ink">
                {errors.targets}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-line pt-5">
          <ChoiceList
            label={t("promotions.firstOrderLabel")}
            value={firstOrderOnly ? "first" : "anyone"}
            onChange={(next) => setFirstOrderOnly(next === "first")}
            disabled={pending}
            choices={[
              { value: "anyone", label: t("promotions.firstOrderOff") },
              {
                value: "first",
                label: t("promotions.firstOrderOn"),
                description: t("promotions.firstOrderHint"),
              },
            ]}
          />
        </div>
      </Section>

      <Section
        title={t("promotions.limitsSection")}
        description={
          initial
            ? t("promotions.usedSoFar", { count: initial.redeemed })
            : t("promotions.limitsSectionHint")
        }
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2.5">
          <Checkbox
            checked={totalOn}
            onCheckedChange={setTotalOn}
            label={t("promotions.totalCapOn")}
            disabled={pending}
          />
          {totalOn && (
            <Field
              label={t("promotions.totalCap")}
              error={errors.total}
              className="ms-[26px] sm:max-w-[200px]"
            >
              {(wiring) => (
                <NumberInput
                  {...wiring}
                  min={1}
                  step={1}
                  value={total}
                  onChange={(event) => setTotal(event.target.value)}
                  disabled={pending}
                />
              )}
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <Checkbox
            checked={perUserOn}
            onCheckedChange={setPerUserOn}
            label={t("promotions.perUserOn")}
            disabled={pending}
          />
          {perUserOn && (
            <Field
              label={t("promotions.perUser")}
              error={errors.perUser}
              className="ms-[26px] sm:max-w-[200px]"
            >
              {(wiring) => (
                <NumberInput
                  {...wiring}
                  min={1}
                  step={1}
                  value={perUser}
                  onChange={(event) => setPerUser(event.target.value)}
                  disabled={pending}
                />
              )}
            </Field>
          )}
        </div>
      </Section>

      <Section
        title={t("promotions.whenSection")}
        description={t("promotions.whenSectionHint")}
        bodyClassName="grid grid-cols-1 gap-5 sm:grid-cols-2"
      >
        <Field
          label={t("promotions.startsAt")}
          hint={t("promotions.startsHint")}
        >
          <DateField
            value={startsAt}
            onChange={setStartsAt}
            disabled={pending}
          />
        </Field>
        <Field
          label={t("promotions.endsAt")}
          hint={t("promotions.endsHint")}
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

function numberField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveOrNull(value: string): number | null {
  const parsed = optionalNumber(value);
  return parsed !== null && parsed >= 1 ? parsed : null;
}
