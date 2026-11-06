"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Info,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Badge,
  Button,
  EmptyState,
  SearchInput,
  Segmented,
  Skeleton,
  Switch,
  Tooltip,
  cx,
} from "@/components/ui";
import { MoneyInput } from "@/components/ui/money-input";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { toMajor } from "@/lib/minor-units";

import type { Branch } from "../api/branches";
import type { BranchMenuOverrides } from "../api/branch-menu";
import { menuTree, type MenuItem, type MenuSection } from "../api/menu";
import type { Store } from "../api/stores";
import {
  useBranchOverrides,
  useSetGroupHidden,
  useSetItemHidden,
  useSetItemPrice,
  useSetOptionHidden,
  useSetOptionPrice,
  useSetSectionHidden,
} from "../use-branch-menu";
import { useMenu } from "../use-menu";
import { useItemOptionGroups } from "../use-options";

import { LevelTag, sectionLevel, type SectionLevel } from "../menu/shared";

import { CopyPricesDialog } from "./copy-prices-dialog";
import { Notice } from "./form-bits";

/**
 * What one branch does differently to the shared menu.
 *
 * ## Nothing here is a draft
 *
 * Every switch writes one row when flipped, and every price when the field is
 * left (blur or Enter — `MoneyInput`'s `onCommit`), so a half-typed figure is
 * never written and tabbing through the list writes nothing. Escape leaves a
 * field without writing. Price writes queue per branch (`useSetItemPrice`), so
 * two quick edits land in the order they were typed.
 *
 * ## Empty means "the same as the shop"
 *
 * A price box shows the shop's price as its **placeholder**, not its value, so
 * a branch charging the same shows an empty box rather than a number somebody
 * might think they set. Clearing a box deletes the override rather than
 * writing the shop's price into it: a copy would stop following the original
 * the moment the menu changed. A branch in a currency of its own has a price
 * of its own for everything (`0229`), so the shop's figure — in another
 * currency — is not offered as a placeholder there.
 *
 * ## Copying prices is one dialog
 *
 * "Copy prices" in the toolbar opens `CopyPricesDialog`: from which branch, the
 * whole menu or one section, and what that would change before it is done. A
 * single dish's price is typed, not copied — one figure is quicker to type than
 * to find in another branch, and a per-row copy button on every dish was a
 * second way to do the same thing that nobody could tell apart from the first.
 *
 * ## The one place a branch's menu is edited
 *
 * This is the branch page's Menu tab, and nowhere else edits these rows: the
 * shop's Menu tab is the shared menu, and a dish's page only reads what each
 * branch does, linking here with `?focus=<dish>` — which scrolls to the dish
 * and marks it, as the shop's menu does on the way back from a dish.
 */
