"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ROW } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { NumberInput } from "@/components/ui/number-input";
import {
  StickyAddBar,
  StickyAddTop,
  useStickyAdd,
} from "@/components/ui/sticky-add";
import { Panel } from "@/components/ui/panel";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import {
  AsyncMultiSelect,
  MultiSelect,
  Select,
  type SelectOption,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { Price } from "@/features/reference/price";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatDate } from "@/lib/time";

import {
  PROMOTION_KINDS,
  fetchDishesByIds,
  searchDishes,
  type Promotion,
  type PromotionDraft,
  type PromotionKind,
  type Scope,
  type ScopeType,
} from "./api/promotions";
import { useCategories } from "./use-categories";
import {
  useArchivePromotion,
  useCreatePromotion,
  usePromotions,
  useReorderPromotions,
  useUpdatePromotion,
} from "./use-promotions";
import { useStores } from "./use-stores";

/**
 * The promotions on the app's home screen — the card, and what it takes off.
 *
 * ## This screen used to manage artwork only, and said so
 *
 * It was labelled "banners" because `place_order` hardcoded a zero discount:
 * `kind`, `value` and the caps were columns nothing read, and putting a "20%
 * off" field on the screen would have offered a decision with no consequence.
 *
 * `0076` built the engine, so those fields now do what they say. The screen
 * gained them and lost the disclaimer.
 *
 * ## Dragging a row decides who wins
 *
 * `priority` is the app's display order *and* the engine's tiebreak: one
 * discount per order, lowest priority first, ties going to the larger amount.
 * So the drag handle on this list is the most consequential control on it —
 * more so than on the categories list, where the order only decides what is
 * seen first.
 *
 * ## A card can be on and invisible
 *
 * The app shows one only while it is switched on **and** inside its dates, so
 * "Live" on a promotion that ended last week is true and useless. The row says
 * which of those it is, because nothing else on the screen would.
 */
