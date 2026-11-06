"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  ListChecks,
  MessageCircleQuestion,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
} from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Menu,
  NativeSelect,
  SearchInput,
  Segmented,
  Skeleton,
  Switch,
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { LocalizedField } from "@/components/ui/localized-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
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
import {
  validateLocalizedText,
  validatePrice,
  type Localized,
} from "@/lib/validation";

import { applyOrder, type MenuSection } from "../api/menu";
import type {
  ItemOption,
  OptionGroupMode,
  StoreQuestion,
} from "../api/options";
import { useBundles } from "../use-bundles";
import { useMenu } from "../use-menu";
import {
  useCreateOptionGroup,
  useItemOptions,
  useOptionCounts,
  useSetQuestionItems,
  useStoreQuestions,
  useUpdateOptionGroup,
} from "../use-options";
import { useStore } from "../use-stores";
import type { RowOrder } from "./dish-row";
import { ItemPickerSheet } from "./item-picker-sheet";

/**
 * The Options tab: every question a shop asks, and which dishes ask it.
 *
 * ## One list, narrowed by a filter
 *
 * There used to be two screens — one starting from a dish, one from a question
 * — showing the same rows in opposite directions. This is one list of the
 * shop's questions; the "Asked on" filter narrows it to a section or to one
 * dish, which is exactly what the dish-first screen showed. With a dish picked,
 * the per-dish facts (is this choice offered *here*, which one does *this* dish
 * open on) become editable, because there is a dish for "here" to mean.
 *
 * The filter lists dishes grouped by section and marks the ones with no
 * questions — a dish with none looks complete everywhere else, and this is the
 * one place to see at a glance which still need setting up.
 *
 * The choice lives in the URL (`?section=&item=`), so the dish page can send
 * the operator here with its dish already chosen.
 *
 * ## Borrowed from the best modifier editors (2026-11)
 *
 * Square's modifier sets and Uber Eats' modifier groups are made once and
 * attached to many items, which is what a question is here. Both show the
 * choices on the closed row — "Small, Medium +$1.00, Large +$2.00" — because
 * that is what tells two similar groups apart, and both say *which* items use
 * one, not only how many. Both let the choices be dragged into order. All
 * three are here.
 */
