"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { Button, cx } from "@/components/ui";
import { MoneyInput } from "@/components/ui/money-input";
import { ROW_ABOVE } from "@/components/ui/row";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "./api/branches";
import type { BranchMenuOverrides } from "./api/branch-menu";
import type { MenuItem } from "./api/menu";
import { useBranches } from "./use-branches";
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
 * What one branch does differently to the shared menu, drawn *inside* it.
 *
 * ## Why inside the menu, not beside it
 *
 * A branch's differences used to be a page of their own, then a view the Menu
 * tab swapped in. Both made the operator choose between two screens of the
 * same dishes: one where a dish could be renamed, photographed and added, and
 * one where it could be turned off or repriced at Jounieh. On a chain the Menu
 * tab is now always *at* a branch — the picker over it lists branches and
 * nothing else — and these pieces add that branch's switches and prices to the
 * rows of the full editor.
 *
 * What a control applies to is said by where it sits. The row itself — name,
 * picture, price, Live, Archive — is the shop's and changes every branch. The
 * strip under it, headed with the branch's name, is this branch only.
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

type BranchMenu = {
  branch: Branch;
  name: string;
  /** Undefined while loading — every control reads as served until then. */
  state: BranchMenuOverrides | undefined;
  decimals: number | null;
  /** The other branches, for copying prices in. */
  others: Branch[];
  /** Which one to copy from — chosen once in the bar, used at every scope. */
  from: Branch | null;
  setSource: (id: string) => void;
  copying: boolean;
  copyFrom: (scope: { sectionId?: string; itemId?: string }) => void;
  setSection: ReturnType<typeof useSetSectionHidden>;
  setItem: ReturnType<typeof useSetItemHidden>;
  setPrice: ReturnType<typeof useSetItemPrice>;
};

const BranchMenuContext = createContext<BranchMenu | null>(null);

/** The branch the menu is being read at, or null on a one-branch shop. */
export function useBranchMenu() {
  return useContext(BranchMenuContext);
}

/**
 * The branch, its overrides and the writes to them, for every row below.
 *
 * One provider rather than hooks in each row: a menu is a hundred rows, and a
 * hundred copies of the same mutations is a lot of state for one branch's
 * worth of writes. Rendered with `branch` null on a one-branch shop, so the
 * tree under it does not remount when a second branch appears.
 */
export function BranchMenuProvider({
  branch,
  storeId,
  children,
}: {
  branch: Branch | null;
  storeId: string;
  children: ReactNode;
}) {
  const branchId = branch?.id ?? "";
  const overrides = useBranchOverrides(branch?.id ?? null);
  const store = useStore(storeId);
  const siblings = useBranches(storeId);
  const { decimalsOf } = useMoney();

  const setSection = useSetSectionHidden(branchId);
  const setItem = useSetItemHidden(branchId);
  const setPrice = useSetItemPrice(branchId);
  const copy = useCopyBranchPrices(branchId);

  const others = (siblings.data ?? []).filter((one) => one.id !== branchId);
  // An id that is not among `others` — the branch now being read, or one since
  // closed — falls back to the first, so switching branch never leaves the
  // copy picker pointing at the branch it would copy into.
  const [source, setSource] = useState<string | null>(null);
  const from = others.find((one) => one.id === source) ?? others[0] ?? null;

  if (!branch) return <>{children}</>;

  const value: BranchMenu = {
    branch,
    name: pickLocalized(branch.name),
    state: overrides.data,
    decimals: decimalsOf(store.data?.currencyCode ?? ""),
    others,
    from,
    setSource,
    copying: copy.isPending,
    copyFrom: (scope) => {
      if (!from) return;
      copy.mutate({
        fromBranchId: from.id,
        fromName: pickLocalized(from.name),
        sectionId: scope.sectionId ?? null,
        itemId: scope.itemId ?? null,
      });
    },
    setSection,
    setItem,
    setPrice,
  };

  return (
    <BranchMenuContext.Provider value={value}>
      {children}
    </BranchMenuContext.Provider>
  );
}

/** A section's own switch and copy at this branch, for its heading. */
export function BranchSectionControls({ sectionId }: { sectionId: string }) {
  const menu = useBranchMenu();
  if (!menu) return null;
  const hidden = menu.state?.hiddenSections.has(sectionId) ?? false;

  return (
    <>
      <span className="text-[12px] font-semibold text-text-faint">
        {t("branchMenu.at", { name: menu.name })}
      </span>
      <Button
        variant="primary-quiet"
        size="sm"
        disabled={!menu.from || menu.copying}
        onClick={() => menu.copyFrom({ sectionId })}
      >
        {t("branchMenu.copySection")}
      </Button>
      <Toggle
        on={!hidden}
        onChange={() => menu.setSection.mutate({ sectionId, hidden: !hidden })}
        labelOn={t("branchMenu.served")}
        labelOff={t("branchMenu.notServed")}
      />
    </>
  );
}

