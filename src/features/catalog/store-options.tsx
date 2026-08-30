"use client";

import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { NumberInput } from "@/components/ui/number-input";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { OptionGroup, OptionGroupMode } from "./api/options";
import { useStore } from "./use-stores";
import {
  useCreateOptionGroup,
  useItemOptions,
  useOptionGroups,
  useUpdateOptionGroup,
} from "./use-options";

/**
 * The shop's option groups, managed where there is room for them.
 *
 * ## Why this is a tab and not a section of the item editor
 *
 * The first version put all of this inside the side panel that edits a dish,
 * which the flow study asked for — and it was wrong in a way that only shows
 * when you use it. The panel is 420 pixels wide and already holds two languages
 * of name, two of description, a price, an image and a switch. A list of groups,
 * each expanding into its choices, each with a name in two languages and a
 * price and a retire button, does not fit in what is left. It was a management
 * screen folded into a column.
 *
 * The two jobs are different sizes and they separate cleanly:
 *
 * - **In the item editor**: *which questions does this dish ask?* A list of
 *   switches. Nothing is created, nothing is priced.
 * - **Here**: what the questions are, what the answers cost, which ones the
 *   shop still offers.
 *
 * That is also the honest reading of the flow study's own words — "edited inside
 * the menu item editor, plus a manage-all view for reuse across items". The
 * manage-all view is this, and it was the half that was missing.
 *
 * ## Two panes, for the reason the details tab has two columns
 *
 * A group is a short list of rules; its choices are a table with prices. Side
 * by side, picking a group on the left and editing it on the right, both get
 * the width they need — and the operator can see what they are changing in the
 * context of everything else the shop offers.
 */
