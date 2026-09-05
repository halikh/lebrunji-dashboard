"use client";

import { Button, cx } from "@/components/ui";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useState } from "react";

import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "./api/branches";
import type { BranchMenuOverrides } from "./api/branch-menu";
import { useBranches } from "./use-branches";
import { useMenu } from "./use-menu";
import { useStore } from "./use-stores";
import { useItemOptionGroups } from "./use-options";
import {
  useBranchOverrides,
  useCopyBranchPrices,
  useSetGroupHidden,
  useSetOptionHidden,
  useSetOptionPrice,
  useSetItemHidden,
  useSetItemPrice,
  useSetSectionHidden,
} from "./use-branch-menu";

/**
 * What one branch does differently to the shared menu.
 *
 * ## Why this is here and not on the dish
 *
 * The question an operator actually has is "what is different at Jounieh" — one
 * branch, the whole menu, in one place. Asked from the dish instead it becomes
 * "which branches is this hidden at", repeated once per dish, and setting up a
 * new branch means opening forty item panels.
 *
 * It is also the same reasoning that took options off the item panel: a screen
 * 420px wide holding two languages of name, two of description, a price and an
 * image is not where a matrix belongs.
 *
 * ## Nothing here is a draft
 *
 * Every control writes one row on change. There is no Save, because there is
 * nothing to assemble: a toggle that needed saving would be a toggle that lies
 * about its own state until something else is pressed. The trade is a write per
 * flip, which is the right trade for rows this small.
 *
 * ## Empty means "the same as the brand"
 *
 * A price box shows the brand price as its **placeholder**, not its value — so
 * a branch charging the same shows an empty box rather than a number somebody
 * might think they had set. Clearing the box deletes the override rather than
 * writing the brand price into it: a copy stops tracking the original the
 * moment the menu changes, and the branch would quietly hold last month's
 * number.
 */
