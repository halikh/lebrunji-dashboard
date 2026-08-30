"use client";

import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
import {
  useArchiveOptionGroup,
  useCreateOptionGroup,
  useItemGroups,
  useItemOptions,
  useOptionGroups,
  useSetItemGroup,
} from "./use-options";

/**
 * The choices offered with a dish.
 *
 * ## Attaching, mostly — not creating
 *
 * An option group belongs to the **shop**, not to the item: "Add extras" is one
 * group offered on twenty dishes, and editing it once is the entire point of it
 * being a row rather than a repeated list. So the common act here is a switch —
 * does this dish offer that question — and creating a group is the rarer thing
 * behind it.
 *
 * That also decides what removal means. Taking a group off a dish is a
 * **detach**, because the operator means "not on this one"; retiring the group
 * itself is a separate, confirmed action that reaches the other nineteen and
 * says so.
 *
 * ## Why this needs a saved item
 *
 * A link is a row joining two ids, and a dish that has not been saved has no
 * id. The alternatives are worse than the wait: holding the choices in memory
 * and writing them after the insert makes a save that can half-succeed, and
 * inserting the item early to get an id puts a half-finished dish on the menu
 * of a shop that is open. So the section says to save first, in one line, and
 * appears the moment there is something to attach to.
 */
export function ItemOptions({
  storeId,
  itemId,
  currencyCode,
}: {
  storeId: string;
  /** Null while the item is still being added. */
  itemId: string | null;
  currencyCode: string;
}) {
  const groups = useOptionGroups(storeId);
  const attached = useItemGroups(itemId);
  const link = useSetItemGroup(itemId ?? "");

  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (itemId === null) {
    return (
      <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
        {t("options.saveFirst")}
      </p>
    );
  }

  const linked = new Set(attached.data ?? []);

  return (
    <div className="flex flex-col gap-sm">
      {groups.isPending && (
        <div aria-hidden className="h-[52px] rounded-md bg-neutral-fill" />
      )}

      {groups.isSuccess && groups.data.length === 0 && !adding && (
        <p className="text-[13px] text-text-faint">{t("options.none")}</p>
      )}

      {groups.data?.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          storeId={storeId}
          currencyCode={currencyCode}
          attached={linked.has(group.id)}
          expanded={expanded === group.id}
          onToggleAttached={() =>
            link.mutate({
              groupId: group.id,
              attached: !linked.has(group.id),
            })
          }
          onToggleExpanded={() =>
            setExpanded((current) => (current === group.id ? null : group.id))
          }
        />
      ))}

      {adding ? (
        <GroupForm
          storeId={storeId}
          sortOrder={groups.data?.length ?? 0}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={() => setAdding(true)}
        >
          {t("options.addGroup")}
        </Button>
      )}
    </div>
  );
}

/**
 * One group: the switch that attaches it, and its choices underneath.
 *
 * Collapsed by default. The question an operator has while editing a dish is
 * *which* groups it offers, and a list that showed every choice inside every
 * group would bury that under thirty rows of prices they are not editing.
 */