export function PromotionsList() {
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering are different jobs and cannot both be on: a
   * position among matches is not a priority, so dragging while filtered would
   * write an order nobody chose — and here that order decides which promotion a
   * customer gets. The handles go away and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const promotions = usePromotions(searching ? search : "");
  const create = useCreatePromotion();
  const update = useUpdatePromotion();
  const archive = useArchivePromotion();
  const reorder = useReorderPromotions();

  /** The row the panel is editing, or `"new"` while one is being added. */
  const [open, setOpen] = useState<string | null>(null);

  const rows = promotions.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

  /**
   * The pinned "add" bar — see `useStickyAdd` for why there are two
   * buttons and why they are never on screen together.
   */
  const { attachTop, attachAddButton, showAddBar } = useStickyAdd(!searching);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      // A position in this list *is* the priority — renumbered from zero, so
      // the stored order is always the order on screen.
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, priority: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.priority === row.priority
          ? []
          : [{ id: row.id, priority: row.priority }];
      });
      reorder.mutate({ updates, next });
    },
    labelOf: (id) => rows.find((row) => row.id === id)?.slug ?? "",
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="relative flex min-w-0 flex-grow flex-col">
        {/* The same bar as the shops, categories and tags — same border, same
            padding, same place for the box. */}
        <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
          <h1 className="flex-grow text-[24px]">{t("promotions.tab")}</h1>
          {searching && (
            <span className="text-[13px] text-text-faint">
              {t("promotions.searchNoDrag")}
            </span>
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("promotions.search")}
            aria-label={t("promotions.search")}
            className="w-[260px]"
          />
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          <StickyAddTop attach={attachTop} />

          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("promotions.searchHint")}
          </p>

          {promotions.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[90px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {promotions.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {promotions.error instanceof Error
                ? promotions.error.message
                : t("common.somethingWentWrong")}
            </p>
          )}

          {order.instructions}

          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                promotion={row}
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onToggleActive={() => {
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onArchive={async () => {
                  setOpen(null);
                  await archive.mutateAsync({ id: row.id, name: row.slug });
                }}
              />
            ))}

          {searching && rows.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[14px] text-text-soft">
              {t("promotions.searchNone", { term: search.trim() })}
            </p>
          )}

          {/* Where a new promotion actually goes: the end of the list, which is
              also the lowest priority. The pinned bar below is a shortcut to
              this one, and only exists while this one is out of sight. */}
          {promotions.isSuccess && !searching && (
            <div ref={attachAddButton} className="mt-lg">
              <Button fullWidth onClick={() => setOpen("new")}>
                {t("promotions.add")}
              </Button>
            </div>
          )}
        </div>

        {promotions.isSuccess && (
          <StickyAddBar visible={showAddBar}>
            <Button fullWidth onClick={() => setOpen("new")}>
              {t("promotions.add")}
            </Button>
          </StickyAddBar>
        )}
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("promotions.formLabel")}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <h2 className="flex-grow text-[20px]">
                {editing ? editing.slug : t("promotions.add")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label={t("common.close")}
                className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft hover:bg-neutral-fill lg:flex"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <Editor
              key={open}
              initial={editing ?? undefined}
              pending={create.isPending || update.isPending}
              onSave={(draft) => {
                if (editing) {
                  update.mutate(
                    { id: editing.id, patch: draft, name: editing.slug },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    { draft, priority: rows.length },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
              onCancel={() => setOpen(null)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function Row({
  promotion,
  open,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  promotion: Promotion;
  open: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const { format, currencies } = useMoney();
  const code = currencies?.[0]?.code ?? "";

  const row = rowProps(
    promotion.id,
    cx(
      ROW,
      !promotion.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      promotion.isActive && !open && "border-border",
      promotion.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row}>
      <button {...handleProps(promotion.id)}>
        <GripIcon />
      </button>

      {/* Wide, because that is the shape it is on the home screen and the
          picture is the whole content — a thumbnail would show the middle of a
          card and tell nobody whether it reads. */}
      {promotion.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={promotion.imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "h-[64px] w-[128px] shrink-0 rounded-md object-cover",
            !promotion.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-[64px] w-[128px] shrink-0 items-center justify-center rounded-md bg-neutral-fill text-[11px] text-text-faint"
        >
          {t("promotions.noArtwork")}
        </div>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col gap-xxs text-left"
      >
        <span className="truncate text-[15px] font-semibold">
          {promotion.slug}
        </span>
        {/* What it actually does, first — the slug is a filename and says
            nothing about the money. */}
        <span className="truncate text-[13px] text-text-soft">
          {describeDiscount(promotion, format, code)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {describeWindow(promotion)}
        </span>
      </button>

      {/* The count is the only thing on the screen that says whether it is
          working. A cap means nothing without it, and a promotion nobody has
          redeemed is usually one whose scope or minimum is wrong. */}
      <span className="shrink-0 tabular-nums text-[12px] text-text-faint">
        {promotion.maxRedemptionsTotal
          ? t("promotions.redeemedOf", {
              count: promotion.redeemed,
              cap: promotion.maxRedemptionsTotal,
            })
          : t("promotions.redeemed", { count: promotion.redeemed })}
      </span>

      <ConfirmToggle
        on={promotion.isActive}
        onChange={onToggleActive}
        labelOn={t("promotions.live")}
        labelOff={t("promotions.hidden")}
        params={{ name: promotion.slug }}
        whenTurningOn={{
          titleKey: "promotions.showTitle",
          bodyKey: "promotions.showBody",
          confirmKey: "promotions.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "promotions.hideTitle",
          bodyKey: "promotions.hideBody",
          confirmKey: "promotions.hideConfirm",
        }}
        className="w-[104px]"
      />

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="promotions.archiveTitle"
        bodyKey="promotions.archiveBody"
        confirmKey="promotions.archiveConfirm"
        params={{ name: promotion.slug }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("promotions.archive")}
      </ConfirmButton>
    </div>
  );
}

/** "20% off · over $25 · first order" — what the promotion does, in one line. */
function describeDiscount(
  promotion: Promotion,
  format: (minorUnits: number, code: string) => string,
  code: string,
): string {
  const amount =
    promotion.kind === "percentage"
      ? t("promotions.summaryPercent", { value: promotion.value })
      : promotion.kind === "fixedAmount"
        ? t("promotions.summaryFixed", {
            amount: format(promotion.value, code),
          })
        : t("promotions.summaryFreeDelivery");

  const parts = [amount];
  if (promotion.minSubtotal) {
    parts.push(
      t("promotions.summaryOver", {
        amount: format(promotion.minSubtotal, code),
      }),
    );
  }
  if (promotion.isFirstOrderOnly) parts.push(t("promotions.summaryFirstOrder"));
  if (promotion.scopes.length > 0) {
    parts.push(
      t("promotions.summaryScoped", { count: promotion.scopes.length }),
    );
  }

  return parts.join(" · ");
}

/**
 * The window, in words, and whether it is live *now*.
 *
 * The app shows a card only while it is switched on **and** inside its dates, so
 * a promotion can be on and invisible. That is the state worth naming: an
 * operator looking at a switch reading "Live" on one that ended last week has no
 * other way to find out.
 */
function describeWindow(promotion: Promotion): string {
  const now = Date.now();
  const started =
    !promotion.startsAt || new Date(promotion.startsAt).getTime() <= now;
  const ended = Boolean(
    promotion.endsAt && new Date(promotion.endsAt).getTime() < now,
  );

  if (promotion.isActive && ended) return t("promotions.ended");
  if (promotion.isActive && !started) {
    return t("promotions.startsOn", { when: formatDate(promotion.startsAt!) });
  }

  if (!promotion.startsAt && !promotion.endsAt) return t("promotions.always");
  if (promotion.startsAt && promotion.endsAt) {
    return t("promotions.between", {
      from: formatDate(promotion.startsAt),
      to: formatDate(promotion.endsAt),
    });
  }
  if (promotion.endsAt) {
    return t("promotions.until", { to: formatDate(promotion.endsAt) });
  }
  return t("promotions.from", { from: formatDate(promotion.startsAt!) });
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

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
function Editor({
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
  pending,
  onSave,
  onCancel,
}: {
  initial?: Promotion;
  shape: ScopeShape;
  initialDishes: SelectOption[];
  pending: boolean;
  onSave: (draft: PromotionDraft) => void;
  onCancel: () => void;
}) {
  const { format, currencies } = useMoney();
  const code = currencies?.[0]?.code ?? "";

  const stores = useStores("");
  const categories = useCategories("");

  const [name, setName] = useState(initial?.slug ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
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

  const [errors, setErrors] = useState<{
    name?: string;
    value?: string;
    window?: string;
    targets?: string;
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
    };

    setErrors(found);
    if (found.name || found.value || found.window || found.targets) return;

    onSave({
      name: name.trim(),
      imageUrl,
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
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

        <Field label={t("images.label")} hint={t("promotions.imageHint")}>
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            folder="categories"
            disabled={pending}
          />
        </Field>

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
                  : t("promotions.amountHint")
              }
              error={errors.value}
            >
              <Amount
                value={value}
                onChange={setValue}
                code={code}
                max={kind === "percentage" ? 100 : undefined}
                placeholder={kind === "percentage" ? "20" : "500"}
                // A percentage is not money, so it gets no echo — showing
                // "$0.20" under a field reading 20 would be worse than nothing.
                money={kind !== "percentage"}
              />
            </Field>
          )}

          <Field
            label={t("promotions.minSubtotal")}
            hint={t("promotions.minSubtotalHint")}
          >
            <Amount
              value={minSubtotal}
              onChange={setMinSubtotal}
              code={code}
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
              hint={t("promotions.maxDiscountHint")}
            >
              <Amount
                value={maxDiscount}
                onChange={setMaxDiscount}
                code={code}
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
            <Field
              label={t("promotions.pickDishes")}
              hint={t("promotions.pickDishesHint")}
            >
              <AsyncMultiSelect
                value={dishes}
                onChange={setDishes}
                loadOptions={async (input) => {
                  const found = await searchDishes(input);
                  return found.map((dish) => ({
                    value: dish.id,
                    label: dish.label,
                  }));
                }}
                placeholder={t("promotions.pickDishesPlaceholder")}
                disabled={pending}
                noOptionsMessage={(input) =>
                  input
                    ? t("promotions.noDishes", { term: input })
                    : t("promotions.typeToFindDishes")
                }
              />
            </Field>
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
                ? t("promotions.totalCapHintUsed", { count: initial.redeemed })
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
            numbers whose combined effect nobody should have to simulate. */}
        <p className="rounded-md border border-border bg-surface px-lg py-md text-[13px] text-text-soft">
          {describeDraft(
            { kind, value, minSubtotal, firstOrderOnly },
            format,
            code,
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("promotions.save")}
        </Button>
      </div>
    </div>
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
function Amount({
  value,
  onChange,
  code,
  placeholder,
  max,
  money,
}: {
  value: string;
  onChange: (value: string) => void;
  code: string;
  placeholder?: string;
  max?: number;
  /** Off for a percentage, which is a number and not an amount. */
  money?: boolean;
}) {
  const parsed = Number(value);
  const show =
    money && value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="flex flex-col gap-xs">
      <NumberInput
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {show && (
        <span className="ps-md">
          <Price value={parsed} code={code} className="text-[13px]" />
        </span>
      )}
    </div>
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