export function BranchMenuPanel({
  branch,
  storeId,
}: {
  branch: Branch;
  storeId: string;
}) {
  const menu = useMenu(storeId);
  const store = useStore(storeId);
  const overrides = useBranchOverrides(branch.id);
  const { decimalsOf } = useMoney();

  const siblings = useBranches(storeId);

  const setSection = useSetSectionHidden(branch.id);
  const setItem = useSetItemHidden(branch.id);
  const setPrice = useSetItemPrice(branch.id);
  const copy = useCopyBranchPrices(branch.id);

  /**
   * Which branch to copy from, chosen once and used at every scope below.
   *
   * One picker rather than one per row: the operator is answering "make this
   * place match Hamra", and re-saying *Hamra* on each of forty rows would be
   * the same retyping this exists to remove.
   */
  const others = (siblings.data ?? []).filter((one) => one.id !== branch.id);
  const [source, setSource] = useState<string | null>(null);
  /** One dish open at a time. Every dish expanded at once is a wall of rows. */
  const [openOptions, setOpenOptions] = useState<string | null>(null);
  const from = others.find((one) => one.id === source) ?? others[0] ?? null;

  function copyFrom(scope: { sectionId?: string; itemId?: string }) {
    if (!from) return;
    copy.mutate({
      fromBranchId: from.id,
      fromName: pickLocalized(from.name),
      sectionId: scope.sectionId ?? null,
      itemId: scope.itemId ?? null,
    });
  }

  const decimals = decimalsOf(store.data?.currencyCode ?? "");
  const sections = menu.data ?? [];
  const state = overrides.data;

  if (menu.isPending || overrides.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-sm p-xxl">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-[52px] rounded-md bg-neutral-fill" />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="p-xxl text-[14px] text-text-faint">
        {t("branchMenu.noMenu")}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-y-auto p-xxl">
      <p className="ps-md text-[13px] text-text-faint">
        {t("branchMenu.intro")}
      </p>

      {/* Copying in, rather than retyping a hundred numbers. The source is
          picked once here and applied at whatever scope the operator presses:
          the whole menu, one section, or one dish. */}
      {from && (
        <div className="flex flex-wrap items-center gap-md rounded-md border border-border bg-neutral-fill px-lg py-md">
          <span className="shrink-0 text-[13px] font-semibold text-text-soft">
            {t("branchMenu.copyFrom")}
          </span>
          <span className="w-[200px]">
            <Select
              value={from.id}
              onChange={setSource}
              options={others.map((one) => ({
                value: one.id,
                label: pickLocalized(one.name),
              }))}
              aria-label={t("branchMenu.copyFrom")}
            />
          </span>
          <Button
            variant="primary-quiet"
            size="sm"
            pending={copy.isPending}
            onClick={() => copyFrom({})}
          >
            {t("branchMenu.copyAll")}
          </Button>
        </div>
      )}

      {sections.map((section) => {
        const sectionHidden = state?.hiddenSections.has(section.id) ?? false;

        return (
          <section key={section.id} className="flex flex-col gap-sm">
            <div className="flex items-center gap-md border-b border-border pb-sm">
              <h3 className="flex-grow text-[15px] font-semibold">
                {pickLocalized(section.title)}
              </h3>
              <Button
                variant="primary-quiet"
                size="sm"
                disabled={!from || copy.isPending}
                onClick={() => copyFrom({ sectionId: section.id })}
              >
                {t("branchMenu.copySection")}
              </Button>
              <Toggle
                on={!sectionHidden}
                onChange={() =>
                  setSection.mutate({
                    sectionId: section.id,
                    hidden: !sectionHidden,
                  })
                }
                labelOn={t("branchMenu.served")}
                labelOff={t("branchMenu.notServed")}
              />
            </div>

            {/* A hidden section takes its items with it, so the rows under it
                are shown as they will behave rather than left looking editable.
                Dimmed and inert, with the reason said once — a row that still
                accepted a price would be collecting a number nobody will be
                charged. */}
            {sectionHidden && (
              <p className="ps-md text-[13px] text-text-faint">
                {t("branchMenu.sectionOff")}
              </p>
            )}

            {section.items.map((item) => {
              const itemHidden = state?.hiddenItems.has(item.id) ?? false;
              const override = state?.itemPrices.get(item.id) ?? null;
              const off = sectionHidden || itemHidden;
              const expanded = openOptions === item.id;

              return (
                <div
                  key={item.id}
                  className={cx(
                    "flex flex-col gap-sm rounded-md border border-border px-lg py-md",
                    off && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-md">
                    <span className="min-w-0 flex-grow truncate text-[14px]">
                      {pickLocalized(item.name)}
                    </span>

                    <span className="w-[140px] shrink-0">
                      <MoneyInput
                        value={override}
                        onChange={(price) =>
                          setPrice.mutate({ itemId: item.id, price })
                        }
                        decimalDigits={decimals}
                        disabled={sectionHidden}
                        // The brand price, as a placeholder — what this branch
                        // charges when it says nothing.
                        placeholder={toMajor(item.price, decimals)}
                        aria-label={t("branchMenu.priceFor", {
                          name: pickLocalized(item.name),
                        })}
                      />
                    </span>

                    <Button
                      variant="primary-quiet"
                      size="sm"
                      disabled={!from || copy.isPending}
                      onClick={() => copyFrom({ itemId: item.id })}
                    >
                      {t("branchMenu.copyItem")}
                    </Button>

                    <Toggle
                      on={!itemHidden}
                      onChange={() =>
                        setItem.mutate({ itemId: item.id, hidden: !itemHidden })
                      }
                      labelOn={t("branchMenu.served")}
                      labelOff={t("branchMenu.notServed")}
                    />
                  </div>

                  {/* Loaded only when opened -- most dishes are never asked
                      about, and a menu is a great many questions to fetch up
                      front. The same reason the app fetches them on demand. */}
                  <button
                    type="button"
                    onClick={() => setOpenOptions(expanded ? null : item.id)}
                    className="self-start ps-md text-[13px] font-semibold text-primary"
                  >
                    {t("branchMenu.options")}
                  </button>

                  {expanded && (
                    <ItemOptionsAtBranch
                      branchId={branch.id}
                      itemId={item.id}
                      decimals={decimals}
                      state={state}
                      disabled={off}
                    />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Minor units as the number a person would say, for the placeholder.
 *
 * The same conversion `MoneyInput` does on the way out, done here because a
 * placeholder is text and the field's own value is not involved.
 */
function toMajor(minorUnits: number, decimals: number | null): string {
  if (decimals === null) return "";
  if (decimals === 0) return String(minorUnits);
  return (minorUnits / 10 ** decimals).toFixed(decimals);
}

/**
 * One dish's questions, as this branch asks them.
 *
 * The same two controls the dishes above have, one level down: a switch for
 * whether it is offered here, and a price that is empty when the branch charges
 * what the brand does.
 *
 * A question turned off takes its answers with it -- `0108` reads it that way
 * and so does `add_to_cart` -- so the rows beneath are dimmed and inert rather
 * than left looking editable.
 */
function ItemOptionsAtBranch({
  branchId,
  itemId,
  decimals,
  state,
  disabled,
}: {
  branchId: string;
  itemId: string;
  decimals: number | null;
  state: BranchMenuOverrides | undefined;
  disabled: boolean;
}) {
  const groups = useItemOptionGroups(itemId);
  const setGroup = useSetGroupHidden(branchId);
  const setOption = useSetOptionHidden(branchId);
  const setPrice = useSetOptionPrice(branchId);

  if (groups.isPending) {
    return <div aria-hidden className="h-[40px] rounded-md bg-neutral-fill" />;
  }

  const rows = groups.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="ps-md text-[13px] text-text-faint">
        {t("branchMenu.noOptions")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sm rounded-md bg-neutral-fill px-lg py-md">
      {rows.map((group) => {
        const groupOff = state?.hiddenGroups.has(group.id) ?? false;

        return (
          <div key={group.id} className="flex flex-col gap-xs">
            <div className="flex items-center gap-md">
              <span className="flex-grow text-[13px] font-semibold">
                {pickLocalized(group.title)}
              </span>
              <Toggle
                on={!groupOff}
                disabled={disabled}
                onChange={() =>
                  setGroup.mutate({ groupId: group.id, hidden: !groupOff })
                }
                labelOn={t("branchMenu.served")}
                labelOff={t("branchMenu.notServed")}
              />
            </div>

            {group.options.map((option) => {
              const optionOff = state?.hiddenOptions.has(option.id) ?? false;
              const override = state?.optionPrices.get(option.id) ?? null;
              const name = pickLocalized(option.name);

              return (
                <div
                  key={option.id}
                  className={cx(
                    "flex items-center gap-md ps-lg",
                    (groupOff || optionOff) && "opacity-60",
                  )}
                >
                  <span className="min-w-0 flex-grow truncate text-[13px]">
                    {name}
                  </span>

                  <span className="w-[120px] shrink-0">
                    <MoneyInput
                      value={override}
                      onChange={(price) =>
                        setPrice.mutate({ optionId: option.id, price })
                      }
                      decimalDigits={decimals}
                      disabled={disabled || groupOff}
                      placeholder={toMajor(option.price, decimals)}
                      aria-label={t("branchMenu.optionPriceFor", { name })}
                    />
                  </span>

                  <Toggle
                    on={!optionOff}
                    disabled={disabled || groupOff}
                    onChange={() =>
                      setOption.mutate({
                        optionId: option.id,
                        hidden: !optionOff,
                      })
                    }
                    labelOn={t("branchMenu.served")}
                    labelOff={t("branchMenu.notServed")}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