export function StoreOptions({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const groups = useOptionGroups(storeId);

  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const current = groups.data?.find((group) => group.id === selected) ?? null;
  const currencyCode = store.data?.currencyCode ?? "";

  if (groups.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-sm p-xxl">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-[64px] rounded-md border border-border bg-surface opacity-60"
          />
        ))}
      </div>
    );
  }

  // Said out loud, with the reason.
  //
  // The first version had no failure branch at all, so a refused query drew an
  // empty list — indistinguishable from a shop that has no option groups, and
  // the operator has no way to tell "nothing here" from "this did not load".
  if (groups.isError) {
    return (
      <div className="flex flex-col items-center gap-lg py-huge text-center">
        <div className="flex max-w-[520px] flex-col gap-xs">
          <h2 className="text-[18px]">{t("options.failedTitle")}</h2>
          <p className="text-[14px] text-text-soft">
            {groups.error instanceof Error
              ? groups.error.message
              : t("common.somethingWentWrong")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void groups.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    // `h-full`, not `flex-1`. The tab wrapper around this is an ordinary
    // block, so `flex-1` means nothing there — the pane grew to fit its content
    // and the `overflow-hidden` below simply clipped whatever ran past the
    // window, with no scrollbar to reach it.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* The list. Padding inside the scrolling column, so a focus ring at its
          edge is not clipped — see `Field`. */}
      {/* The list scrolls; the button that adds to it does not.
          A shop can accumulate a dozen questions, and "new group" is the one
          action on this column that is not about a row already in it —
          scrolling past every existing group to reach it is a cost paid on the
          day a shop is set up, which is when it is used most. */}
      <div className="flex flex-col lg:w-[380px] lg:shrink-0">
        <div className="flex flex-col gap-sm p-xxl pb-lg lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <p className="ps-md text-[13px] text-text-faint">
            {t("options.tabHint")}
          </p>

          {groups.data.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[14px] text-text-soft">
              {t("options.none")}
            </p>
          )}

          {groups.data.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                setSelected(group.id);
                setCreating(false);
              }}
              className={cx(
                "flex flex-col items-start gap-xxs rounded-md border bg-surface px-lg py-md text-left",
                group.id === selected ? "border-active" : "border-border",
              )}
            >
              <span className="text-[15px] font-semibold">
                {pickLocalized(group.title)}
              </span>
              <span className="text-[12px] text-text-faint">
                {summarise(group)}
              </span>
            </button>
          ))}
        </div>

        <div className="shrink-0 border-t border-border bg-surface p-lg">
          <Button
            onClick={() => {
              setCreating(true);
              setSelected(null);
            }}
            fullWidth
          >
            {t("options.addGroup")}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-border lg:border-s lg:border-t-0">
        {creating ? (
          <GroupForm
            storeId={storeId}
            sortOrder={groups.data.length}
            onDone={() => setCreating(false)}
          />
        ) : current ? (
          <GroupDetail
            key={current.id}
            group={current}
            storeId={storeId}
            currencyCode={currencyCode}
          />
        ) : (
          <p className="p-xxl text-[14px] text-text-faint">
            {t("options.pickOne")}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Choose one · required · 3 choices", which is the row as a person reads it.
 *
 * `min_selections` is a number and this says it in words, because the numbers
 * that matter are 0 and 1 and everything above is rare: "optional",
 * "required", and — for the case a boolean could never express — "choose at
 * least 2".
 */
function summarise(group: OptionGroup): string {
  return [
    t(group.mode === "single" ? "options.chooseOne" : "options.chooseAny"),
    requirement(group.minSelections),
    t("options.count", { count: group.options.length }),
  ].join(" · ");
}

function requirement(minSelections: number): string {
  if (minSelections <= 0) return t("options.optional");
  if (minSelections === 1) return t("options.required");
  return t("options.atLeast", { count: minSelections });
}

/** One group: its rules, then its choices. */
function GroupDetail({
  group,
  storeId,
  currencyCode,
}: {
  group: OptionGroup;
  storeId: string;
  currencyCode: string;
}) {
  const { format } = useMoney();
  const update = useUpdateOptionGroup(storeId);
  const options = useItemOptions(storeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        <section className="flex max-w-[560px] flex-col gap-lg">
          <div className="flex items-center gap-md">
            <h2 className="flex-grow text-[20px]">
              {pickLocalized(group.title)}
            </h2>
            {/* Withdrawn, not deleted. `order_line_options` references these
                rows forever, so `is_active` is the only honest way to stop
                offering a question — and it is reversible, which is why it is a
                switch rather than a confirmed, final-sounding button. */}
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

          {/* The rules are switches and small numbers rather than a form with a
              Save: each is one fact, there is nothing to weigh up between them,
              and the list on the left shows the result as it changes. */}
          <Field label={t("options.howMany")} hint={t("options.howManyHint")}>
            <Toggle
              on={group.mode === "multi"}
              onChange={() =>
                update.mutate({
                  id: group.id,
                  patch: { mode: group.mode === "multi" ? "single" : "multi" },
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
                  // 0 or 1. A floor above one is a real thing the column can
                  // express and a rare thing to want, so it is set by the box
                  // below rather than by a switch that would have to guess
                  // which number to go back to.
                  patch: { minSelections: group.minSelections >= 1 ? 0 : 1 },
                })
              }
              labelOn={t("options.required")}
              labelOff={t("options.optional")}
            />
          </Field>

          {group.mode === "multi" && (
            <div className="flex flex-wrap gap-lg">
              <Field
                label={t("options.atLeastLabel")}
                hint={t("options.atLeastHint")}
              >
                <NumberInput
                  value={String(group.minSelections)}
                  onChange={(event) =>
                    update.mutate({
                      id: group.id,
                      patch: { minSelections: Number(event.target.value) || 0 },
                    })
                  }
                  min={0}
                  className="w-[120px]"
                />
              </Field>

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
            </div>
          )}
        </section>

        <section className="flex max-w-[560px] flex-col gap-sm">
          <h3 className="text-[17px]">{t("options.choices")}</h3>

          {group.options.length === 0 && (
            <p className="text-[13px] text-text-faint">
              {t("options.noChoices")}
            </p>
          )}

          {group.options.map((option) => (
            <div
              key={option.id}
              className={cx(
                "flex flex-wrap items-center gap-md rounded-md border bg-surface px-lg py-md",
                option.isActive
                  ? "border-border"
                  : "border-danger-wash bg-danger-wash/30",
              )}
            >
              <span className="min-w-0 flex-grow truncate text-[14px]">
                {pickLocalized(option.name)}
              </span>

              <span className="shrink-0 text-[13px] tabular-nums text-text-soft">
                {/* Free is said in words. `$0.00` on a choice reads as a price
                    somebody forgot to fill in. */}
                {option.price === 0
                  ? t("options.free")
                  : `+ ${format(option.price, currencyCode)}`}
              </span>

              {/* Which answer the group opens on. Only meaningful where the
                  customer must answer — on an optional question the app opens
                  on nothing, which is the point of it being optional. */}
              {group.minSelections >= 1 &&
                group.mode === "single" &&
                // A ground of its own, like every other control in the row.
                // As bare type beside a switch and a price it read as a label
                // rather than as something to press.
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

          <OptionForm
            storeId={storeId}
            groupId={group.id}
            sortOrder={group.options.length}
          />
        </section>
      </div>
    </div>
  );
}

/** Adding a choice. Stays open, because they are added several at a time. */
function OptionForm({
  storeId,
  groupId,
  sortOrder,
}: {
  storeId: string;
  groupId: string;
  sortOrder: number;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const options = useItemOptions(storeId);

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
        // Cleared on success so the next one can be typed straight away — these
        // are added in runs of five, not one at a time.
        onSuccess: () => {
          setName({});
          setPrice("0");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-lg rounded-md border border-dashed border-border p-lg">
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={error}
        placeholder={{ en: "Large", ar: "كبير" }}
      />
      {/* The button is inside the field's control slot, beside the box.
          Sitting outside it, the row could only line up with the *field* —
          label, input and hint — so `items-end` put it level with the hint and
          `items-center` with the label. Beside the input it is level with the
          thing it acts on, and the hint runs under both. */}
      <Field label={t("options.extraCost")} hint={t("options.extraCostHint")}>
        <div className="flex flex-wrap items-center gap-sm">
          <NumberInput
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            min={0}
            placeholder="0"
            className="w-[140px]"
          />
          <Button onClick={submit} pending={options.add.isPending}>
            {t("options.addOption")}
          </Button>
        </div>
      </Field>
    </div>
  );
}

/** Creating a group. */
function GroupForm({
  storeId,
  sortOrder,
  onDone,
}: {
  storeId: string;
  sortOrder: number;
  onDone: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const create = useCreateOptionGroup(storeId);

  const [title, setTitle] = useState<Localized>({});
  const [mode, setMode] = useState<OptionGroupMode>("single");
  const [required, setRequired] = useState(false);
  const [maxSelections, setMaxSelections] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const check = validateLocalizedText(title, codes, TEXT.title);
    if (!check.ok) {
      setError(t(check.key, check.params));
      return;
    }
    setError(undefined);

    const ceiling = maxSelections.trim() === "" ? null : Number(maxSelections);

    create.mutate(
      {
        draft: {
          storeId,
          title,
          mode,
          // A switch here, a number on the detail pane. Creating a group, the
          // only question worth asking is whether the customer may skip it;
          // "at least two" is a refinement for a group that already exists.
          minSelections: required ? 1 : 0,
          maxSelections:
            ceiling !== null && Number.isFinite(ceiling) ? ceiling : null,
        },
        sortOrder,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <h2 className="text-[20px]">{t("options.newGroup")}</h2>

        <div className="flex max-w-[560px] flex-col gap-lg">
          <LocalizedField
            label={t("options.groupTitle")}
            value={title}
            onChange={setTitle}
            maxLength={TEXT.title}
            hint={t("options.groupTitleHint")}
            error={error}
            placeholder={{ en: "Add extras", ar: "إضافات" }}
          />

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

          {mode === "multi" && (
            <Field label={t("options.atMost")} hint={t("options.atMostHint")}>
              <NumberInput
                value={maxSelections}
                onChange={(event) => setMaxSelections(event.target.value)}
                min={1}
                placeholder={t("options.noLimit")}
                className="w-[140px]"
              />
            </Field>
          )}

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
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
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
    </div>
  );
}