function useSectionOffHere(sectionId: string): boolean {
  const menu = useBranchMenu();
  return menu?.state?.hiddenSections.has(sectionId) ?? false;
}

/**
 * A section turned off here takes its dishes with it, so the strips under it
 * are dimmed and its price boxes inert. The reason is said once, under the
 * heading, rather than on every row.
 */
export function BranchSectionNote({ sectionId }: { sectionId: string }) {
  const off = useSectionOffHere(sectionId);
  if (!off) return null;

  return (
    <p className="ps-md text-[13px] text-text-faint">
      {t("branchMenu.sectionOff")}
    </p>
  );
}

/**
 * One dish at this branch: served or not, what it costs here, and its options.
 *
 * A strip across the foot of the dish's row, under the branch's name. It sits
 * above the row's stretched click target (`ROW_ABOVE`), so pressing in it never
 * opens the dish's form.
 */
export function BranchItemStrip({
  item,
  sectionId,
}: {
  item: MenuItem;
  sectionId: string;
}) {
  const menu = useBranchMenu();
  const sectionOff = useSectionOffHere(sectionId);
  /** Options are loaded only when opened — most dishes are never asked about. */
  const [optionsOpen, setOptionsOpen] = useState(false);
  if (!menu) return null;

  const name = pickLocalized(item.name);
  const itemHidden = menu.state?.hiddenItems.has(item.id) ?? false;
  const override = menu.state?.itemPrices.get(item.id) ?? null;
  const off = sectionOff || itemHidden;

  return (
    <div
      className={cx(
        ROW_ABOVE,
        "flex basis-full flex-col gap-sm border-t border-border pt-sm",
      )}
    >
      <div className={cx("flex items-center gap-md", off && "opacity-60")}>
        <span className="min-w-0 flex-grow truncate text-[12px] font-semibold text-text-faint">
          {t("branchMenu.at", { name: menu.name })}
        </span>

        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          aria-expanded={optionsOpen}
          className="text-[13px] font-semibold text-text"
        >
          {t("branchMenu.options")}
        </button>

        <span className="w-[130px] shrink-0">
          <MoneyInput
            value={override}
            onChange={(price) =>
              menu.setPrice.mutate({ itemId: item.id, price })
            }
            decimalDigits={menu.decimals}
            disabled={sectionOff}
            // The brand price, as a placeholder — what this branch charges
            // when it says nothing.
            placeholder={toMajor(item.price, menu.decimals)}
            aria-label={t("branchMenu.priceFor", { name })}
          />
        </span>

        <Button
          variant="primary-quiet"
          size="sm"
          disabled={!menu.from || menu.copying}
          onClick={() => menu.copyFrom({ itemId: item.id })}
        >
          {t("branchMenu.copyItem")}
        </Button>

        <Toggle
          on={!itemHidden}
          onChange={() =>
            menu.setItem.mutate({ itemId: item.id, hidden: !itemHidden })
          }
          labelOn={t("branchMenu.served")}
          labelOff={t("branchMenu.notServed")}
        />
      </div>

      {optionsOpen && (
        <ItemOptionsAtBranch
          branchId={menu.branch.id}
          itemId={item.id}
          decimals={menu.decimals}
          state={menu.state}
          disabled={off}
        />
      )}
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
        // The choices this branch still serves. A required question with none
        // left means the dish cannot be added to a basket here at all — the
        // customer is asked a question with no answers. Nothing refuses that
        // at the branch, so it is said before, and while, it is true.
        const required = group.isActive && group.minSelections > 0 && !groupOff;
        const servedChoices = group.options.filter(
          (option) =>
            option.isActive && !(state?.hiddenOptions.has(option.id) ?? false),
        );

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

            {required && servedChoices.length === 0 && (
              <p
                role="status"
                className="rounded-sm bg-warning-wash px-md py-xs text-[12px]"
              >
                {t("branchMenu.requiredEmpty")}
              </p>
            )}

            {group.options.map((option) => {
              const optionOff = state?.hiddenOptions.has(option.id) ?? false;
              const override = state?.optionPrices.get(option.id) ?? null;
              const name = pickLocalized(option.name);
              // Turning this one off would leave the required question with
              // nothing to choose — that press asks first.
              const lastChoice =
                required &&
                !optionOff &&
                servedChoices.length === 1 &&
                servedChoices[0]?.id === option.id;
              const flip = () =>
                setOption.mutate({
                  optionId: option.id,
                  hidden: !optionOff,
                });

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

                  {/* The last answer a required question has here cannot go:
                      the database refuses it (0181), because the dish could
                      not then be ordered at this branch. Locked, with the way
                      out said on hover — turn the question off instead. */}
                  <span
                    title={
                      lastChoice ? t("branchMenu.lastChoiceLocked") : undefined
                    }
                  >
                    <Toggle
                      on={!optionOff}
                      disabled={disabled || groupOff || lastChoice}
                      onChange={flip}
                      labelOn={t("branchMenu.served")}
                      labelOff={t("branchMenu.notServed")}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
