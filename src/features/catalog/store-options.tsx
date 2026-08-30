"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Collapse } from "@/components/ui/collapse";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { NumberInput } from "@/components/ui/number-input";
import { useRevealOnMount } from "@/components/ui/reveal";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { OptionGroup, OptionGroupMode } from "./api/options";
import { useMenu } from "./use-menu";
import {
  useCreateOptionGroup,
  useItemOptionGroups,
  useItemOptions,
  useOptionCounts,
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
    <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="flex flex-col gap-lg p-xxl lg:w-[380px] lg:shrink-0 lg:overflow-y-auto">
        <p className="ps-md text-[13px] text-text-faint">
          {t("options.tabHint")}
        </p>

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

      <div className="flex min-h-0 flex-1 flex-col border-t border-border lg:border-s lg:border-t-0">
        {item ? (
          <ItemQuestions
            key={item.id}
            storeId={storeId}
            itemId={item.id}
            itemName={pickLocalized(item.name)}
          />
        ) : (
          <p className="p-xxl text-[14px] text-text-faint">
            {section ? t("options.pickItem") : t("options.pickSection")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Every question asked about one dish. */
function ItemQuestions({
  storeId,
  itemId,
  itemName,
}: {
  storeId: string;
  itemId: string;
  itemName: string;
}) {
  const groups = useItemOptionGroups(itemId);
  const [adding, setAdding] = useState(false);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        <h2 className="text-[20px]">{itemName}</h2>

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

        {groups.isSuccess && groups.data.length === 0 && !adding && (
          <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[14px] text-text-soft">
            {t("options.noQuestions")}
          </p>
        )}

        {groups.data?.map((group) => (
          <Question
            key={group.id}
            group={group}
            storeId={storeId}
            open={open === group.id}
            onToggle={() =>
              setOpen((current) => (current === group.id ? null : group.id))
            }
          />
        ))}

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

/** One question: its rules, then its answers. */
function Question({
  group,
  storeId,
  open,
  onToggle,
}: {
  group: OptionGroup;
  storeId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const store = useStore(storeId);
  const { format } = useMoney();
  const update = useUpdateOptionGroup();
  const options = useItemOptions();

  const [addingChoice, setAddingChoice] = useState(false);
  const currencyCode = store.data?.currencyCode ?? "";

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
                t("options.count", { count: group.options.length }),
              ].join(" · ")}
            </span>
          </span>
        </button>
        {/* Withdrawn, not deleted. `order_line_options` references these rows
            forever, so `is_active` is the only honest way to stop asking a
            question — and it is reversible, which is why it is a switch rather
            than a confirmed, final-sounding button. */}
        <Toggle
          on={group.isActive}
          onChange={() =>
            update.mutate({
              id: group.id,
              patch: { isActive: !group.isActive },
            })
          }
          labelOn={t("options.offeredGroup")}
          labelOff={t("options.withdrawn")}
          className="w-[124px]"
        />
      </div>

      <Collapse open={open}>
        <div className="flex flex-col gap-lg pt-lg">
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
            {group.options.length === 0 && (
              <p className="ps-md text-[13px] text-text-faint">
                {t("options.noChoices")}
              </p>
            )}

            {group.options.map((option) => (
              <div
                key={option.id}
                className={cx(
                  "flex flex-wrap items-center gap-md rounded-md border px-lg py-md",
                  option.isActive
                    ? "border-border"
                    : "border-danger-wash bg-danger-wash/30",
                )}
              >
                <span className="min-w-0 flex-grow truncate text-[14px]">
                  {pickLocalized(option.name)}
                </span>

                <span className="shrink-0 text-[13px] tabular-nums text-text-soft">
                  {/* Free in words. `$0.00` on a choice reads as a price somebody
                  forgot to fill in. */}
                  {option.price === 0
                    ? t("options.free")
                    : `+ ${format(option.price, currencyCode)}`}
                </span>

                {/* Which answer the sheet opens on. Only meaningful where the
                customer must answer and may pick one — an optional question
                opens on nothing, which is the point of it being optional. */}
                {group.minSelections >= 1 &&
                  group.mode === "single" &&
                  (option.isDefault ? (
                    <span className="shrink-0 rounded-full bg-accent-wash px-md py-xxs text-[12px] font-semibold text-accent-deep">
                      {t("options.isDefault")}
                    </span>
                  ) : (
                    <Button
                      variant="primary-quiet"
                      size="sm"
                      onClick={() =>
                        options.makeDefault.mutate({
                          groupId: group.id,
                          optionId: option.id,
                        })
                      }
                    >
                      {t("options.makeDefault")}
                    </Button>
                  ))}

                <Toggle
                  on={option.isActive}
                  onChange={() =>
                    options.edit.mutate({
                      id: option.id,
                      patch: { isActive: !option.isActive },
                    })
                  }
                  labelOn={t("options.offeredGroup")}
                  labelOff={t("options.withdrawn")}
                  className="w-[124px]"
                />
              </div>
            ))}

            {/* The same shape as "Add an item to Signature plates" on the menu:
            a place to press, not a form sitting open. A permanently visible
            form under a list reads as a row of it, and on a dish with four
            questions it is four forms nobody is filling in. */}
            {addingChoice ? (
              <NewChoice
                groupId={group.id}
                sortOrder={group.options.length}
                onDone={() => setAddingChoice(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingChoice(true)}
                className="flex w-full items-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-soft hover:border-primary hover:text-primary"
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
                {t("options.addChoiceTo", { name: pickLocalized(group.title) })}
              </button>
            )}
          </div>
        </div>
      </Collapse>
    </section>
  );
}

/** Adding an answer. Stays open — they arrive in runs, not one at a time. */
function NewChoice({
  groupId,
  sortOrder,
  onDone,
}: {
  groupId: string;
  sortOrder: number;
  onDone: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const options = useItemOptions();

  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [name, setName] = useState<Localized>({});
  const [price, setPrice] = useState("0");
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.name);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(t("validation.priceNegative"));
      return;
    }

    setError(undefined);
    options.add.mutate(
      { groupId, name, price: Math.round(amount), sortOrder },
      {
        onSuccess: () => {
          setName({});
          setPrice("0");
        },
      },
    );
  }

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-dashed border-border bg-surface p-lg"
    >
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={error}
        placeholder={{ en: "Large", ar: "كبير" }}
      />
      {/* The button is inside the field's control slot, beside the box, so it
          lines up with the thing it acts on rather than with the hint under
          it. */}
      <Field label={t("options.extraCost")} hint={t("options.extraCostHint")}>
        <div className="flex flex-wrap items-center gap-sm">
          <NumberInput
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            min={0}
            placeholder="0"
            className="w-[140px]"
          />
          <Button
            variant="secondary"
            onClick={onDone}
            disabled={options.add.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={options.add.isPending}>
            {t("options.addOption")}
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
  itemId: string;
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
          itemId,
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