export function BranchMenuEditor({
  storeId,
  store,
  branch,
  siblings,
}: {
  storeId: string;
  store: Store | null;
  branch: Branch;
  siblings: Branch[];
}) {
  const menu = useMenu(storeId);
  const overrides = useBranchOverrides(branch.id);
  const { decimalsOf } = useMoney();
  const setSection = useSetSectionHidden(branch.id);
  const setItem = useSetItemHidden(branch.id);
  const setPrice = useSetItemPrice(branch.id);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ServedFilter>("all");
  const others = siblings.filter((one) => one.id !== branch.id);
  const [copying, setCopying] = useState(false);

  const shopCode = store?.currencyCode ?? "";
  const code = branch.currencyCode ?? shopCode;
  const decimals = decimalsOf(code);
  const inherits =
    branch.currencyCode === null || branch.currencyCode === shopCode;
  const branchName = pickLocalized(branch.name);

  const state = overrides.data;
  const term = search.trim().toLowerCase();
  /** Every section in menu order, each with its full path. */
  const ordered = useMemo(() => {
    const rows: { section: MenuSection; path: string }[] = [];
    for (const aisle of menuTree(menu.data ?? [])) {
      rows.push({ section: aisle, path: pickLocalized(aisle.title) });
      for (const sub of aisle.subAisles) {
        rows.push({
          section: sub,
          path: `${pickLocalized(aisle.title)} › ${pickLocalized(sub.title)}`,
        });
      }
    }
    return rows;
  }, [menu.data]);
  const withDishes = useMemo(
    () => ordered.filter(({ section }) => section.items.length > 0),
    [ordered],
  );

  const groups = useMemo(() => {
    /** Off here: the dish, its section, or the dish everywhere. */
    const offHere = (item: MenuItem, sectionId: string) =>
      !item.isActive ||
      (state?.hiddenItems.has(item.id) ?? false) ||
      (state?.hiddenSections.has(sectionId) ?? false);
    const narrowing = term !== "" || filter !== "all";
    return ordered
      .map(({ section, path }) => ({
        section,
        path,
        items: section.items.filter(
          (item) =>
            (!term ||
              Object.values(item.name).some((name) =>
                name.toLowerCase().includes(term),
              )) &&
            (filter === "all" ||
              (filter === "off") === offHere(item, section.id)),
        ),
      }))
      .filter((group) => !narrowing || group.items.length > 0);
  }, [ordered, term, filter, state]);

  // Arriving from a dish's page: scroll to it once, and mark it for a moment.
  const focus = useSearchParams().get("focus");
  const [highlight, setHighlight] = useState<string | null>(focus);
  const scrolled = useRef(false);
  const ready = menu.isSuccess && overrides.isSuccess;
  useEffect(() => {
    if (scrolled.current || !focus || !ready) return;
    scrolled.current = true;
    document
      .querySelector<HTMLElement>(`[data-dish-id="${CSS.escape(focus)}"]`)
      ?.scrollIntoView({ block: "center" });
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [focus, ready]);

  if (
    menu.isPending ||
    (overrides.isPending && overrides.fetchStatus !== "idle")
  ) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (menu.isError || overrides.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={t("branchMenu.failed")}
        action={
          <Button
            onClick={() => {
              void menu.refetch();
              void overrides.refetch();
            }}
          >
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const all = menu.data ?? [];
  const layout = store?.menuLayout ?? "list";
  const blocks = aisleBlocks(groups, all, layout);

  const empty = (menu.data ?? []).every(
    (section) => section.items.length === 0,
  );

  if (empty) {
    return (
      <EmptyState
        icon={<UtensilsCrossed />}
        title={t("branchMenu.emptyTitle")}
        description={t("branchMenu.emptyBody")}
        action={
          <Button asChild>
            <Link href={`/shops/${storeId}`}>{t("branchMenu.toMenu")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="info" icon={<Info />}>
        {inherits
          ? t("branchMenu.intro", { name: branchName })
          : t("branchMenu.introOwnCurrency", { name: branchName, code })}
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("branchMenu.searchPlaceholder")}
          className="w-full sm:w-64"
        />
        <Segmented<ServedFilter>
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: t("menu.filterAll") },
            { key: "served", label: t("branchMenu.served") },
            { key: "off", label: t("branchMenu.notServed") },
          ]}
        />
        {/* Nothing to copy from on a shop with one branch, so no button. */}
        {others.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setCopying(true)}
            disabled={!state}
            className="sm:ms-auto"
          >
            <Copy />
            {t("branchMenu.copyPrices")}
          </Button>
        )}
      </div>

      {groups.length === 0 && (
        <EmptyState
          title={t("branchMenu.noMatches")}
          action={
            <Button
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              {t("common.clear")}
            </Button>
          }
        />
      )}

      {blocks.map((block) => {
        const card = ({ section, path, items, level }: LevelGroup) => (
          <SectionCard
            key={section.id}
            section={section}
            path={path}
            items={items}
            level={level}
            state={state}
            highlight={highlight}
            branchId={branch.id}
            decimals={decimals}
            inherits={inherits}
            shopCode={shopCode}
            onSectionServed={(served) =>
              setSection.mutate({ sectionId: section.id, hidden: !served })
            }
            onHidden={(itemId, hidden) => setItem.mutate({ itemId, hidden })}
            onPrice={(itemId, price) => setPrice.mutateAsync({ itemId, price })}
          />
        );
        if (!block.aisle) return block.groups.map(card);
        // An aisle is the same card as on the shop's Menu tab: a grey band
        // with its tag, and its sub-aisles indented behind a guide line.
        const dishes = block.groups.reduce(
          (sum, group) => sum + group.section.items.length,
          0,
        );
        return (
          <section
            key={block.aisle.id}
            className="rounded-lg border border-line bg-surface shadow-xs"
          >
            <header className="flex flex-wrap items-center gap-2 rounded-t-lg border-b border-line bg-hover px-4 py-3">
              <h3 className="min-w-0 truncate text-[16px] font-semibold text-ink">
                {pickLocalized(block.aisle.title)}
              </h3>
              <LevelTag level="aisle" />
              <span className="text-[12.5px] text-ink-3 tabular-nums">
                {t("menu.itemCount", { count: dishes })}
              </span>
            </header>
            <div className="rounded-b-lg bg-subtle py-3 ps-4 pe-3 sm:py-4 sm:ps-6 sm:pe-4">
              <div className="flex flex-col gap-2.5 border-s-2 border-line-strong ps-3 sm:ps-4">
                {block.groups.map(card)}
              </div>
            </div>
          </section>
        );
      })}

      {copying && state && others.length > 0 && (
        <CopyPricesDialog
          storeId={storeId}
          store={store}
          branch={branch}
          others={others}
          sections={withDishes}
          target={state}
          onClose={() => setCopying(false)}
        />
      )}
    </div>
  );
}