function GroupRow({
  group,
  storeId,
  currencyCode,
  attached,
  expanded,
  onToggleAttached,
  onToggleExpanded,
}: {
  group: OptionGroup;
  storeId: string;
  currencyCode: string;
  attached: boolean;
  expanded: boolean;
  onToggleAttached: () => void;
  onToggleExpanded: () => void;
}) {
  const { format } = useMoney();
  const options = useItemOptions(storeId);
  const archiveGroup = useArchiveOptionGroup(storeId);

  return (
    <div
      className={cx(
        "flex flex-col gap-sm rounded-md border bg-surface px-lg py-md",
        attached ? "border-active" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-md">
        <Toggle
          on={attached}
          onChange={onToggleAttached}
          labelOn={t("options.onThisItem")}
          labelOff={t("options.notOnThisItem")}
          className="w-[130px]"
        />

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
        >
          <span className="truncate text-[15px] font-semibold">
            {pickLocalized(group.title)}
          </span>
          {/* The rules, in words. `single` / `multi` and a boolean are how the
              row is stored; "choose one, required" is the same fact in the form
              somebody can check against what the shop actually offers. */}
          <span className="text-[12px] text-text-faint">
            {t(
              group.mode === "single"
                ? "options.chooseOne"
                : "options.chooseAny",
            )}
            {" · "}
            {t(group.isRequired ? "options.required" : "options.optional")}
            {" · "}
            {t("options.count", { count: group.options.length })}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-sm border-t border-border pt-sm">
          {group.options.map((option) => (
            <div
              key={option.id}
              className="flex items-center gap-md rounded-md bg-neutral-fill/40 px-md py-sm"
            >
              <span className="flex-grow text-[14px]">
                {pickLocalized(option.name)}
              </span>
              <span className="text-[13px] tabular-nums text-text-soft">
                {/* Free is said in words. A price of `$0.00` on a choice reads
                    as a price somebody forgot to fill in. */}
                {option.price === 0
                  ? t("options.free")
                  : `+ ${format(option.price, currencyCode)}`}
              </span>
              <ConfirmButton
                onConfirm={async () => {
                  await options.archive.mutateAsync({
                    id: option.id,
                    name: option.name,
                  });
                }}
                titleKey="options.retireOptionTitle"
                bodyKey="options.retireOptionBody"
                confirmKey="options.retireConfirm"
                params={{ name: pickLocalized(option.name) }}
                variant="danger"
                triggerVariant="danger-quiet"
                size="sm"
              >
                {t("options.retire")}
              </ConfirmButton>
            </div>
          ))}

          <OptionForm
            storeId={storeId}
            groupId={group.id}
            sortOrder={group.options.length}
          />

          {/* Last, and quiet. Retiring the group reaches every dish that offers
              it, so it should not sit where the eye lands first. */}
          <div className="flex justify-end border-t border-border pt-sm">
            <ConfirmButton
              onConfirm={async () => {
                await archiveGroup.mutateAsync({
                  id: group.id,
                  name: group.title,
                });
              }}
              titleKey="options.retireGroupTitle"
              bodyKey="options.retireGroupBody"
              confirmKey="options.retireConfirm"
              params={{ name: pickLocalized(group.title) }}
              variant="danger"
              triggerVariant="danger-quiet"
              size="sm"
            >
              {t("options.retireGroup")}
            </ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Adding a choice to a group. */
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
        onSuccess: () => {
          setName({});
          setPrice("0");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={error}
        placeholder={{ en: "Large", ar: "كبير" }}
      />
      <div className="flex items-end gap-sm">
        <Field label={t("options.extraCost")} hint={t("options.extraCostHint")}>
          <NumberInput
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            min={0}
            placeholder="0"
            className="w-[120px]"
          />
        </Field>
        <Button
          variant="secondary"
          size="sm"
          onClick={submit}
          pending={options.add.isPending}
        >
          {t("options.addOption")}
        </Button>
      </div>
    </div>
  );
}

/** Creating a group for the shop. */
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
  const [isRequired, setIsRequired] = useState(false);
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
          // The four kinds are the app's own vocabulary and only `extra` is
          // ever right for something created here — `size`, `removal` and
          // `preparation` describe groups the menu contract renders
          // differently. Offering the choice would be offering a decision with
          // no visible consequence in this dashboard.
          kind: "extra",
          mode,
          isRequired,
          maxSelections:
            ceiling !== null && Number.isFinite(ceiling) ? ceiling : null,
        },
        sortOrder,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg">
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
            className="w-[120px]"
          />
        </Field>
      )}

      <Field label={t("options.mustChoose")} hint={t("options.mustChooseHint")}>
        <Toggle
          on={isRequired}
          onChange={() => setIsRequired((current) => !current)}
          labelOn={t("options.required")}
          labelOff={t("options.optional")}
        />
      </Field>

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
    </div>
  );
}