export function ShopOptionsTab({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const guarded = useGuardedAction();

  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const menu = useMenuWithBundles(storeId);
  const counts = useOptionCounts(storeId);
  const store = useStore(storeId);
  const groups = useStoreQuestions(storeId, search);
  const setItems = useSetQuestionItems();

  const sections = menu.data ?? [];
  const sectionId = params.get("section");
  const itemId = params.get("item");
  const section = sections.find((one) => one.id === sectionId) ?? null;
  const item = section?.items.find((one) => one.id === itemId) ?? null;

  /** Which question is open — one at a time, so the list keeps its shape. */
  const [open, setOpen] = useState<string | null>(null);
  /** Which question's dish picker is open. */
  const [picking, setPicking] = useState<string | null>(null);

  function choose(value: string) {
    const query = new URLSearchParams(params);
    query.delete("section");
    query.delete("item");
    const [kind, first, second] = value.split(":");
    if (kind === "s" && first) query.set("section", first);
    if (kind === "i" && first && second) {
      query.set("section", first);
      query.set("item", second);
    }
    setOpen(null);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  const filterValue = item
    ? `i:${section?.id}:${item.id}`
    : section
      ? `s:${section.id}`
      : "";

  // Narrowed to the picked dish, or to questions asked on at least one dish
  // in the picked section.
  const sectionItemIds = section?.items.map((one) => one.id) ?? null;
  const shown = (groups.data ?? []).filter((group) =>
    item
      ? group.itemIds.includes(item.id)
      : sectionItemIds === null ||
        group.itemIds.some((id) => sectionItemIds.includes(id)),
  );
  // Withdrawn questions live on the Archive tab; the fetch keeps them because
  // it is the archive's source too.
  const offered = shown.filter((group) => group.isActive);
  const withdrawn = shown.length - offered.length;
  const picked = (groups.data ?? []).find((group) => group.id === picking);
  const dishNames = new Map(
    sections.flatMap((one) =>
      one.items.map((dish) => [dish.id, pickLocalized(dish.name)] as const),
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("options.searchPlaceholder")}
          className="w-full sm:w-72"
        />
        <label className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3 max-sm:w-full">
          <span className="shrink-0">{t("options.filterLabel")}</span>
          <NativeSelect
            value={filterValue}
            onChange={(event) => {
              const next = event.target.value;
              // Every open form below belongs to the old filter.
              guarded(() => choose(next))();
            }}
            className="min-w-0 flex-1 sm:w-64"
          >
            <option value="">{t("options.filterAll")}</option>
            {sections.map((one) => (
              <optgroup key={one.id} label={pickLocalized(one.title)}>
                <option value={`s:${one.id}`}>
                  {t("options.filterSection", {
                    name: pickLocalized(one.title),
                  })}
                </option>
                {one.items.map((dish) => (
                  <option key={dish.id} value={`i:${one.id}:${dish.id}`}>
                    {(counts.data?.get(dish.id) ?? 0) === 0
                      ? `${pickLocalized(dish.name)}, ${t("options.noneSet")}`
                      : pickLocalized(dish.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </label>
        <div className="ms-auto">
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus />
            {t("options.newQuestion")}
          </Button>
        </div>
      </div>

      {groups.isSuccess && (offered.length > 0 || withdrawn > 0) && (
        <p className="text-[13px] text-ink-3">
          {item && (
            <>
              <span className="font-medium text-ink">
                {pickLocalized(item.name)}
              </span>
              {", "}
            </>
          )}
          {t("options.questionCount", { count: offered.length })}
          {withdrawn > 0 && (
            <>
              {", "}
              {t("options.withdrawnElsewhere")}
            </>
          )}
        </p>
      )}

      {groups.isPending && (
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-4 shadow-xs"
            >
              <Skeleton className="size-4" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {groups.isError && (
        <div className="rounded-lg border border-line bg-surface shadow-xs">
          <EmptyState
            icon={<AlertCircle />}
            title={t("options.failedTitle")}
            description={
              groups.error instanceof Error
                ? groups.error.message
                : t("common.somethingWentWrong")
            }
            action={
              <Button onClick={() => void groups.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </div>
      )}

      {groups.isSuccess && offered.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface">
          {search.trim() ? (
            <EmptyState
              icon={<SearchX />}
              title={t("options.noMatches")}
              action={
                <Button onClick={() => setSearch("")}>
                  {t("menu.searchClear")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<MessageCircleQuestion />}
              title={item ? t("options.emptyDish") : t("options.emptyAll")}
              description={
                item ? t("options.emptyDishBody") : t("options.emptyAllBody")
              }
              action={
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <Plus />
                  {t("options.newQuestion")}
                </Button>
              }
            />
          )}
        </div>
      )}

      {offered.length > 0 && (
        <div className="flex flex-col gap-3">
          {offered.map((group) => (
            <QuestionCard
              key={group.id}
              group={group}
              currencyCode={store.data?.currencyCode ?? ""}
              itemId={item?.id ?? null}
              dishNames={dishNames}
              open={open === group.id}
              onToggle={() =>
                setOpen((current) => (current === group.id ? null : group.id))
              }
              onPickItems={() => setPicking(group.id)}
            />
          ))}
        </div>
      )}

      <NewQuestionDialog
        open={adding}
        onOpenChange={setAdding}
        storeId={storeId}
        itemId={item?.id ?? null}
        itemName={item ? pickLocalized(item.name) : null}
        sortOrder={groups.data?.length ?? 0}
      />

      <ItemPickerSheet
        question={picked ?? null}
        sections={sections}
        pending={setItems.isPending}
        onClose={() => setPicking(null)}
        onSave={(itemIds) => {
          if (!picked) return;
          setItems.mutate(
            {
              groupId: picked.id,
              itemIds,
              current: picked.itemIds,
              // Every dish gets it in the same slot — the alternative is
              // placing one question twenty times.
              sortOrder: 0,
              name: picked.title,
            },
            { onSuccess: () => setPicking(null) },
          );
        }}
      />
    </div>
  );
}

/** How many dish names "Asked on" spells out before "and N more". */
const ASKED_ON_SHOWN = 6;

/** Nothing excluded — the state almost every (dish, question) pair is in. */
const OFFERS_EVERYTHING: ReadonlySet<string> = new Set<string>();

/** One question: its summary, and — opened — its rules and its answers. */
function QuestionCard({
  group,
  currencyCode,
  itemId,
  dishNames,
  open,
  onToggle,
  onPickItems,
}: {
  group: StoreQuestion;
  currencyCode: string;
  /** Every listed dish's name, for "Asked on". */
  dishNames: ReadonlyMap<string, string>;
  /**
   * The dish the list is filtered to, or null. It is what makes the two
   * per-dish facts editable: without a dish in view there is no answer to
   * "offered *where*".
   */
  itemId: string | null;
  open: boolean;
  onToggle: () => void;
  onPickItems: () => void;
}) {
  const update = useUpdateOptionGroup();
  // One set of mutations for the whole question, handed to its rows.
  const options = useItemOptions();
  const guarded = useGuardedAction();

  const [renaming, setRenaming] = useState(false);
  const [editingChoice, setEditingChoice] = useState<string | null>(null);
  const [addingChoice, setAddingChoice] = useState(false);
  /** Bumped per add, as the add form's key, so it comes back empty. */
  const [added, setAdded] = useState(0);

  const title = pickLocalized(group.title);
  const choices = group.choices.filter((option) => option.isActive);
  const notOffered =
    itemId === null
      ? OFFERS_EVERYTHING
      : (group.notOfferedOn.get(itemId) ?? OFFERS_EVERYTHING);
  const pinned = itemId === null ? null : (group.defaultOn.get(itemId) ?? null);
  /**
   * The dish whose own switches show beside each answer, or none. A question
   * one dish asks gets none — taking a choice off its only dish is what
   * Withdrawn already does — unless that dish already has exclusions or a
   * pinned default, which would otherwise be invisible while still honoured.
   */
  const perItemDish =
    itemId !== null &&
    (group.itemIds.length > 1 || notOffered.size > 0 || pinned !== null)
      ? itemId
      : null;
  const offeredHere = choices.filter((option) => !notOffered.has(option.id));
  const { format } = useMoney();
  /** The choices on the closed card, priced — what tells two groups apart. */
  const choiceLine = offeredHere
    .map((option) =>
      option.price === 0
        ? pickLocalized(option.name)
        : t("options.choicePrice", {
            name: pickLocalized(option.name),
            price: format(option.price, currencyCode),
          }),
    )
    .join(", ");
  const askedOn = group.itemIds
    .map((id) => dishNames.get(id))
    .filter((name): name is string => Boolean(name));

  // The order is the question's, shared by every dish asking it. Only the
  // offered choices are numbered; withdrawn ones are off this screen.
  const choiceOrder = useReorder({
    ids: choices.map((option) => option.id),
    onReorder: (ids) => {
      const { updates } = applyOrder(choices, ids);
      for (const { id, sortOrder } of updates) {
        options.edit.mutate({ id, patch: { sortOrder } });
      }
    },
    labelOf: (id) =>
      pickLocalized(choices.find((option) => option.id === id)?.name ?? {}),
    lifted: "relative z-10 bg-surface shadow-lg ring-2 ring-accent/40",
    disabled: editingChoice !== null,
  });

  const summary = [
    t(group.mode === "single" ? "options.chooseOne" : "options.chooseAny"),
    t(group.minSelections >= 1 ? "options.required" : "options.optional"),
    t("options.count", { count: offeredHere.length }),
    group.itemIds.length === 0
      ? t("commonOptions.usedOnNone")
      : group.itemIds.length === 1
        ? t("commonOptions.usedOnOne")
        : t("commonOptions.usedOn", { count: group.itemIds.length }),
  ].join(", ");

  return (
    <section className="rounded-lg border border-line bg-surface shadow-xs">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-start"
        >
          <ChevronRight
            aria-hidden
            className={cx(
              "mt-0.5 size-4 shrink-0 text-ink-4 transition-transform rtl:rotate-180",
              open && "rotate-90 rtl:rotate-90",
            )}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-ink">
              {title}
            </span>
            <span className="truncate text-[12.5px] text-ink-3">{summary}</span>
            {choiceLine && (
              <span className="truncate text-[12.5px] text-ink-2 tabular-nums">
                {choiceLine}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-between">
          <Button variant="secondary" size="sm" onClick={onPickItems}>
            <ListChecks />
            {t("commonOptions.manageDishes")}
          </Button>
          {/* Withdrawn, not deleted: past orders reference these rows forever.
              Asks both ways, because it changes what customers are asked on a
              shop that is open, and the failure is silent from this side. */}
          <ConfirmToggle
            on={group.isActive}
            onChange={async () => {
              await update.mutateAsync({
                id: group.id,
                patch: { isActive: !group.isActive },
              });
            }}
            labelOn={t("options.offeredGroup")}
            labelOff={t("options.withdrawn")}
            params={{ name: title }}
            whenTurningOn={{
              titleKey: "options.offerGroupTitle",
              bodyKey: "options.offerGroupBody",
              confirmKey: "options.offerGroupConfirm",
            }}
            whenTurningOff={{
              titleKey: "options.withdrawGroupTitle",
              bodyKey: "options.withdrawGroupBody",
              confirmKey: "options.withdrawGroupConfirm",
            }}
          />
          <Menu
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("options.moreFor", { name: title })}
              >
                <MoreHorizontal />
              </Button>
            }
            items={[
              {
                label: t("options.renameQuestion"),
                icon: <Pencil />,
                onSelect: () => setRenaming(true),
              },
            ]}
          />
        </div>
      </header>

      {open && (
        <div className="flex flex-col gap-5 border-t border-line px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h4 className="text-[13px] font-semibold text-ink">
                {t("options.askedOn")}
              </h4>
              <p className="text-[13px] text-ink-2">
                {askedOn.length === 0
                  ? t("options.askedOnNone")
                  : askedOn.length > ASKED_ON_SHOWN
                    ? `${askedOn.slice(0, ASKED_ON_SHOWN).join(", ")} ${t(
                        "options.askedOnMore",
                        { count: askedOn.length - ASKED_ON_SHOWN },
                      )}`
                    : askedOn.join(", ")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("options.howMany")} hint={t("options.howManyHint")}>
              <Segmented<OptionGroupMode>
                value={group.mode}
                onChange={(mode) =>
                  mode !== group.mode &&
                  update.mutate({ id: group.id, patch: { mode } })
                }
                items={[
                  { key: "single", label: t("options.chooseOne") },
                  { key: "multi", label: t("options.chooseAny") },
                ]}
              />
            </Field>
            <Field
              label={t("options.mustChoose")}
              hint={t("options.mustChooseHint")}
            >
              <div className="flex h-8 items-center gap-2 text-[13.5px] text-ink-2">
                <Switch
                  checked={group.minSelections >= 1}
                  onCheckedChange={(required) =>
                    update.mutate({
                      id: group.id,
                      patch: { minSelections: required ? 1 : 0 },
                    })
                  }
                  aria-label={t("options.mustChoose")}
                />
                <span aria-hidden>
                  {group.minSelections >= 1
                    ? t("options.required")
                    : t("options.optional")}
                </span>
              </div>
            </Field>
            {group.mode === "multi" && (
              <AtMostField
                key={`${group.maxSelections}`}
                value={group.maxSelections}
                onCommit={(maxSelections) =>
                  update.mutate({
                    id: group.id,
                    patch: { mode: "multi", maxSelections },
                  })
                }
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-[13px] font-semibold text-ink">
                {t("options.choicesHeading")}
              </h4>
              {choiceOrder.sortable && (
                <span className="text-[12px] text-ink-4">
                  {t("options.reorderChoicesHint")}
                </span>
              )}
            </div>
            {choiceOrder.instructions}

            {group.itemIds.length > 1 && (
              <p className="text-[12.5px] text-ink-3">
                {t("commonOptions.editsEverywhere", {
                  count: group.itemIds.length,
                })}
                {perItemDish !== null && ` ${t("commonOptions.exceptOffered")}`}
              </p>
            )}

            {perItemDish !== null && pinned !== null && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-2">
                <span className="text-[12.5px] text-ink-2">
                  {t("commonOptions.ownDefault", {
                    name: pickLocalized(
                      group.choices.find((option) => option.id === pinned)
                        ?.name ?? {},
                    ),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    options.defaultHere.mutate({
                      itemId: perItemDish,
                      groupId: group.id,
                      optionId: null,
                    })
                  }
                >
                  {t("commonOptions.useSharedDefault")}
                </Button>
              </div>
            )}

            <div className="overflow-hidden rounded-md border border-line">
              {choices.length === 0 && (
                <p className="px-4 py-3 text-[13px] text-ink-3">
                  {t(
                    group.choices.length === 0
                      ? "options.noChoices"
                      : "options.allWithdrawn",
                  )}
                </p>
              )}
              <ul className="divide-y divide-line">
                {choiceOrder
                  .ordered(choices, (option) => option.id)
                  .map((option) =>
                    editingChoice === option.id ? (
                      <li key={option.id} className="bg-subtle p-4">
                        <ChoiceForm
                          initial={{ name: option.name, price: option.price }}
                          currencyCode={currencyCode}
                          pending={options.edit.isPending}
                          saveLabel={t("options.saveChoice")}
                          onSave={(draft) =>
                            options.edit.mutate(
                              { id: option.id, patch: draft },
                              { onSuccess: () => setEditingChoice(null) },
                            )
                          }
                          onCancel={guarded(() => setEditingChoice(null))}
                        />
                      </li>
                    ) : (
                      <ChoiceRow
                        key={option.id}
                        option={option}
                        group={group}
                        perItemDish={perItemDish}
                        offeredHere={!notOffered.has(option.id)}
                        isDefaultHere={
                          perItemDish !== null && pinned !== null
                            ? option.id === pinned
                            : option.isDefault
                        }
                        currencyCode={currencyCode}
                        options={options}
                        onEdit={guarded(() => setEditingChoice(option.id))}
                        order={{
                          rowProps: choiceOrder.rowProps,
                          handleProps: choiceOrder.handleProps,
                          sortable: choiceOrder.sortable,
                          carried: choiceOrder.movingId === option.id,
                        }}
                      />
                    ),
                  )}
                {addingChoice ? (
                  <li className="bg-subtle p-4">
                    <ChoiceForm
                      key={added}
                      currencyCode={currencyCode}
                      pending={options.add.isPending}
                      saveLabel={t("options.addOption")}
                      onSave={(draft) =>
                        options.add.mutate(
                          {
                            groupId: group.id,
                            ...draft,
                            sortOrder: group.choices.length,
                          },
                          // Stays open — choices arrive in runs.
                          { onSuccess: () => setAdded((count) => count + 1) },
                        )
                      }
                      onCancel={guarded(() => setAddingChoice(false))}
                    />
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      onClick={() => setAddingChoice(true)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[13.5px] font-medium text-accent transition-colors hover:bg-accent-soft/50"
                    >
                      <Plus className="size-4" />
                      {t("options.addChoiceTo", { name: title })}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <RenameQuestionDialog
        open={renaming}
        onOpenChange={setRenaming}
        initial={group.title}
        pending={update.isPending}
        onSave={(next) =>
          update.mutate(
            { id: group.id, patch: { title: next } },
            { onSuccess: () => setRenaming(false) },
          )
        }
      />
    </section>
  );
}

/**
 * "At most", committed on blur or Enter — a number typed into a field that
 * wrote on every keystroke would save 1, then 12, on its way to 12.
 */
function AtMostField({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 1)) {
      setError(t("options.atMostInvalid"));
      return;
    }
    setError(null);
    if (next !== value) onCommit(next);
  }

  return (
    <Field
      label={t("options.atMost")}
      hint={t("options.atMostHint")}
      error={error}
    >
      {(field) => (
        <NumberInput
          {...field}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={t("options.noLimit")}
          className="w-32"
        />
      )}
    </Field>
  );
}

/**
 * One answer.
 *
 * Two switches that are not the same switch: **Offered / Withdrawn** is the
 * shop's answer about the choice, on every dish, and asks first. **Offered
 * here** is this dish's answer — local, reversible, and it does not ask: a
 * dialog per pizza would wreck a job shaped like "untick the two with no
 * Large". It shows only with a dish in view.
 */
function ChoiceRow({
  option,
  group,
  perItemDish,
  offeredHere,
  isDefaultHere,
  currencyCode,
  options,
  onEdit,
  order,
}: {
  option: ItemOption;
  group: StoreQuestion;
  perItemDish: string | null;
  offeredHere: boolean;
  isDefaultHere: boolean;
  currencyCode: string;
  options: ReturnType<typeof useItemOptions>;
  onEdit: () => void;
  order: RowOrder;
}) {
  const { format } = useMoney();
  const name = pickLocalized(option.name);
  // Only meaningful where the customer must answer and picks one, and only on
  // a choice this dish actually has.
  const defaultable =
    group.minSelections >= 1 && group.mode === "single" && offeredHere;

  return (
    <li
      {...order.rowProps(
        option.id,
        cx(
          "flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-4 py-2.5",
          !offeredHere && "bg-subtle",
        ),
      )}
    >
      {order.sortable && (
        <button
          type="button"
          {...order.handleProps(option.id)}
          className="-ms-2 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink-2 active:cursor-grabbing"
        >
          <GripIcon />
        </button>
      )}
      <span
        className={cx(
          "min-w-0 flex-1 truncate text-[14px]",
          offeredHere ? "text-ink" : "text-ink-4 line-through",
        )}
      >
        {name}
      </span>

      {defaultable && isDefaultHere && (
        <Badge tone="accent">
          {t(
            perItemDish === null ? "options.isDefault" : "options.defaultHere",
          )}
        </Badge>
      )}

      <span className="w-24 shrink-0 text-end text-[13.5px] text-ink-2 tabular-nums">
        {option.price === 0
          ? t("options.free")
          : `+ ${format(option.price, currencyCode)}`}
      </span>

      <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
        {perItemDish !== null && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <Switch
              checked={offeredHere}
              onCheckedChange={() =>
                options.offerHere.mutate({
                  itemId: perItemDish,
                  optionId: option.id,
                  offered: !offeredHere,
                })
              }
              aria-label={`${t("options.offeredHere")} — ${name}`}
            />
            <span aria-hidden className="w-20">
              {offeredHere ? t("options.offeredHere") : t("options.notHere")}
            </span>
          </label>
        )}

        <ConfirmToggle
          on={option.isActive}
          onChange={async () => {
            await options.edit.mutateAsync({
              id: option.id,
              patch: { isActive: !option.isActive },
            });
          }}
          labelOn={t("options.offeredGroup")}
          labelOff={t("options.withdrawn")}
          params={{ name }}
          whenTurningOn={{
            titleKey: "options.offerChoiceTitle",
            bodyKey: "options.offerChoiceBody",
            confirmKey: "options.offerChoiceConfirm",
          }}
          whenTurningOff={{
            titleKey: "options.withdrawChoiceTitle",
            bodyKey: "options.withdrawChoiceBody",
            confirmKey: "options.withdrawChoiceConfirm",
          }}
        />

        <Menu
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("options.choiceMore", { name })}
            >
              <MoreHorizontal />
            </Button>
          }
          items={[
            {
              label: t("options.editChoiceLabel", { name }),
              icon: <Pencil />,
              onSelect: onEdit,
            },
            ...(defaultable && !isDefaultHere
              ? [
                  {
                    label: t(
                      perItemDish === null
                        ? "options.makeDefault"
                        : "options.makeDefaultHere",
                    ),
                    onSelect: () =>
                      // With a dish in view this pins that dish and leaves the
                      // others alone; without one it is the question's own
                      // answer, which every unpinned dish follows.
                      perItemDish === null
                        ? options.makeDefault.mutate({
                            groupId: group.id,
                            optionId: option.id,
                          })
                        : options.defaultHere.mutate({
                            itemId: perItemDish,
                            groupId: group.id,
                            optionId: option.id,
                          }),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </li>
  );
}

/**
 * Naming and pricing an answer — the same form new or not, so the
 * currency-aware price box and the validation are written once.
 */
function ChoiceForm({
  initial,
  currencyCode,
  pending,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial?: { name: Localized; price: number };
  currencyCode: string;
  pending: boolean;
  saveLabel: string;
  onSave: (draft: { name: Localized; price: number }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  // A choice is priced in its dish's currency, which is the shop's.
  const { decimalsOf } = useMoney();

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [price, setPrice] = useState<number | null>(initial?.price ?? 0);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [priceError, setPriceError] = useState<string | undefined>(undefined);

  useUnsavedChanges(
    changed(
      { name, price },
      { name: initial?.name ?? {}, price: initial?.price ?? 0 },
    ),
  );

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.name);
    setNameError(check.ok ? undefined : t(check.key, check.params));
    // An empty box is a free choice — the common case, not an error.
    const amount = price ?? 0;
    const money = validatePrice(amount);
    setPriceError(money.ok ? undefined : t(money.key, money.params));
    if (!check.ok || !money.ok) return;
    onSave({ name, price: amount });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={nameError}
        placeholder={{ en: "Large", ar: "كبير" }}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label={t("options.extraCost")}
          hint={t("options.extraCostHint")}
          error={priceError}
          className="w-full sm:w-64"
        >
          {(field) => (
            <MoneyInput
              {...field}
              value={price}
              onChange={setPrice}
              decimalDigits={decimalsOf(currencyCode)}
              placeholder="0"
            />
          )}
        </Field>
        <div className="ms-auto flex gap-2 pb-6">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" pending={pending}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RenameQuestionDialog({
  open,
  onOpenChange,
  initial,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Localized;
  pending: boolean;
  onSave: (title: Localized) => void;
}) {
  const guarded = useGuardedAction();
  const close = guarded(() => onOpenChange(false));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("options.renameQuestion")}
    >
      {open && (
        <QuestionForm
          initial={{ title: initial, mode: null, required: null }}
          pending={pending}
          submitLabel={t("options.saveTitle")}
          onCancel={close}
          onSave={(fields) => onSave(fields.title)}
        />
      )}
    </Dialog>
  );
}

function NewQuestionDialog({
  open,
  onOpenChange,
  storeId,
  itemId,
  itemName,
  sortOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** The dish to start it on, or null — then it is asked nowhere until dishes are chosen. */
  itemId: string | null;
  itemName: string | null;
  sortOrder: number;
}) {
  const create = useCreateOptionGroup();
  const guarded = useGuardedAction();
  const close = guarded(() => onOpenChange(false));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("options.newQuestion")}
      description={itemName ?? undefined}
    >
      {open && (
        <QuestionForm
          initial={{ title: {}, mode: "single", required: false }}
          pending={create.isPending}
          submitLabel={t("options.saveGroup")}
          onCancel={close}
          onSave={(fields) =>
            create.mutate(
              {
                draft: {
                  storeId,
                  itemIds: itemId ? [itemId] : [],
                  title: fields.title,
                  mode: fields.mode ?? "single",
                  minSelections: fields.required ? 1 : 0,
                  maxSelections: null,
                },
                sortOrder,
              },
              { onSuccess: () => onOpenChange(false) },
            )
          }
        />
      )}
    </Dialog>
  );
}

/** A question's title, and — when creating — its two rules. */
function QuestionForm({
  initial,
  pending,
  submitLabel,
  onCancel,
  onSave,
}: {
  initial: {
    title: Localized;
    /** Null when the rules are not being asked (renaming). */
    mode: OptionGroupMode | null;
    required: boolean | null;
  };
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSave: (fields: {
    title: Localized;
    mode: OptionGroupMode | null;
    required: boolean | null;
  }) => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const [title, setTitle] = useState<Localized>(initial.title);
  const [mode, setMode] = useState(initial.mode);
  const [required, setRequired] = useState(initial.required);
  const [error, setError] = useState<string | undefined>(undefined);

  const dirty = changed({ title, mode, required }, initial);
  useUnsavedChanges(dirty);

  function submit() {
    const check = validateLocalizedText(title, codes, TEXT.title);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    setError(undefined);
    onSave({ title, mode, required });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <LocalizedField
        label={t("options.groupTitle")}
        hint={t("options.groupTitleHint")}
        value={title}
        onChange={setTitle}
        maxLength={TEXT.title}
        error={error}
        placeholder={{ en: "Choose a size", ar: "اختر الحجم" }}
      />
      {mode !== null && (
        <Field label={t("options.howMany")} hint={t("options.howManyHint")}>
          <Segmented<OptionGroupMode>
            value={mode}
            onChange={setMode}
            items={[
              { key: "single", label: t("options.chooseOne") },
              { key: "multi", label: t("options.chooseAny") },
            ]}
          />
        </Field>
      )}
      {required !== null && (
        <Switch
          checked={required}
          onCheckedChange={setRequired}
          label={t("options.mustChoose")}
          description={t("options.mustChooseHint")}
        />
      )}
      <div className="-mx-6 -mb-5 flex justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={!dirty}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * The shop's menu with its bundles as one more section, first (`0204`). A
 * bundle asks questions the way a dish does — the same links — so it is listed
 * the way a dish is. The section is not a row; its id is never written.
 */
function useMenuWithBundles(storeId: string) {
  const menu = useMenu(storeId);
  const bundles = useBundles("", storeId);

  const rows = bundles.data ?? [];
  const data: MenuSection[] | undefined = menu.data
    ? rows.length > 0
      ? [
          {
            id: BUNDLES_SECTION,
            slug: BUNDLES_SECTION,
            title: { en: t("bundles.tab") },
            imageUrl: null,
            parentId: null,
            sortOrder: -1,
            items: rows.map((bundle) => ({
              id: bundle.id,
              sectionId: BUNDLES_SECTION,
              slug: bundle.id,
              name: bundle.name,
              description: bundle.description ?? {},
              price: bundle.price,
              imageUrl: bundle.imageUrl,
              isActive: bundle.isActive,
              sortOrder: bundle.sortOrder,
              priceUnit: null,
              unitQuantity: null,
              unitStep: null,
              tagIds: [],
            })),
          },
          ...menu.data,
        ]
      : menu.data
    : undefined;

  return { ...menu, data };
}

/** The bundles' place in the filter — not a `menu_sections` id. */
const BUNDLES_SECTION = "bundles";