type LevelGroup = {
  section: MenuSection;
  path: string;
  items: MenuItem[];
  level: SectionLevel;
};

/**
 * The flat list of sections with dishes, with each run of sub-aisles gathered
 * under its aisle — so the branch's menu draws the same three levels as the
 * shop's. A section with no dishes is left out, as before; an aisle shows only
 * as the frame around its sub-aisles (and any dishes still sitting on it).
 */
function aisleBlocks(
  groups: { section: MenuSection; path: string; items: MenuItem[] }[],
  sections: MenuSection[],
  layout: "list" | "aisles",
): { aisle: MenuSection | null; groups: LevelGroup[] }[] {
  const blocks: { aisle: MenuSection | null; groups: LevelGroup[] }[] = [];
  for (const group of groups) {
    if (group.section.items.length === 0) continue;
    const level = sectionLevel(group.section, sections, layout);
    const entry = { ...group, level };
    const aisleId =
      level === "subAisle"
        ? group.section.parentId
        : level === "aisle"
          ? group.section.id
          : null;
    const aisle = aisleId
      ? (sections.find((one) => one.id === aisleId) ?? null)
      : null;
    const last = blocks.at(-1);
    if (aisle && last?.aisle?.id === aisle.id) last.groups.push(entry);
    else blocks.push({ aisle, groups: [entry] });
  }
  return blocks;
}

/**
 * One heading's dishes at this branch. A section is a top-level card (15px
 * semibold, white header, "Section" tag); a sub-aisle is a flat card inside
 * its aisle (14px medium, "Sub-aisle" tag), named on its own since the aisle
 * around it already says where it is.
 */
