"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { Collapse } from "@/components/ui/collapse";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { useRevealOnMount } from "@/components/ui/reveal";
import { Select } from "@/components/ui/select";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Toggle } from "@/components/ui/toggle";
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

import type { ItemOption, OptionGroupMode, StoreQuestion } from "./api/options";
import { BulkForm } from "./bulk-form";
import { useMenu } from "./use-menu";
import {
  useCreateOptionGroup,
  useItemOptions,
  useOptionCounts,
  useSetQuestionItems,
  useStoreQuestions,
  useUpdateOptionGroup,
} from "./use-options";
import { useStore } from "./use-stores";

/**
 * Setting up the questions a dish asks.
 *
 * ## Pick a section, then a dish, then work
 *
 * Every option group belongs to exactly one menu item (migration 0074), so this
 * screen's first job is to say *which* item. Two selects do that, in the order a
 * person holds a menu in their head: the section narrows a shop of forty dishes
 * to six, and the dish is chosen from those six. Items appear only once a
 * section is picked, because a flat list of every dish in the shop is precisely
 * what the section select exists to avoid.
 *
 * ## The picker says which dishes have nothing
 *
 * A dish with no questions is invisible everywhere else — the menu row looks
 * complete, and the customer simply never gets asked about size. So the item
 * select marks them. That turns "which of my dishes still need setting up" from
 * a dish-by-dish audit into a glance at one list, which is the reason to have a
 * picker here rather than a link from each menu row.
 *
 * ## The choice lives in the URL
 *
 * `?section=&item=`, so a view can be linked and reloaded — and so the menu item
 * editor can send the operator straight here with the dish already chosen,
 * rather than to two empty selects and a memory test.
 */
