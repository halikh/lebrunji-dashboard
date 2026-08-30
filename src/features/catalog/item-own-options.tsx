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

import type { OptionGroup } from "./api/options";
import { useStore } from "./use-stores";
import {
  useCreateOptionGroup,
  useItemOptions,
  useItemOwnGroups,
  useUpdateOptionGroup,
} from "./use-options";

/**
 * Questions asked about one dish and nothing else.
 *
 * The counterpart to the shared groups above: those exist once for the shop and
 * are switched on per item, these exist for this item alone (migration 0073's
 * `menu_item_id`). "How would you like the steak done?" is not a question the
 * shop asks — it is a question the steak asks — and making it shop-wide to ask
 * it would fill the shop's list with entries that are each about one dish,
 * until the list meant to show what is *shared* could no longer do so.
 *
 * They are edited here rather than on the Options tab because here is the only
 * place they are ever offered. There is nowhere else for them to be.
 *
 * ## Kept small on purpose
 *
 * This sits in a 420px side panel, so it shows a group's name, its rule in
 * words, and its choices as one line each. The full editor — a table of prices,
 * defaults, withdrawals — is the Options tab's job, and folding it in here is
 * the mistake this whole section was rebuilt to undo.
 */
export function OwnGroups({
  storeId,
  itemId,
}: {
  storeId: string;
  itemId: string;
}) {
  const groups = useItemOwnGroups(itemId);
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex flex-col gap-xxs">
        <h3 className="ps-md text-[13px] font-semibold text-text-soft">
          {t("options.ownTitle")}
        </h3>
        <p className="ps-md text-[12px] text-text-faint">
          {t("options.ownHint")}
        </p>
      </div>

      {groups.isError && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {groups.error instanceof Error
            ? groups.error.message
            : t("common.somethingWentWrong")}
        </p>
      )}

      {groups.isSuccess && groups.data.length === 0 && !adding && (
        <p className="ps-md text-[13px] text-text-faint">
          {t("options.ownEmpty")}
        </p>
      )}

      {groups.data?.map((group) => (
        <OwnGroup key={group.id} group={group} storeId={storeId} />
      ))}

      {adding ? (
        <NewGroup
          storeId={storeId}
          itemId={itemId}
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
          {t("options.addOwn")}
        </Button>
      )}
    </section>
  );
}

/** One of the dish's own groups, with its choices. */
function OwnGroup({ group, storeId }: { group: OptionGroup; storeId: string }) {
  const store = useStore(storeId);
  const { format } = useMoney();
  const update = useUpdateOptionGroup(storeId);
  const options = useItemOptions(storeId);

  const currencyCode = store.data?.currencyCode ?? "";

  return (
    <div
      className={cx(
        "flex flex-col gap-sm rounded-md border bg-surface px-lg py-md",
        group.isActive
          ? "border-border"
          : "border-danger-wash bg-danger-wash/30",
      )}
    >
      <div className="flex items-center gap-md">
        <span className="min-w-0 flex-grow truncate text-[14px] font-semibold">
          {pickLocalized(group.title)}
        </span>
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
          className="w-[112px]"
        />
      </div>

      <span className="text-[12px] text-text-faint">
        {t(group.mode === "single" ? "options.chooseOne" : "options.chooseAny")}
        {" · "}
        {t(group.minSelections >= 1 ? "options.required" : "options.optional")}
      </span>

      {group.options.map((option) => (
        <div
          key={option.id}
          className="flex items-center gap-md rounded-md bg-neutral-fill/40 px-md py-xs"
        >
          <span
            className={cx(
              "min-w-0 flex-grow truncate text-[13px]",
              !option.isActive && "text-text-faint line-through",
            )}
          >
            {pickLocalized(option.name)}
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-text-soft">
            {/* Free in words. `$0.00` reads as a price somebody forgot. */}
            {option.price === 0
              ? t("options.free")
              : `+ ${format(option.price, currencyCode)}`}
          </span>
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
            className="w-[112px]"
          />
        </div>
      ))}

      <NewChoice
        storeId={storeId}
        groupId={group.id}
        sortOrder={group.options.length}
      />
    </div>
  );
}

/** Adding a choice. Stays open — they arrive in runs, not one at a time. */
function NewChoice({
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
    <div className="flex flex-col gap-sm border-t border-border pt-sm">
      <LocalizedField
        label={t("options.optionName")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={error}
        placeholder={{ en: "Medium rare", ar: "وسط" }}
      />
      <Field label={t("options.extraCost")} hint={t("options.extraCostHint")}>
        <div className="flex flex-wrap items-center gap-sm">
          <NumberInput
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            min={0}
            placeholder="0"
            className="w-[110px]"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={submit}
            pending={options.add.isPending}
          >
            {t("options.addOption")}
          </Button>
        </div>
      </Field>
    </div>
  );
}

/** Creating one of the dish's own groups. */
function NewGroup({
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
  const create = useCreateOptionGroup(storeId);

  const [title, setTitle] = useState<Localized>({});
  const [mode, setMode] = useState<"single" | "multi">("single");
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
          title,
          mode,
          minSelections: required ? 1 : 0,
          maxSelections: null,
          // What makes it this dish's. Creating it also links it, because
          // ownership decides who may edit the group and the link is what
          // actually serves it.
          ownerItemId: itemId,
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
        error={error}
        placeholder={{ en: "How would you like it cooked?", ar: "درجة الطهي" }}
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

      <Field label={t("options.mustChoose")} hint={t("options.mustChooseHint")}>
        <Toggle
          on={required}
          onChange={() => setRequired((current) => !current)}
          labelOn={t("options.required")}
          labelOff={t("options.optional")}
        />
      </Field>

      <div className="flex items-center gap-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDone}
          disabled={create.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={submit} pending={create.isPending}>
          {t("options.saveGroup")}
        </Button>
      </div>
    </div>
  );
}