function SectionCard({
  section,
  path,
  items,
  level,
  state,
  highlight,
  branchId,
  decimals,
  inherits,
  shopCode,
  onSectionServed,
  onHidden,
  onPrice,
}: LevelGroup & {
  state: BranchMenuOverrides | undefined;
  highlight: string | null;
  branchId: string;
  decimals: number | null;
  inherits: boolean;
  shopCode: string;
  onSectionServed: (served: boolean) => void;
  onHidden: (itemId: string, hidden: boolean) => void;
  onPrice: (itemId: string, price: number | null) => Promise<unknown>;
}) {
  const sectionOff = state?.hiddenSections.has(section.id) ?? false;
  const nested = level !== "section";
  return (
    <section
      className={cx(
        "overflow-hidden border border-line bg-surface",
        nested ? "rounded-md" : "rounded-lg shadow-xs",
      )}
    >
      <header
        className={cx(
          "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4",
          nested ? "py-2" : "py-2.5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3
            className={cx(
              "truncate",
              nested ? "text-[14px] font-medium" : "text-[15px] font-semibold",
              sectionOff ? "text-ink-3" : "text-ink",
            )}
          >
            {pickLocalized(section.title)}
          </h3>
          <LevelTag level={level} />
          <span className="text-[12.5px] text-ink-4 tabular-nums">
            {section.items.length}
          </span>
        </div>
        <ServedSwitch
          served={!sectionOff}
          onChange={onSectionServed}
          label={t("branchMenu.sectionServed", { name: path })}
        />
      </header>

      {sectionOff && (
        <p className="border-b border-line bg-hover/50 px-4 py-2 text-[12.5px] text-ink-3">
          {t("branchMenu.sectionOff")}
        </p>
      )}

      <ul className="divide-y divide-line">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            focused={highlight === item.id}
            branchId={branchId}
            state={state}
            sectionOff={sectionOff}
            decimals={decimals}
            inherits={inherits}
            shopCode={shopCode}
            onHidden={(hidden) => onHidden(item.id, hidden)}
            onPrice={(price) => onPrice(item.id, price)}
          />
        ))}
      </ul>
    </section>
  );
}

/** "Served" said in words beside the switch, never by colour alone. */
function ServedSwitch({
  served,
  onChange,
  label,
  disabled,
}: {
  served: boolean;
  onChange: (served: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-2 text-[12.5px] font-medium",
        served ? "text-ink-2" : "text-ink-4",
      )}
    >
      <Switch
        checked={served}
        onCheckedChange={onChange}
        aria-label={label}
        disabled={disabled}
      />
      <span aria-hidden className="w-[4.5rem]">
        {served ? t("branchMenu.served") : t("branchMenu.notServed")}
      </span>
    </span>
  );
}

type ServedFilter = "all" | "served" | "off";