export function StoreOptions({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const menu = useMenu(storeId);
  const counts = useOptionCounts(storeId);
  const store = useStore(storeId);

  const sections = menu.data ?? [];
  const sectionId = params.get("section");
  const itemId = params.get("item");

  const section = sections.find((one) => one.id === sectionId) ?? null;
  const item = section?.items.find((one) => one.id === itemId) ?? null;

  function choose(next: { section?: string | null; item?: string | null }) {
    const query = new URLSearchParams(params);
    if (next.section !== undefined) {
      if (next.section) query.set("section", next.section);
      else query.delete("section");
      // A dish from the previous section is not in this one, so choosing a
      // section always clears the dish rather than leaving a selection that
      // belongs somewhere else.
      query.delete("item");
    }
    if (next.item !== undefined) {
      if (next.item) query.set("item", next.item);
      else query.delete("item");
    }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    /*
      Stacked, not split.
     *
     * It was a 380px column of filters beside the questions, and the two never
     * agreed about what the screen was: the left side had two short selects and
     * a paragraph, the right had the whole list, and the column stayed
     * full-height and mostly empty however few questions there were. On a shop
     * with one question it was a third of the screen holding a dropdown.
     *
     * The filters are a bar now — both selects on one line, the list under
     * them, full width. That is also the order the work happens in: narrow,
     * then read. A filter beside its results asks the operator to look sideways
     * for the cause of what changed.
     */
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-lg border-b border-border bg-surface p-xxl">
        <p className="ps-md text-[13px] text-text-faint">
          {t("options.tabHint")}
        </p>

        {/* Side by side, and each capped rather than sharing the width
            equally: a section name and a dish name are short, and two selects
            stretched across a wide monitor would be a filter bar that reads as
            the page's main content. They wrap on a narrow one. */}
        <div className="flex flex-wrap items-start gap-lg [&>*]:w-[320px] [&>*]:max-w-full">
          <Field label={t("options.section")} hint={t("options.sectionHint")}>
            <Select
              value={sectionId ?? ""}
              onChange={(value) => choose({ section: value || null })}
              placeholder={t("options.pickSection")}
              isClearable
              options={sections.map((one) => ({
                value: one.id,
                label: pickLocalized(one.title),
              }))}
            />
          </Field>

          {section && (
            <Field label={t("options.item")} hint={t("options.itemHint")}>
              <Select
                value={itemId ?? ""}
                onChange={(value) => choose({ item: value || null })}
                placeholder={t("options.pickItem")}
                isClearable
                options={section.items.map((one) => ({
                  value: one.id,
                  label: pickLocalized(one.name),
                  // The marker. A dish with no questions looks complete
                  // everywhere else in the dashboard; this is the only place it
                  // can be seen at a glance.
                  note:
                    (counts.data?.get(one.id) ?? 0) === 0
                      ? t("options.noneSet")
                      : undefined,
                }))}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Always a list. It used to say "pick a section" into an empty panel,
            which was the only thing this screen could do before a question
            could be asked on more than one item — there was no shop-wide view
            for it to fall back to. Now there is, and it is the default. */}
        <ItemQuestions
          key={item?.id ?? "all"}
          storeId={storeId}
          itemId={item?.id ?? null}
          itemName={
            item
              ? pickLocalized(item.name)
              : store.data
                ? pickLocalized(store.data.name)
                : ""
          }
        />
      </div>
    </div>
  );
}

/**
 * Every question this shop asks, narrowed to one item when one is picked.
 *
 * ## Why one list and not two screens
 *
 * There were two: an Options tab that started from an item and showed its
 * questions, and a Common options tab that started from a question and showed
 * its items. Same rows, opposite directions — and the split meant repricing a
 * choice was done in one place while deciding who asks about it was done in
 * another, with no way to see both facts at once.
 *
 * So the selects on the left became a **filter** rather than the way in. With
 * nothing picked this is the shop's questions; pick a section and it narrows;
 * pick an item and it is that item's, which is exactly what the old Options tab
 * showed. Nothing was taken away — the previous view is one selection deep.
 */
function ItemQuestions({
  storeId,
  itemId,
  itemName,
}: {
  storeId: string;
  /** Null when no item is picked: the list is then the whole shop's. */
  itemId: string | null;
  /** The heading — the item's name, or the shop's own. */
  itemName: string;
}) {
  const groups = useStoreQuestions(storeId);
  const menu = useMenu(storeId);
  const setItems = useSetQuestionItems();
  const [adding, setAdding] = useState(false);
  /** Which question's item picker is open. One at a time — it is a menu. */
  const [picking, setPicking] = useState<string | null>(null);

  /**
   * Which question is open, or none.
   *
   * **Collapsed by default, and one at a time.** A question expanded is two
   * switches, a number and every one of its choices; four of those open at once
   * is a screen nobody can see the shape of, and the shape — *which* questions
   * this dish asks — is what somebody arriving here wants first. Opening one
   * closes the last, because the reason to open a second is almost always to
   * compare it with the first, and two is already more than fits.
   */
  const [open, setOpen] = useState<string | null>(null);

  /**
   * Only the questions this dish still asks.
   *
   * Withdrawn ones used to sit here greyed out, and the reason given was that a
   * withdrawn question with nowhere to go could never be brought back. That is
   * no longer true: the Archive tab lists them and restores them. Leaving them
   * here as well would put the same row in two places — one of which is a list
   * whose whole job is to say *what this dish asks*, a question a withdrawn row
   * answers wrongly.
   *
   * The fetch still returns them, deliberately. It is the archive's source too,
   * and a `is_active` filter in the query would make this screen right and that
   * one empty.
   */
  const shown = (groups.data ?? []).filter(
    (group) => itemId === null || group.itemIds.includes(itemId),
  );
  const offered = shown.filter((group) => group.isActive);
  const withdrawn = shown.length - offered.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        <h2 className="ps-md text-[20px]">{itemName}</h2>

        {groups.isPending && (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        )}

        {/* Failure says what failed. A refused query drawing an empty list is
            indistinguishable from a dish with no questions, and the operator
            would be told "there are none" by a screen that has no idea. */}
        {groups.isError && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {groups.error instanceof Error
              ? groups.error.message
              : t("common.somethingWentWrong")}
          </p>
        )}

        {groups.isSuccess && offered.length === 0 && !adding && (
          <EmptyState titleKey="options.noQuestions" mood="waiting" />
        )}

        {/* Said only when something is actually missing from the list, so it is
            an explanation rather than a standing notice nobody reads. */}
        {withdrawn > 0 && (
          <p className="ps-md text-[13px] text-text-faint">
            {t("options.withdrawnElsewhere")}
          </p>
        )}

        {offered.map((group) =>
          picking === group.id ? (
            <ItemPicker
              key={group.id}
              question={group}
              sections={menu.data ?? []}
              pending={setItems.isPending}
              onCancel={() => setPicking(null)}
              onSave={(itemIds) =>
                setItems.mutate(
                  {
                    groupId: group.id,
                    itemIds,
                    current: group.itemIds,
                    // Every item gets it in the same slot. The alternative is
                    // asking somebody to place one question twenty times.
                    sortOrder: 0,
                    name: group.title,
                  },
                  { onSuccess: () => setPicking(null) },
                )
              }
            />
          ) : (
            <Question
              key={group.id}
              group={group}
              storeId={storeId}
              itemId={itemId}
              open={open === group.id}
              onToggle={() =>
                setOpen((current) => (current === group.id ? null : group.id))
              }
              onPickItems={() => setPicking(group.id)}
            />
          ),
        )}

        {adding && (
          <NewQuestion
            storeId={storeId}
            itemId={itemId}
            sortOrder={groups.data?.length ?? 0}
            onDone={() => setAdding(false)}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center border-t border-border bg-surface p-lg">
        <Button fullWidth onClick={() => setAdding(true)} disabled={adding}>
          {t("options.addGroup")}
        </Button>
      </div>
    </div>
  );
}

/** Nothing excluded — the state almost every (item, question) pair is in. */
const OFFERS_EVERYTHING: ReadonlySet<string> = new Set<string>();

/** One question: its rules, then its answers. */
function Question({
  group,
  storeId,
  itemId,
  open,
  onToggle,
  onPickItems,
}: {
  group: StoreQuestion;
  storeId: string;
  /**
   * The item the list is filtered to, or null for the whole shop.
   *
   * It is what makes the two per-item facts editable. Without a dish in view
   * there is no answer to "offered *where*", and a switch that had to guess
   * would be a switch that changed a dish nobody was looking at.
   */
  itemId: string | null;
  open: boolean;
  onToggle: () => void;
  /** Opens the picker that says which items ask this. */
  onPickItems: () => void;
}) {
  const store = useStore(storeId);
  const update = useUpdateOptionGroup();
  // One set of mutations for the whole question, handed down to its rows. Six
  // choices calling `useItemOptions` themselves would be six copies of six
  // mutations, each with its own pending state, for six rows that write to the
  // same two tables.
  const options = useItemOptions();

  /**
   * How choices are being added: not at all, one at a time, or as a list.
   *
   * One state rather than two booleans. They are mutually exclusive — a form
   * and a paste box open together would be two Add buttons doing nearly the
   * same thing — and two booleans is a fourth state that means nothing.
   */
  const [adding, setAdding] = useState<"none" | "one" | "bulk">("none");
  /** Which answer is being corrected. One at a time — a row is either a row or
      a form, and two open forms in a list is two places to press Save. */
  const [editingChoice, setEditingChoice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  /**
   * Bumped on every successful add, and used as the add form's `key`.
   *
   * The form stays open because choices arrive in runs, and it has to come back
   * empty for the next one. Remounting is what clears it — resetting the fields
   * by hand meant the price box's own draft string survived, so the previous
   * choice's figure sat in a form that had already been submitted.
   */
  const [added, setAdded] = useState(0);
  const currencyCode = store.data?.currencyCode ?? "";

  /**
   * Only the answers this question still offers.
   *
   * Same reasoning as the question list above: a withdrawn choice lives on the
   * Archive tab now, and a list of what a question asks should not include the
   * answers it stopped asking. The count on the collapsed summary follows it,
   * or the header would promise choices the expanded list does not show.
   */
  const choices = group.choices.filter((option) => option.isActive);

  /**
   * The two facts that belong to this dish rather than to the question.
   *
   * `notOffered` is what this dish does not have of a common question's
   * answers; `pinned` is the answer it opens on, where it has been given one of
   * its own. Both are empty for a dish nobody has singled out, which is nearly
   * all of them.
   */
  const notOffered =
    itemId === null
      ? OFFERS_EVERYTHING
      : (group.notOfferedOn.get(itemId) ?? OFFERS_EVERYTHING);
  const pinned = itemId === null ? null : (group.defaultOn.get(itemId) ?? null);

  /**
   * The dish whose own switches are shown beside each answer, or none.
   *
   * A question one dish asks gets none: taking a choice off the only dish that
   * asks it is what the group-wide Withdrawn switch already does, and two
   * switches on one row meaning the same thing is worse than one.
   *
   * The last two clauses are not decoration. A common question can be narrowed
   * back to a single dish — the exclusions it made survive, because they are
   * still true of that dish — and without them the controls that created those
   * rows would vanish while the storefront went on honouring them. A dish would
   * be missing a choice with nothing on this screen able to say why.
   */
  const perItemDish =
    itemId !== null &&
    (group.itemIds.length > 1 || notOffered.size > 0 || pinned !== null)
      ? itemId
      : null;

  /** What this dish actually offers — the summary count, and the empty test. */
  const offeredHere = choices.filter((option) => !notOffered.has(option.id));

  return (
    <section
      className={cx(
        "flex flex-col gap-lg rounded-md border bg-surface p-lg",
        group.isActive
          ? "border-border"
          : "border-danger-wash bg-danger-wash/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-md">
        {/* The whole heading opens it, not a small chevron beside it. The
            summary line is what an operator reads to decide whether this is
            the question they meant, so it should also be what they press. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-grow items-start gap-sm text-left"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cx(
              // `mt` puts it on the title's line rather than centred against
              // the pair of lines — a marker for a heading belongs beside the
              // heading, not halfway down the block it introduces.
              "mt-[6px] shrink-0 text-text-faint transition-transform",
              open && "rotate-90",
            )}
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="min-w-0 flex-grow">
            <span className="block truncate text-[17px]">
              {pickLocalized(group.title)}
            </span>
            {/* Collapsed, this line is the whole question: what is asked, how
                many answers, whether it can be skipped, how many choices. */}
            <span className="block truncate text-[12px] text-text-faint">
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
                // What this dish offers, not what the question holds. On a
                // pizza with no Large, "3 choices" would be the number on the
                // other nineteen and a promise this one does not keep.
                t("options.count", { count: offeredHere.length }),
                // Where it is asked. The fact that makes this list a shop's
                // questions rather than one dish's — and the one that says
                // whether an edit here touches one item or twenty.
                group.itemIds.length === 0
                  ? t("commonOptions.usedOnNone")
                  : group.itemIds.length === 1
                    ? t("commonOptions.usedOnOne")
                    : t("commonOptions.usedOn", {
                        count: group.itemIds.length,
                      }),
              ].join(" · ")}
            </span>
          </span>
        </button>
        {/* Withdrawn, not deleted. `order_line_options` references these rows
            forever, so `is_active` is the only honest way to stop asking a
            question — and it is reversible, which is why it is a switch rather
            than a confirmed, final-sounding button. */}
        {/* Opens the question as well as the rename form. Pressing "Rename" on
            a collapsed question and having nothing appear reads as a broken
            button — the form is inside the body it does not know is shut. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRenaming(true);
            if (!open) onToggle();
          }}
        >
          {t("options.renameGroup")}
        </Button>
        <Button variant="secondary" size="sm" onClick={onPickItems}>
          {t("commonOptions.manage")}
        </Button>
        {/* Asks first, both ways. Withdrawing a question changes what a
            customer is shown on a shop that is open and taking orders, and the
            failure is silent from this side — what gets noticed later is that a
            dish stopped selling. It is also one switch in a column of identical
            switches, which makes the wrong row the easiest slip here. */}
        <ConfirmToggle
          on={group.isActive}
          onChange={() =>
            update.mutateAsync({
              id: group.id,
              patch: { isActive: !group.isActive },
            })
          }
          labelOn={t("options.offeredGroup")}
          labelOff={t("options.withdrawn")}
          params={{ name: pickLocalized(group.title) }}
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
          className="w-[124px]"
        />
      </div>

      <Collapse open={open}>
        <div className="flex flex-col gap-lg pt-lg">
          {/* Above the switches, because it is the question itself and they are
              its rules. It only exists while it is being used: a text box
              sitting permanently over a row of switches reads as the heading of
              the block rather than as a thing to edit. */}
          {renaming && (
            <TitleForm
              initial={group.title}
              pending={update.isPending}
              onSave={(title) =>
                update.mutate(
                  { id: group.id, patch: { title } },
                  { onSuccess: () => setRenaming(false) },
                )
              }
              onCancel={() => setRenaming(false)}
            />
          )}

          {/* Switches and small numbers rather than a form with a Save: each is
              one fact, there is nothing to weigh up between them, and the
              result is on screen as it changes. */}
          <div className="flex flex-wrap gap-lg">
            <Field label={t("options.howMany")} hint={t("options.howManyHint")}>
              <Toggle
                on={group.mode === "multi"}
                onChange={() =>
                  update.mutate({
                    id: group.id,
                    patch: {
                      mode: group.mode === "multi" ? "single" : "multi",
                    },
                  })
                }
                labelOn={t("options.chooseAny")}
                labelOff={t("options.chooseOne")}
              />
            </Field>

            <Field
              label={t("options.mustChoose")}
              hint={t("options.mustChooseHint")}
            >
              <Toggle
                on={group.minSelections >= 1}
                onChange={() =>
                  update.mutate({
                    id: group.id,
                    patch: { minSelections: group.minSelections >= 1 ? 0 : 1 },
                  })
                }
                labelOn={t("options.required")}
                labelOff={t("options.optional")}
              />
            </Field>

            {group.mode === "multi" && (
              <Field label={t("options.atMost")} hint={t("options.atMostHint")}>
                <NumberInput
                  value={
                    group.maxSelections === null
                      ? ""
                      : String(group.maxSelections)
                  }
                  onChange={(event) =>
                    update.mutate({
                      id: group.id,
                      patch: {
                        mode: "multi",
                        maxSelections:
                          event.target.value.trim() === ""
                            ? null
                            : Number(event.target.value),
                      },
                    })
                  }
                  min={1}
                  placeholder={t("options.noLimit")}
                  className="w-[120px]"
                />
              </Field>
            )}
          </div>

          <div className="flex flex-col gap-sm">
            {/* Said only when it is true. On a question one item asks, an edit
                is local and a notice about twenty would be noise; on a common
                one it is the single most important thing about this screen. */}
            {group.itemIds.length > 1 && (
              <p className="ps-md text-[12px] text-text-faint">
                {t("commonOptions.editsEverywhere", {
                  count: group.itemIds.length,
                })}
                {/* The exception to the sentence before it, said in the same
                    breath. Without it "editing a choice changes it on all
                    twenty" reads as a rule with no way round, which is what
                    sent operators off to build a second copy of the question. */}
                {perItemDish !== null && ` ${t("commonOptions.exceptOffered")}`}
              </p>
            )}

            {/* Only where it is true, and it says which choice — "this item has
                its own default" without naming it is a state the operator would
                have to go and find. */}
            {perItemDish !== null && pinned !== null && (
              <div className="flex flex-wrap items-center gap-sm ps-md">
                <span className="text-[12px] text-text-faint">
                  {t("commonOptions.ownDefault", {
                    name: pickLocalized(
                      group.choices.find((option) => option.id === pinned)
                        ?.name ?? {},
                    ),
                  })}
                </span>
                {/* Clearing is a different act from pressing "Make default" on
                    whichever choice the question currently opens on: a cleared
                    item follows the shared answer the next time it moves, and a
                    pinned one silently stops. */}
                <Button
                  variant="primary-quiet"
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

            {choices.length === 0 && (
              <p className="ps-md text-[13px] text-text-faint">
                {/* "None" and "none left showing" are different states. Telling
                    an operator a question is empty when its three choices are
                    withdrawn invites them to type those three in again, and the
                    unique slug per group would refuse each one. */}
                {t(
                  group.choices.length === 0
                    ? "options.noChoices"
                    : "options.allWithdrawn",
                )}
              </p>
            )}

            {choices.map((option) =>
              editingChoice === option.id ? (
                <ChoiceForm
                  key={option.id}
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
                  onCancel={() => setEditingChoice(null)}
                />
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
                  onEdit={() => setEditingChoice(option.id)}
                />
              ),
            )}

            {/* The same shape as "Add an item to Signature plates" on the menu:
            a place to press, not a form sitting open. A permanently visible
            form under a list reads as a row of it, and on a dish with four
            questions it is four forms nobody is filling in. */}
            {adding === "bulk" ? (
              <BulkChoices
                groupId={group.id}
                currencyCode={currencyCode}
                sortOrder={group.choices.length}
                onDone={() => setAdding("none")}
              />
            ) : adding === "one" ? (
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
                    // Stays open — choices arrive in runs, not one at a time.
                    // The bump is what empties it for the next one.
                    { onSuccess: () => setAdded((count) => count + 1) },
                  )
                }
                onCancel={() => setAdding("none")}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-sm">
                <button
                  type="button"
                  onClick={() => setAdding("one")}
                  className="flex min-w-0 flex-grow items-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-soft hover:border-primary hover:text-primary"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {t("options.addChoiceTo", {
                    name: pickLocalized(group.title),
                  })}
                </button>

                {/* Beside the one-at-a-time button rather than inside the form,
                    because they are two ways to start the same job and the
                    choice between them is made before either is open. */}
                <Button variant="secondary" onClick={() => setAdding("bulk")}>
                  {t("options.bulkAdd")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Collapse>
    </section>
  );
}

/**
 * One answer, with everything that can be said about it in one row.
 *
 * ## Two switches that are not the same switch
 *
 * **Offered / Withdrawn** is the shop's answer about the choice: Large is no
 * longer done, on any dish, and it moves to the Archive tab. It asks first,
 * because it changes what a customer sees on a shop that is open and the
 * failure is silent from this side.
 *
 * **Offered here / Not here** is this dish's answer about the same choice: the
 * question is right for it, Large is not. It does not ask, because it is small
 * and local — one dish, reversible by pressing it again, and the row stays on
 * screen saying which way it went. A confirmation for that would be a dialog
 * per pizza on a job whose whole shape is "tick the two that have no Large".
 *
 * It appears only with a dish in view. Without one there is nothing for "here"
 * to mean, and the group-wide switch beside it is the one that answers.
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
}: {
  option: ItemOption;
  group: StoreQuestion;
  /** The dish this row's local switches act on, or null when none are shown. */
  perItemDish: string | null;
  offeredHere: boolean;
  /** Resolved: this dish's own default where it has one, the group's otherwise. */
  isDefaultHere: boolean;
  currencyCode: string;
  options: ReturnType<typeof useItemOptions>;
  onEdit: () => void;
}) {
  const { format } = useMoney();
  const name = pickLocalized(option.name);

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-md rounded-md border px-lg py-md",
        // Dashed and muted rather than the danger wash a withdrawn row gets:
        // nothing is wrong here. The choice is fine and this dish does not have
        // it, which is a different thing from a choice the shop has stopped
        // doing — and drawing them the same way would say the shop had.
        offeredHere
          ? "border-border"
          : "border-dashed border-border bg-neutral-fill/40",
      )}
    >
      <span
        className={cx(
          "min-w-0 flex-grow truncate text-[14px]",
          !offeredHere && "text-text-faint",
        )}
      >
        {name}
      </span>

      <span className="shrink-0 text-[13px] tabular-nums text-text-soft">
        {/* Free in words. `$0.00` on a choice reads as a price somebody forgot
            to fill in. */}
        {option.price === 0
          ? t("options.free")
          : `+ ${format(option.price, currencyCode)}`}
      </span>

      {/* Which answer the sheet opens on. Only meaningful where the customer
          must answer and may pick one — an optional question opens on nothing,
          which is the point of it being optional — and only on a choice this
          dish actually has. */}
      {group.minSelections >= 1 &&
        group.mode === "single" &&
        offeredHere &&
        (isDefaultHere ? (
          <span className="shrink-0 rounded-full bg-accent-wash px-md py-xxs text-[12px] font-semibold text-accent-deep">
            {t(
              perItemDish === null
                ? "options.isDefault"
                : "options.defaultHere",
            )}
          </span>
        ) : (
          <Button
            variant="primary-quiet"
            size="sm"
            onClick={() =>
              // With a dish in view this pins that dish and leaves the other
              // nineteen alone; without one it is the question's own answer,
              // which is what every dish that has not been pinned follows.
              perItemDish === null
                ? options.makeDefault.mutate({
                    groupId: group.id,
                    optionId: option.id,
                  })
                : options.defaultHere.mutate({
                    itemId: perItemDish,
                    groupId: group.id,
                    optionId: option.id,
                  })
            }
          >
            {t(
              perItemDish === null
                ? "options.makeDefault"
                : "options.makeDefaultHere",
            )}
          </Button>
        ))}

      {/* Named for a screen reader, because a group of six choices is six
          identical "Edit"s otherwise. */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onEdit}
        aria-label={t("options.editChoiceLabel", { name })}
      >
        {t("options.editChoice")}
      </Button>

      {perItemDish !== null && (
        <Toggle
          on={offeredHere}
          onChange={() =>
            options.offerHere.mutate({
              itemId: perItemDish,
              optionId: option.id,
              offered: !offeredHere,
            })
          }
          labelOn={t("options.offeredHere")}
          labelOff={t("options.notHere")}
          className="w-[136px]"
        />
      )}

      <ConfirmToggle
        on={option.isActive}
        onChange={() =>
          options.edit.mutateAsync({
            id: option.id,
            patch: { isActive: !option.isActive },
          })
        }
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
        className="w-[124px]"
      />
    </div>
  );
}

/**
 * Which items ask this question.
 *
 * ## A whole section, or the items in it, or both
 *
 * The section's own box ticks and unticks every live item under it, and shows
 * a third state when only some are on — which is the state a menu is usually
 * in, and drawing it as "off" would invite an operator to tick it and silently
 * add the eleven they had deliberately left out.
 *
 * ## Save means "this is the answer"
 *
 * The picker hands back the whole list it wants and the diff is worked out in
 * `setQuestionItems`. That is what makes unticking a box do something visible:
 * a Save that only applied additions would leave the operator wondering what
 * the tick did.
 *
 * ## Only live items are listed
 *
 * `useMenu` filters archived ones out, so there is nothing here to disable: an
 * item that has been put away is not offered, and a link to it would be one
 * nothing reads. Restoring the item from the Archive tab brings it back into
 * this list, and its links come back with it — they were never removed.
 */
function ItemPicker({
  question,
  sections,
  pending,
  onSave,
  onCancel,
}: {
  question: StoreQuestion;
  sections: {
    id: string;
    title: Record<string, string>;
    items: { id: string; name: Record<string, string> }[];
  }[];
  pending: boolean;
  onSave: (itemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(question.itemIds),
  );

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setMany(ids: string[], on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const everyId = sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );

  return (
    <div className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg">
      <div className="flex flex-col gap-xxs">
        <h3 className="text-[15px] font-semibold">
          {t("commonOptions.pickTitle", {
            name: pickLocalized(question.title),
          })}
        </h3>
        <p className="text-[13px] text-text-soft">
          {t("commonOptions.pickHint")}
        </p>
      </div>

      <div className="flex flex-wrap gap-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMany(everyId, true)}
        >
          {t("commonOptions.pickAll")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setChosen(new Set())}
        >
          {t("commonOptions.pickNone")}
        </Button>
      </div>

      <div className="flex max-h-[420px] flex-col gap-lg overflow-y-auto rounded-md border border-border p-lg">
        {sections.map((section) => {
          const ids = section.items.map((item) => item.id);
          const on = ids.filter((id) => chosen.has(id)).length;
          const all = ids.length > 0 && on === ids.length;

          return (
            <div key={section.id} className="flex flex-col gap-xs">
              <label className="flex items-center gap-sm text-[14px] font-semibold">
                <input
                  type="checkbox"
                  checked={all}
                  // The third state: some but not all. Drawn rather than
                  // rounded down to "off", which would invite a tick that
                  // silently adds the ones left out on purpose.
                  ref={(box) => {
                    if (box) box.indeterminate = on > 0 && !all;
                  }}
                  onChange={() => setMany(ids, !all)}
                  className="size-[16px] accent-[var(--color-active)]"
                />
                {pickLocalized(section.title)}
                <span className="text-[12px] font-normal text-text-faint">
                  {on}/{ids.length}
                </span>
              </label>

              <div className="flex flex-col gap-xxs ps-xl">
                {section.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-sm text-[14px]"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="size-[16px] accent-[var(--color-active)]"
                    />
                    {pickLocalized(item.name)}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <span className="min-w-0 flex-grow text-[13px] text-text-faint">
          {chosen.size === 0
            ? t("commonOptions.pickedNone")
            : t("commonOptions.picked", { count: chosen.size })}
        </span>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button pending={pending} onClick={() => onSave([...chosen])}>
          {t("commonOptions.save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Correcting what a question asks.
 *
 * Every other fact about a group is a switch that writes as it is flicked, and
 * this one is not: text is typed rather than chosen, so it needs a Save and an
 * escape from a half-finished edit. That is the whole reason it is a form and
 * the rules above it are not.
 */
function TitleForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: Localized;
  pending: boolean;
  onSave: (title: Localized) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [title, setTitle] = useState<Localized>(initial);
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const check = validateLocalizedText(title, codes, TEXT.title);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    setError(undefined);
    onSave(title);
  }

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      <LocalizedField
        label={t("options.groupTitle")}
        hint={t("options.groupTitleHint")}
        value={title}
        onChange={setTitle}
        maxLength={TEXT.title}
        error={error}
        placeholder={{ en: "What size?", ar: "أي حجم؟" }}
      />
      <div className="flex items-center gap-sm">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("options.saveTitle")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Adding a question's answers as a pasted list.
 *
 * The form itself is `BulkForm`, shared with sections and items — see its note
 * on why one component covers all three. What is local here is the rule that a
 * choice's price may be left off, because a free extra is the common case, and
 * the mutation that writes them.
 */
function BulkChoices({
  groupId,
  currencyCode,
  sortOrder,
  onDone,
}: {
  groupId: string;
  /** The shop's currency — what the prices in the list are denominated in. */
  currencyCode: string;
  sortOrder: number;
  onDone: () => void;
}) {
  const options = useItemOptions();
  const { decimalsOf } = useMoney();

  return (
    <BulkForm
      kind="choices"
      price="optional"
      decimals={decimalsOf(currencyCode)}
      pending={options.addMany.isPending}
      onCancel={onDone}
      onSubmit={(rows) =>
        options.addMany.mutate(
          {
            groupId,
            // Never null under the `optional` rule: an absent price is free.
            choices: rows.map((row) => ({
              name: row.name,
              price: row.price ?? 0,
            })),
            sortOrder,
          },
          { onSuccess: onDone },
        )
      }
    />
  );
}

/**
 * Naming and pricing an answer — **the same form whether it is new or not**.
 *
 * There were two candidates for the edit case: a second form beside this one,
 * or this one with an `initial`. Two would drift, and the way they would drift
 * is that one grows the currency-aware price box and the other keeps a plain
 * number — which is the exact bug that put `0.03` on a choice somebody priced
 * at three. One form, one conversion, one set of validation.
 *
 * It does not own a mutation. Adding appends and stays open for the next one;
 * editing writes one row and closes. Those are different enough that the caller
 * should say which it is, and identical enough that the fields should not care.
 */
export function ChoiceForm({
  initial,
  currencyCode,
  pending,
  saveLabel,
  onSave,
  onCancel,
}: {
  /** The row being corrected, or absent when this is a new choice. */
  initial?: { name: Localized; price: number };
  /** The shop's currency — what the extra cost is denominated in. */
  currencyCode: string;
  pending: boolean;
  saveLabel: string;
  onSave: (draft: { name: Localized; price: number }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  // A choice is priced in its dish's currency, and a dish in its shop's — which
  // is whichever one the wizard was pointed at and not necessarily the base
  // one. The row above renders it with `format(price, currencyCode)`, so typing
  // it against any other currency's decimals would mean writing with one scale
  // and reading back with another.
  const { decimalsOf } = useMoney();
  const decimals = decimalsOf(currencyCode);

  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  /** Minor units, the way the column stores it — `MoneyInput` does the sum. */
  const [price, setPrice] = useState<number | null>(initial?.price ?? 0);
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.name);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    // An empty box is a free choice, which is the common case and not worth
    // an error. Anything else goes through the same ceiling and whole-number
    // checks as a dish's own price.
    const amount = price ?? 0;
    const money = validatePrice(amount);
    if (!money.ok) {
      setError(t(money.key, money.params));
      return;
    }

    setError(undefined);
    onSave({ name, price: amount });
  }

  return (
    <div
      ref={form}
      className={cx(
        "flex flex-col gap-lg rounded-md border bg-surface p-lg",
        // Dashed while it is a gap waiting to be filled, solid and marked once
        // it is standing in for a row that already exists.
        initial ? "border-active" : "border-dashed border-border",
      )}
    >
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={error}
        placeholder={{ en: "Large", ar: "كبير" }}
      />
      {/* The buttons are inside the field's control slot, beside the box, so
          they line up with the thing they act on rather than with the hint
          under it. */}
      <Field label={t("options.extraCost")} hint={t("options.extraCostHint")}>
        <div className="flex flex-wrap items-center gap-sm">
          {/* Typed as a person would say it — `3` is three dollars, not three
              cents. The conversion to minor units is `MoneyInput`'s, the same
              as on the dish's own price. */}
          <span className="w-[140px]">
            <MoneyInput
              value={price}
              onChange={setPrice}
              // `null` until the shop's currency lands, and the box stays
              // disabled until it does. Same reasoning as the dish's own price.
              decimalDigits={decimals}
              placeholder="0"
            />
          </span>
          {/* Cancel then save, the same order as everywhere else: the button in
              a given position should always do the same thing. */}
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {saveLabel}
          </Button>
        </div>
      </Field>
    </div>
  );
}

/** Creating a question for this dish. */
function NewQuestion({
  storeId,
  itemId,
  sortOrder,
  onDone,
}: {
  storeId: string;
  /**
   * The item to start it on, or null when the list is not filtered to one.
   *
   * A question created with no item is asked nowhere until "Choose items" is
   * used — which is a real and useful state, not a half-made row: it is how a
   * common question is built before it is applied to twenty.
   */
  itemId: string | null;
  sortOrder: number;
  onDone: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const create = useCreateOptionGroup();

  // Opened at the end of a list that scrolls, so on a dish with three
  // questions it appears below the fold: the click works, the form is there,
  // and nothing seems to happen. Focus lands in the first field too.
  const form = useRevealOnMount<HTMLElement>({ focus: true });

  const [title, setTitle] = useState<Localized>({});
  const [mode, setMode] = useState<OptionGroupMode>("single");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const check = validateLocalizedText(title, codes, TEXT.title);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    setError(undefined);

    create.mutate(
      {
        draft: {
          storeId,
          // The item in view, if there is one. Otherwise none, and the row
          // appears saying it is asked nowhere with the picker one press away.
          itemIds: itemId ? [itemId] : [],
          title,
          mode,
          // A switch here, a number on the question itself. Creating one, the
          // only thing worth asking is whether the customer may skip it.
          minSelections: required ? 1 : 0,
          maxSelections: null,
        },
        sortOrder,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <section
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      <LocalizedField
        label={t("options.groupTitle")}
        value={title}
        onChange={setTitle}
        maxLength={TEXT.title}
        hint={t("options.groupTitleHint")}
        error={error}
        placeholder={{ en: "Choose a size", ar: "اختر الحجم" }}
      />

      <div className="flex flex-wrap gap-lg">
        <Field label={t("options.howMany")} hint={t("options.howManyHint")}>
          <Toggle
            on={mode === "multi"}
            onChange={() =>
              setMode((current) => (current === "multi" ? "single" : "multi"))
            }
            labelOn={t("options.chooseAny")}
            labelOff={t("options.chooseOne")}
          />
        </Field>

        <Field
          label={t("options.mustChoose")}
          hint={t("options.mustChooseHint")}
        >
          <Toggle
            on={required}
            onChange={() => setRequired((current) => !current)}
            labelOn={t("options.required")}
            labelOff={t("options.optional")}
          />
        </Field>
      </div>

      <div className="flex items-center gap-sm">
        <Button
          variant="secondary"
          onClick={onDone}
          disabled={create.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={create.isPending}>
          {t("options.saveGroup")}
        </Button>
      </div>
    </section>
  );
}