function ItemRow({
  item,
  focused,
  branchId,
  state,
  sectionOff,
  decimals,
  inherits,
  shopCode,
  onHidden,
  onPrice,
}: {
  item: MenuItem;
  /** Just arrived at from the dish's own page. */
  focused: boolean;
  branchId: string;
  state: BranchMenuOverrides | undefined;
  sectionOff: boolean;
  decimals: number | null;
  inherits: boolean;
  shopCode: string;
  onHidden: (hidden: boolean) => void;
  onPrice: (price: number | null) => Promise<unknown>;
}) {
  const { format } = useMoney();
  // Options load only when opened — most dishes are never asked about.
  const [open, setOpen] = useState(false);
  const name = pickLocalized(item.name);
  const itemHidden = state?.hiddenItems.has(item.id) ?? false;
  const override = state?.itemPrices.get(item.id) ?? null;
  const off = sectionOff || itemHidden;

  return (
    <li
      data-dish-id={item.id}
      className={cx(
        "flex flex-col transition-colors",
        focused && "bg-accent-soft/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div
          className={cx("flex min-w-0 flex-1 flex-col", off && "opacity-60")}
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-ink">
              {name}
            </span>
            {!item.isActive && (
              <Badge tone="neutral">{t("branchMenu.offEverywhere")}</Badge>
            )}
          </span>
          <span className="text-[12px] text-ink-3 tabular-nums">
            {t("branchMenu.shopPrice", { price: format(item.price, shopCode) })}
            {override !== null && inherits && (
              <span className="ms-1.5 font-medium text-info-ink">
                {t("branchMenu.ownPrice")}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-32">
            <MoneyInput
              value={override}
              onCommit={(price) => onPrice(price)}
              decimalDigits={decimals}
              disabled={sectionOff}
              placeholder={inherits ? toMajor(item.price, decimals) : undefined}
              aria-label={t("branchMenu.priceFor", { name })}
            />
          </div>
          <ServedSwitch
            served={!itemHidden}
            onChange={(served) => onHidden(!served)}
            label={t("branchMenu.servedFor", { name })}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-ink-3"
          >
            {t("branchMenu.options")}
            <ChevronDown
              className={cx("transition-transform", open && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      {open && (
        <ItemOptionsAtBranch
          branchId={branchId}
          itemId={item.id}
          decimals={decimals}
          inherits={inherits}
          state={state}
          disabled={off}
        />
      )}
    </li>
  );
}

/**
 * One dish's questions, as this branch asks them — the same two controls one
 * level down. A question turned off takes its answers with it (`0108`,
 * `add_to_cart`), so the rows beneath are dimmed and inert.
 */
function ItemOptionsAtBranch({
  branchId,
  itemId,
  decimals,
  inherits,
  state,
  disabled,
}: {
  branchId: string;
  itemId: string;
  decimals: number | null;
  inherits: boolean;
  state: BranchMenuOverrides | undefined;
  disabled: boolean;
}) {
  const groups = useItemOptionGroups(itemId);
  const setGroup = useSetGroupHidden(branchId);
  const setOption = useSetOptionHidden(branchId);
  const setPrice = useSetOptionPrice(branchId);

  if (groups.isPending) {
    return (
      <div className="px-4 pb-3">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (groups.isError) {
    return (
      <p className="px-4 pb-3 text-[12.5px] text-danger-ink">
        {t("common.loadFailed")}
      </p>
    );
  }

  const rows = groups.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="px-4 pb-3 text-[12.5px] text-ink-3">
        {t("branchMenu.noOptions")}
      </p>
    );
  }

  return (
    <div className="mx-4 mb-3 flex flex-col gap-3 rounded-md border border-line bg-subtle p-3">
      {rows.map((group) => {
        const groupOff = state?.hiddenGroups.has(group.id) ?? false;
        // A required question with no choice left here means the dish cannot
        // be added to a basket at this branch. Nothing refuses that at the
        // branch, so it is said while it is true.
        const required = group.isActive && group.minSelections > 0 && !groupOff;
        const servedChoices = group.options.filter(
          (option) =>
            option.isActive && !(state?.hiddenOptions.has(option.id) ?? false),
        );

        return (
          <div key={group.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                {pickLocalized(group.title)}
              </span>
              <ServedSwitch
                served={!groupOff}
                disabled={disabled}
                onChange={(served) =>
                  setGroup.mutate({ groupId: group.id, hidden: !served })
                }
                label={t("branchMenu.servedFor", {
                  name: pickLocalized(group.title),
                })}
              />
            </div>

            {required && servedChoices.length === 0 && (
              <p
                role="status"
                className="rounded bg-warning-soft px-2.5 py-1.5 text-[12px] text-warning-ink"
              >
                {t("branchMenu.requiredEmpty")}
              </p>
            )}

            {group.options.map((option) => {
              const optionOff = state?.hiddenOptions.has(option.id) ?? false;
              const override = state?.optionPrices.get(option.id) ?? null;
              const name = pickLocalized(option.name);
              // The last answer a required question has here cannot go — the
              // database refuses it (`0181`). Locked, with the way out on hover.
              const lastChoice =
                required &&
                !optionOff &&
                servedChoices.length === 1 &&
                servedChoices[0]?.id === option.id;

              return (
                <div
                  key={option.id}
                  className={cx(
                    "flex flex-wrap items-center gap-x-3 gap-y-1.5 ps-3",
                    (groupOff || optionOff) && "opacity-60",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                    {name}
                  </span>
                  <div className="w-28">
                    <MoneyInput
                      value={override}
                      onCommit={(price) =>
                        setPrice.mutateAsync({ optionId: option.id, price })
                      }
                      decimalDigits={decimals}
                      disabled={disabled || groupOff}
                      placeholder={
                        inherits ? toMajor(option.price, decimals) : undefined
                      }
                      aria-label={t("branchMenu.optionPriceFor", { name })}
                    />
                  </div>
                  <Tooltip
                    content={
                      lastChoice ? t("branchMenu.lastChoiceLocked") : undefined
                    }
                  >
                    <span>
                      <ServedSwitch
                        served={!optionOff}
                        disabled={disabled || groupOff || lastChoice}
                        onChange={(served) =>
                          setOption.mutate({
                            optionId: option.id,
                            hidden: !served,
                          })
                        }
                        label={t("branchMenu.servedFor", { name })}
                      />
                    </span>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
