"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowRightLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderInput,
  FolderPlus,
  Layers,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Menu,
  SearchInput,
  Segmented,
  Skeleton,
  Thumb,
  Tooltip,
  cx,
  type MenuItem as MenuAction,
} from "@/components/ui";
import { Select } from "@/components/ui/select";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useGuardedAction } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import {
  applyOrder,
  applySectionOrder,
  canHoldProducts,
  menuTree,
  sectionPath,
  type MenuAisle,
  type MenuItem,
  type MenuSection,
} from "../api/menu";
import { liveBundlesWith } from "../api/bundles";
import { usesMarkup } from "../api/earnings";
import { useBranches } from "../use-branches";
import { useBundles } from "../use-bundles";
import { useShopEarnings, useShopStorePrices } from "../use-earnings";
import {
  useAisles,
  useArchiveMenuItem,
  useArchiveMenuSection,
  useCreateMenuSection,
  useMenu,
  useMenuSearch,
  useReorderMenu,
  useUpdateMenuItem,
  useUpdateMenuSection,
} from "../use-menu";
import { useStore } from "../use-stores";
import { DishList, DishRow, type RowOrder } from "./dish-row";
import {
  GatherDialog,
  MoveSectionDialog,
  SectionDialog,
  type SectionMoves,
} from "./section-dialogs";
import {
  LevelTag,
  openedSections,
  levelCounts,
  newDishHref,
  nextSectionSort,
  nextSortOrder,
  sectionLevel,
  type SectionLevel,
} from "./shared";

/**
 * The Menu tab of a shop.
 *
 * ## What it is for
 *
 * Most visits are one of two jobs: a dish is off today, or a price changed.
 * Both are done from the list — the switch and the price sit on every row —
 * so the common case is one or two clicks and no page load. Everything else
 * about a dish is on its own page, a click on the row away.
 *
 * ## The shared menu, and only that
 *
 * On a chain this is the menu every branch sells from. What one branch serves
 * and charges is on that branch's own page (its Menu tab), so the row's switch
 * and price here always mean the shop's — there used to be a branch picker
 * that changed what they meant, and two meanings on one row is how a dish got
 * hidden everywhere when it was meant for one place. A line above the list
 * names the branches and links to each.
 *
 * ## Reorder, filter and search are different modes
 *
 * A position among matches is not a position in the menu, so dragging is only
 * offered on the whole, unfiltered list. Searching goes to the server
 * (`useMenuSearch`), across every section and both languages; the Live/Hidden
 * filter narrows the list on screen. `/` focuses the search from anywhere on
 * the tab, as it does in Linear and GitHub.
 *
 * ## Borrowed from the best menu editors (2026-11)
 *
 * - **A section rail** (Square's item library, Uber Eats Menu Maker): on a
 *   wide screen the sections are listed beside the menu with their counts, and
 *   a click opens and scrolls to one. A forty-section grocery menu stops being
 *   a scroll hunt.
 * - **Bulk edits** (Square, Shopify): tick dishes — or a section's box for all
 *   of it — and show, hide or move them together. Show and Hide ask first, as
 *   the single switch does, and Hide names the bundles going with them. Archive
 *   stays one dish at a time: it is the one with no switch to flip back.
 * - **Duplicate** (Square, Shopify): a dish's ⋯ opens a new dish filled in from
 *   it, starting hidden.
 */
export function ShopMenuTab({ storeId }: { storeId: string }) {
  return <MenuBoard storeId={storeId} />;
}

type Filter = "all" | "live" | "hidden";

function MenuBoard({ storeId }: { storeId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const guarded = useGuardedAction();
  const branches = useBranches(storeId);
  const branchRows = branches.data ?? [];

  const store = useStore(storeId);
  const menu = useMenu(storeId);
  const update = useUpdateMenuItem(storeId);
  const archive = useArchiveMenuItem(storeId);
  const createSection = useCreateMenuSection(storeId);
  const reorder = useReorderMenu(storeId);
  const bundles = useBundles("", storeId);
  const bundlesOf = (dishId: string) =>
    liveBundlesWith(bundles.data ?? [], dishId);
  // A dish with a price from the shop is priced on its own page (`0262`).
  const earnings = useShopEarnings(storeId);
  const markup = usesMarkup(earnings.data);
  const storePrices = useShopStorePrices(storeId, markup);
  const storePriceOf = (dishId: string) =>
    markup ? (storePrices.data?.items.get(dishId) ?? null) : null;

  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;
  const matches = useMenuSearch(storeId, search);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);

  // `/` to search, unless the operator is already typing somewhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      searchBox.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sections = menu.data ?? [];
  const layout = store.data?.menuLayout ?? "list";
  const code = store.data?.currencyCode ?? "";
  const shopRate = store.data?.exchangeRate ?? null;
  const tree = menuTree(sections);

  /** Whether a dish shows under the current filter. */
  const shows = (item: MenuItem) => {
    if (filter === "all") return true;
    return filter === "hidden" ? !item.isActive : item.isActive;
  };

  // ---- folding, and coming back from a dish ------------------------------

  const focus = params.get("focus");
  const focusSection = focus
    ? sections.find((one) => one.items.some((item) => item.id === focus))
    : undefined;
  /** The section holding the returned-to dish, and its aisle — opened for it. */
  const forced = new Set(
    [focusSection?.id, focusSection?.parentId].filter(
      (id): id is string => typeof id === "string",
    ),
  );
  // Everything starts folded; what was opened is remembered for the round
  // trip to a dish (`openedSections`).
  const [opened, setOpened] = useState<Set<string>>(
    () => new Set(openedSections(storeId)),
  );
  const [released, setReleased] = useState<Set<string>>(() => new Set());
  const isOpen = (id: string) =>
    opened.has(id) || (forced.has(id) && !released.has(id));

  function setOpen(id: string, open: boolean) {
    const memory = openedSections(storeId);
    if (open) memory.add(id);
    else memory.delete(id);
    setOpened(new Set(memory));
    if (!open) setReleased((current) => new Set(current).add(id));
  }

  function setAllOpen(open: boolean) {
    const memory = openedSections(storeId);
    memory.clear();
    if (open) for (const one of sections) memory.add(one.id);
    setOpened(new Set(memory));
    if (!open) setReleased(new Set(sections.map((one) => one.id)));
  }

  const scrolled = useRef(false);
  const [highlight, setHighlight] = useState<string | null>(focus);
  useEffect(() => {
    if (scrolled.current || !focus || !menu.isSuccess) return;
    scrolled.current = true;
    const node = document.querySelector<HTMLElement>(
      `[data-dish-id="${CSS.escape(focus)}"]`,
    );
    node?.scrollIntoView({ block: "center" });
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [focus, menu.isSuccess]);

  // ---- ordering ----------------------------------------------------------

  const canDrag = !searching && filter === "all";

  function reorderSections(ids: string[]) {
    const { next, updates } = applySectionOrder(sections, ids);
    reorder.mutate({ table: "menu_sections", updates, next });
  }

  function reorderItems(sectionId: string, ids: string[]) {
    const section = sections.find((candidate) => candidate.id === sectionId);
    if (!section) return;
    const { next: items, updates } = applyOrder(section.items, ids);
    reorder.mutate({
      table: "menu_items",
      updates,
      // The whole menu with one section's items replaced: the optimistic
      // update replaces the query's data outright.
      next: sections.map((candidate) =>
        candidate.id === sectionId ? { ...candidate, items } : candidate,
      ),
    });
  }

  const sectionOrder = useReorder({
    ids: tree.map((section) => section.id),
    onReorder: reorderSections,
    labelOf: (id) =>
      pickLocalized(sections.find((section) => section.id === id)?.title ?? {}),
    lifted: "relative z-10 shadow-lg",
    disabled: !canDrag,
  });

  // ---- the numbers over the list ----------------------------------------

  const allItems = sections.flatMap((one) => one.items);
  const hiddenCount = allItems.filter((item) => !item.isActive).length;
  const levelOf = (section: MenuSection) =>
    sectionLevel(section, sections, layout);
  const perLevel: Record<SectionLevel, number> = {
    aisle: 0,
    subAisle: 0,
    section: 0,
  };
  for (const one of sections) perLevel[levelOf(one)] += 1;
  // What "add" at the top makes: on an aisles shop every top-level heading is
  // an aisle; elsewhere it is a section until something is put under it.
  const topLevel: SectionLevel = layout === "aisles" ? "aisle" : "section";
  const addTopLabel =
    topLevel === "aisle" ? t("menu.addAisle") : t("menu.addSection");

  // ---- bulk selection ----------------------------------------------------
  //
  // Ids are kept as ticked and read through the menu, so a dish archived or
  // moved away by someone else simply drops out of the count.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const selectable = menu.isSuccess;
  const selected = selectable
    ? allItems.filter((item) => ticked.has(item.id))
    : [];
  function tick(ids: string[], on: boolean) {
    setTicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  const selection: Selection | null = selectable
    ? { has: (id) => ticked.has(id), set: tick }
    : null;
  const firstHolder = tree
    .flatMap((aisle) => [aisle, ...aisle.subAisles])
    .find((one) => canHoldProducts(one, sections, layout));

  const addDish = firstHolder ? (
    <Button
      variant="primary"
      onClick={guarded(() => router.push(newDishHref(storeId, firstHolder.id)))}
    >
      <Plus />
      {t("menu.addDish")}
    </Button>
  ) : (
    <Tooltip content={t("menu.addSectionFirst")}>
      <span>
        <Button variant="primary" disabled>
          <Plus />
          {t("menu.addDish")}
        </Button>
      </span>
    </Tooltip>
  );

  const context = {
    storeId,
    sections,
    layout,
    code,
    shopRate,
    tree,
    shows,
    filtering: filter !== "all",
    isOpen,
    setOpen,
    canDrag,
    bundlesOf,
    storePriceOf,
    update,
    archive,
    highlight,
    reorderItems,
    reorderSections,
    selection,
  };

  const visibleTree =
    filter === "all"
      ? tree
      : tree.filter((aisle) =>
          [aisle, ...aisle.subAisles].some((one) =>
            one.items.some((item) => shows(item)),
          ),
        );

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: find, narrow, act. */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          ref={searchBox}
          value={search}
          onChange={setSearch}
          placeholder={t("menu.search")}
          className="w-full sm:w-72"
        />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: t("menu.filterAll") },
            { key: "live", label: t("menu.filterLive") },
            { key: "hidden", label: t("menu.filterHidden") },
          ]}
        />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {menu.isSuccess && sections.length > 0 && !searching && (
            <Tooltip
              content={
                tree.every((one) => !isOpen(one.id))
                  ? t("menu.expandAll")
                  : t("menu.collapseAll")
              }
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  tree.every((one) => !isOpen(one.id))
                    ? t("menu.expandAll")
                    : t("menu.collapseAll")
                }
                onClick={() => setAllOpen(tree.every((one) => !isOpen(one.id)))}
              >
                {tree.every((one) => !isOpen(one.id)) ? (
                  <ChevronsUpDown />
                ) : (
                  <ChevronsDownUp />
                )}
              </Button>
            </Tooltip>
          )}
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <FolderPlus />
            {addTopLabel}
          </Button>
          {addDish}
        </div>
      </div>

      {branchRows.length > 1 && (
        <p className="rounded-md border border-info/15 bg-info-soft px-3 py-2 text-[13px] text-info-ink">
          {t("menu.branchesNote")}{" "}
          {branchRows.map((one, at) => (
            <span key={one.id}>
              {at > 0 && ", "}
              <Link
                href={`/shops/${storeId}/branches/${one.id}`}
                className="font-medium underline underline-offset-2 hover:text-ink"
              >
                {pickLocalized(one.name)}
              </Link>
            </span>
          ))}
        </p>
      )}

      {menu.isSuccess && sections.length > 0 && !searching && (
        <p className="text-[13px] text-ink-3">
          {t("menu.summaryLevels", {
            items: allItems.length,
            levels: levelCounts(perLevel),
          })}
          {hiddenCount > 0 && (
            <>
              {", "}
              {t("menu.summaryHidden", { count: hiddenCount })}
            </>
          )}
          {canDrag && sectionOrder.sortable && (
            <>
              {", "}
              {t("menu.dragHint")}
            </>
          )}
          {filter !== "all" && (
            <>
              {", "}
              {t("menu.filterNoDrag")}
            </>
          )}
        </p>
      )}

      {menu.isPending && <MenuSkeleton />}

      {menu.isError && (
        <div className="rounded-lg border border-line bg-surface shadow-xs">
          <EmptyState
            icon={<AlertCircle />}
            title={t("menu.failedTitle")}
            description={t("menu.failedBody")}
            action={
              <Button onClick={() => void menu.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </div>
      )}

      {menu.isSuccess && sections.length === 0 && !searching && (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface">
          <EmptyState
            icon={<UtensilsCrossed />}
            title={t("menu.emptyTitle")}
            description={t("menu.emptyAction")}
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                <FolderPlus />
                {addTopLabel}
              </Button>
            }
          />
        </div>
      )}

      {searching ? (
        <SearchResults
          term={search.trim()}
          matches={matches.data}
          fetching={matches.isFetching}
          ctx={context}
          onClear={() => setSearch("")}
        />
      ) : (
        menu.isSuccess &&
        sections.length > 0 && (
          <>
            {sectionOrder.instructions}
            {visibleTree.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface shadow-xs">
                <EmptyState
                  title={t("menu.filterNone")}
                  description={t("menu.filterNoneBody")}
                  action={
                    <Button onClick={() => setFilter("all")}>
                      {t("menu.filterAll")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <div
                className={cx(
                  visibleTree.length > 1 &&
                    "xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start xl:gap-6",
                )}
              >
                {visibleTree.length > 1 && (
                  <SectionRail
                    tree={sectionOrder.ordered(visibleTree, (one) => one.id)}
                    levelOf={levelOf}
                    onGo={(section) => {
                      setOpen(section.id, true);
                      if (section.parentId) setOpen(section.parentId, true);
                      requestAnimationFrame(() =>
                        document
                          .querySelector(
                            `[data-reorder-id="${CSS.escape(section.id)}"]`,
                          )
                          ?.scrollIntoView({
                            block: "start",
                            behavior: "smooth",
                          }),
                      );
                    }}
                  />
                )}
                <div className="flex min-w-0 flex-col gap-4">
                  {sectionOrder
                    .ordered(visibleTree, (one) => one.id)
                    .map((aisle) => (
                      <SectionBlock
                        key={aisle.id}
                        section={aisle}
                        subAisles={aisle.subAisles}
                        ctx={context}
                        order={{
                          rowProps: sectionOrder.rowProps,
                          handleProps: sectionOrder.handleProps,
                          sortable: canDrag && sectionOrder.sortable,
                          carried: sectionOrder.movingId === aisle.id,
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {selected.length > 0 && (
        <BulkBar
          items={selected}
          ctx={context}
          onClear={() => setTicked(new Set())}
        />
      )}

      <SectionDialog
        open={adding}
        onOpenChange={setAdding}
        title={
          topLevel === "aisle"
            ? t("menu.newAisleTitle")
            : t("menu.newSectionTitle")
        }
        level={topLevel}
        pending={createSection.isPending}
        onSave={(fields) =>
          createSection.mutate(
            {
              draft: { storeId, ...fields },
              // At the end. The column has no default, and where a new
              // section goes is a question the caller can answer.
              sortOrder: nextSectionSort(tree),
            },
            { onSuccess: () => setAdding(false) },
          )
        }
      />
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {[0, 1].map((block) => (
        <div
          key={block}
          className="rounded-lg border border-line bg-surface shadow-xs"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-11 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type BoardContext = {
  storeId: string;
  sections: MenuSection[];
  layout: "list" | "aisles";
  code: string;
  shopRate: number | null;
  tree: MenuAisle[];
  shows: (item: MenuItem) => boolean;
  /** A Live/Hidden filter is narrowing the list. */
  filtering: boolean;
  isOpen: (id: string) => boolean;
  setOpen: (id: string, open: boolean) => void;
  canDrag: boolean;
  bundlesOf: (dishId: string) => string[];
  /** Its price from the shop on markup, or null — see `DishRow`. */
  storePriceOf: (dishId: string) => number | null;
  update: ReturnType<typeof useUpdateMenuItem>;
  archive: ReturnType<typeof useArchiveMenuItem>;
  highlight: string | null;
  reorderItems: (sectionId: string, ids: string[]) => void;
  reorderSections: (ids: string[]) => void;
  /** Ticks for bulk edits; null until the menu has loaded. */
  selection: Selection | null;
};

type Selection = {
  has: (id: string) => boolean;
  set: (ids: string[], on: boolean) => void;
};

/** Edits say which level they act on — the tag says it, so does the action. */
const RENAME_LABEL = {
  aisle: "menu.renameAisle",
  subAisle: "menu.renameSubAisle",
  section: "menu.renameSectionLevel",
} as const;
const RENAME_TITLE = {
  aisle: "menu.renameAisleTitle",
  subAisle: "menu.renameSubAisleTitle",
  section: "menu.renameSectionLevelTitle",
} as const;
const ARCHIVE_TITLE = {
  aisle: "menu.aisleArchiveTitle",
  subAisle: "menu.subAisleArchiveTitle",
  section: "menu.sectionArchiveTitle",
} as const;

/**
 * One section, at either level — an aisle, or one of its sub-aisles (0196). A
 * restaurant's menu is the same tree with nothing on the second level, so it
 * draws as plain sections.
 *
 * ## Three kinds of heading, told apart at a glance (2026-11)
 *
 * Each says what it is in several ways at once, never by shade alone:
 *
 * - **Aisle** — a card with a grey header band, 16px semibold title, an
 *   "Aisle" tag with a stack icon, and "n sub-aisles, m items". Its sub-aisles
 *   sit inside on a faint ground, indented behind a guide line.
 * - **Sub-aisle** — a smaller, flat card inside its aisle (no shadow, 14px
 *   medium title, "Sub-aisle" tag with a return-arrow icon).
 * - **Section** — a top-level card like an aisle's but with a white header,
 *   15px semibold title and a "Section" tag with a list icon: it holds dishes
 *   directly.
 */
function SectionBlock({
  section,
  subAisles,
  ctx,
  order,
}: {
  section: MenuSection;
  /** Its sub-aisles, in order; null on a sub-aisle, which has none. */
  subAisles: MenuSection[] | null;
  ctx: BoardContext;
  order: RowOrder;
}) {
  const router = useRouter();
  const guarded = useGuardedAction();
  const archiveSection = useArchiveMenuSection(ctx.storeId);
  const renameSection = useUpdateMenuSection(ctx.storeId);
  const createSection = useCreateMenuSection(ctx.storeId);
  const aisles = useAisles(ctx.storeId);

  const [dialog, setDialog] = useState<
    null | "rename" | "move" | "sub" | "archive" | "merge"
  >(null);

  const isSub = subAisles === null;
  const subs = subAisles ?? [];
  const level = sectionLevel(section, ctx.sections, ctx.layout);
  const title = pickLocalized(section.title);
  const open = ctx.isOpen(section.id);
  const holdsProducts = canHoldProducts(section, ctx.sections, ctx.layout);
  const showsSubAisles = !isSub && (ctx.layout === "aisles" || subs.length > 0);
  const totalItems =
    section.items.length + subs.reduce((sum, sub) => sum + sub.items.length, 0);
  const hiddenItems = [section, ...subs].reduce(
    (sum, one) => sum + one.items.filter((item) => !item.isActive).length,
    0,
  );
  const tickable = section.items.filter((item) => ctx.shows(item));
  const tickedHere = tickable.filter((item) =>
    ctx.selection?.has(item.id),
  ).length;

  const visibleItems = section.items.filter((item) => ctx.shows(item));
  const visibleSubs = ctx.filtering
    ? subs.filter((sub) => sub.items.some((item) => ctx.shows(item)))
    : subs;

  const itemOrder = useReorder({
    ids: section.items.map((item) => item.id),
    onReorder: (ids) => ctx.reorderItems(section.id, ids),
    labelOf: (id) =>
      pickLocalized(section.items.find((item) => item.id === id)?.name ?? {}),
    lifted: "relative z-10 shadow-lg ring-2 ring-accent/40",
    disabled: !ctx.canDrag,
  });

  const subOrder = useReorder({
    ids: subs.map((sub) => sub.id),
    onReorder: ctx.reorderSections,
    labelOf: (id) =>
      pickLocalized(subs.find((sub) => sub.id === id)?.title ?? {}),
    lifted: "relative z-10 shadow-lg",
    disabled: !ctx.canDrag,
  });

  // One level deep, so an aisle that has sub-aisles goes nowhere; anything
  // else may go under any other aisle.
  const movable = isSub || subs.length === 0;
  const moves: SectionMoves | null = movable
    ? {
        targets: ctx.tree
          .filter(
            (aisle) => aisle.id !== section.id && aisle.id !== section.parentId,
          )
          .map((aisle) => ({ id: aisle.id, title: aisle.title })),
        // An aisle may be gathered into a new one; a sub-aisle may come back
        // out to an aisle of its own — refused on an aisles shop while it
        // holds products, so not offered there.
        canGroup: !isSub,
        canUnnest:
          isSub && (ctx.layout === "list" || section.items.length === 0),
        pending: aisles.move.isPending || aisles.group.isPending,
        move: (target, done) =>
          aisles.move.mutate(
            {
              id: section.id,
              name: section.title,
              parentId: target,
              sortOrder: target
                ? nextSectionSort(
                    ctx.tree.find((aisle) => aisle.id === target)?.subAisles ??
                      [],
                  )
                : nextSectionSort(ctx.tree),
            },
            { onSuccess: done },
          ),
        group: (name, imageUrl, done) =>
          aisles.group.mutate(
            { title: name, sectionIds: [section.id], imageUrl },
            { onSuccess: done },
          ),
      }
    : null;

  // Products placed directly on an aisle before 0196, which may not hold them
  // any more. They keep selling; this is the way out for them.
  const loose = !holdsProducts && section.items.length > 0;
  const [gathering, setGathering] = useState(false);

  const addDish = guarded(() =>
    router.push(newDishHref(ctx.storeId, section.id)),
  );

  const actions: MenuAction[] = [
    {
      label: t(RENAME_LABEL[level]),
      icon: <Pencil />,
      onSelect: () => setDialog("rename"),
    },
    ...(moves
      ? [
          {
            label: t("menu.move"),
            icon: <FolderInput />,
            onSelect: () => setDialog("move"),
          },
        ]
      : []),
    // Combining two shelves: everything here goes into another section that
    // holds products. Sections go one level deep (0196), so this — not
    // nesting — is how one sub-aisle ends up inside another.
    ...(holdsProducts && section.items.length > 0
      ? [
          {
            label: t(isSub ? "menu.mergeSubAisle" : "menu.mergeSection"),
            icon: <ArrowRightLeft />,
            onSelect: () => setDialog("merge"),
          },
        ]
      : []),
    ...(showsSubAisles
      ? [
          {
            label: t("menu.addSubAisle"),
            icon: <FolderPlus />,
            onSelect: () => setDialog("sub"),
          },
        ]
      : []),
    "separator",
    {
      label: t("menu.archive"),
      icon: <Archive />,
      tone: "danger",
      onSelect: () => setDialog("archive"),
    },
  ];

  const row = order.rowProps(
    section.id,
    cx(
      level === "subAisle"
        ? "rounded-md border border-line bg-surface"
        : "rounded-lg border border-line bg-surface shadow-xs",
    ),
  );

  // Carried, a section is only its heading — the dishes fold away for the
  // length of the drag, so what travels under the cursor is a strip, not a
  // page. Safe because `useReorder` re-measures at the moment a drag begins.
  const showBody = open && !order.carried;

  return (
    <section {...row}>
      <header
        className={cx(
          "flex items-center gap-2 px-3 sm:px-4",
          showBody && "border-b border-line",
          level === "aisle" && "rounded-t-lg bg-hover py-3",
          level === "aisle" && !showBody && "rounded-b-lg",
          level === "section" && "py-2.5",
          level === "subAisle" && "py-2",
        )}
      >
        {order.sortable && (
          <button
            type="button"
            {...order.handleProps(section.id)}
            className="-ms-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink-2 active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}

        {ctx.selection && tickable.length > 0 && !order.carried && (
          <span className="flex shrink-0 items-center ps-1">
            <Checkbox
              checked={
                tickedHere === 0
                  ? false
                  : tickedHere === tickable.length
                    ? true
                    : "indeterminate"
              }
              onCheckedChange={() =>
                ctx.selection?.set(
                  tickable.map((item) => item.id),
                  tickedHere !== tickable.length,
                )
              }
              label={
                <span className="sr-only">
                  {t("menu.selectSection", { name: title })}
                </span>
              }
            />
          </span>
        )}

        <button
          type="button"
          onClick={() => ctx.setOpen(section.id, !open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1 text-start"
        >
          <ChevronRight
            aria-hidden
            className={cx(
              "size-4 shrink-0 text-ink-4 transition-transform rtl:rotate-180",
              open && "rotate-90 rtl:rotate-90",
            )}
          />
          {(ctx.layout === "aisles" || section.imageUrl) && (
            <Thumb
              src={section.imageUrl}
              size={level === "aisle" ? 36 : level === "subAisle" ? 28 : 32}
            />
          )}
          <h3
            className={cx(
              "truncate text-ink",
              level === "aisle" && "text-[16px] font-semibold",
              level === "section" && "text-[15px] font-semibold",
              level === "subAisle" && "text-[14px] font-medium",
            )}
          >
            {title}
          </h3>
          <LevelTag level={level} />
          {level !== "section" && !section.imageUrl && (
            <Badge tone="warning" dot>
              {t("menu.noPicture")}
            </Badge>
          )}
          <span className="shrink-0 text-[12.5px] text-ink-3 tabular-nums">
            {subs.length > 0
              ? t("menu.aisleCount", {
                  subAisles: subs.length,
                  items: totalItems,
                })
              : t("menu.itemCount", { count: section.items.length })}
            {hiddenItems > 0 && (
              <>
                {", "}
                {t("menu.summaryHidden", { count: hiddenItems })}
              </>
            )}
          </span>
        </button>

        {!order.carried && (
          <div className="flex shrink-0 items-center gap-1">
            {holdsProducts && (
              <Tooltip content={t("menu.addDishTo", { section: title })}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={addDish}
                  aria-label={t("menu.addDishTo", { section: title })}
                >
                  <Plus />
                </Button>
              </Tooltip>
            )}
            <Menu
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("menu.sectionMore", { name: title })}
                >
                  <MoreHorizontal />
                </Button>
              }
              items={actions}
            />
          </div>
        )}
      </header>

      {showBody && (
        <div>
          {loose && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-subtle px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13.5px] font-medium text-ink">
                  {t("menu.looseTitle", { count: section.items.length })}
                </span>
                <span className="text-[12.5px] text-ink-3">
                  {t("menu.looseBody")}
                </span>
              </div>
              <Button
                size="sm"
                pending={aisles.gather.isPending}
                onClick={() => setGathering(true)}
              >
                {t("menu.looseGather")}
              </Button>
              <GatherDialog
                open={gathering}
                onOpenChange={setGathering}
                name={title}
                pending={aisles.gather.isPending}
                onGather={(imageUrl) =>
                  aisles.gather.mutate(
                    { sectionId: section.id, name: section.title, imageUrl },
                    { onSuccess: () => setGathering(false) },
                  )
                }
              />
            </div>
          )}

          {itemOrder.instructions}
          {visibleItems.length > 0 && (
            <DishList>
              {itemOrder
                .ordered(visibleItems, (item) => item.id)
                .map((item) => (
                  <DishRow
                    key={item.id}
                    item={item}
                    storeId={ctx.storeId}
                    code={ctx.code}
                    shopRate={ctx.shopRate}
                    bundles={ctx.bundlesOf(item.id)}
                    storePrice={ctx.storePriceOf(item.id)}
                    update={ctx.update}
                    archive={ctx.archive}
                    focused={ctx.highlight === item.id}
                    selection={
                      ctx.selection
                        ? {
                            checked: ctx.selection.has(item.id),
                            onChange: (on) => ctx.selection?.set([item.id], on),
                          }
                        : undefined
                    }
                    order={{
                      rowProps: itemOrder.rowProps,
                      handleProps: itemOrder.handleProps,
                      sortable: ctx.canDrag && itemOrder.sortable,
                      carried: itemOrder.movingId === item.id,
                    }}
                  />
                ))}
            </DishList>
          )}

          {holdsProducts && section.items.length === 0 && (
            <button
              type="button"
              onClick={addDish}
              className="flex w-full items-center gap-2 px-4 py-3.5 text-start text-[13.5px] text-ink-3 transition-colors hover:bg-subtle hover:text-ink"
            >
              <Plus className="size-4" />
              {t("menu.sectionEmptyAdd")}
            </button>
          )}

          {showsSubAisles && (
            // The aisle's inside: a faint ground, and the sub-aisles indented
            // behind a guide line, so what belongs to which aisle reads from
            // the left edge (the right, in Arabic) without counting borders.
            <div className="flex flex-col gap-2.5 rounded-b-lg bg-subtle py-3 ps-4 pe-3 sm:py-4 sm:ps-6 sm:pe-4">
              {subOrder.instructions}
              <div className="flex flex-col gap-2.5 border-s-2 border-line-strong ps-3 sm:ps-4">
                {subOrder
                  .ordered(visibleSubs, (sub) => sub.id)
                  .map((sub) => (
                    <SectionBlock
                      key={sub.id}
                      section={sub}
                      subAisles={null}
                      ctx={ctx}
                      order={{
                        rowProps: subOrder.rowProps,
                        handleProps: subOrder.handleProps,
                        sortable: ctx.canDrag && subOrder.sortable,
                        carried: subOrder.movingId === sub.id,
                      }}
                    />
                  ))}
                {ctx.layout === "aisles" &&
                  subs.length === 0 &&
                  section.items.length === 0 && (
                    <p className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-3 text-[13px] text-ink-3">
                      {t("menu.aisleNeedsSubAisle")}
                    </p>
                  )}
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialog("sub")}
                >
                  <FolderPlus />
                  {t("menu.addSubAisle")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <SectionDialog
        open={dialog === "rename"}
        onOpenChange={(next) => setDialog(next ? "rename" : null)}
        title={t(RENAME_TITLE[level], { name: title })}
        level={level}
        initial={{ title: section.title, imageUrl: section.imageUrl }}
        pending={renameSection.isPending}
        onSave={(fields) =>
          renameSection.mutate(
            { id: section.id, ...fields },
            { onSuccess: () => setDialog(null) },
          )
        }
      />
      <SectionDialog
        open={dialog === "sub"}
        onOpenChange={(next) => setDialog(next ? "sub" : null)}
        title={t("menu.newSubAisleTitle", { name: title })}
        level="subAisle"
        placeholder={{ en: "Milk", ar: "حليب" }}
        pending={createSection.isPending}
        onSave={(fields) =>
          createSection.mutate(
            {
              draft: { storeId: ctx.storeId, ...fields, parentId: section.id },
              sortOrder: nextSectionSort(subs),
            },
            { onSuccess: () => setDialog(null) },
          )
        }
      />
      {moves && (
        <MoveSectionDialog
          open={dialog === "move"}
          onOpenChange={(next) => setDialog(next ? "move" : null)}
          name={title}
          isSub={isSub}
          moves={moves}
        />
      )}
      {dialog === "merge" && (
        <MergeProductsDialog
          section={section}
          ctx={ctx}
          onClose={() => setDialog(null)}
          onEmptied={() => setDialog("archive")}
        />
      )}
      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t(ARCHIVE_TITLE[level])}
        description={t("menu.sectionArchiveBody")}
        confirmLabel={t("menu.archiveConfirm")}
        tone="danger"
        onConfirm={() =>
          archiveSection.mutateAsync({ id: section.id, name: section.title })
        }
      />
    </section>
  );
}

/**
 * What a search found, sections first — a heading matching the term is the
 * broader answer, "you meant this part of the menu".
 *
 * A dish found by search carries the same switch, price and actions it has in
 * the list (it is the same dish found another way), minus the handle, plus the
 * line naming which section it is in — the context the list has stopped
 * providing.
 */
function SearchResults({
  term,
  matches,
  fetching,
  ctx,
  onClear,
}: {
  term: string;
  matches: ReturnType<typeof useMenuSearch>["data"];
  fetching: boolean;
  ctx: BoardContext;
  onClear: () => void;
}) {
  if (!matches) {
    return <MenuSkeleton />;
  }

  const count = matches.sections.length + matches.items.length;
  if (count === 0 && !fetching) {
    return (
      <div className="rounded-lg border border-line bg-surface shadow-xs">
        <EmptyState
          icon={<SearchX />}
          title={t("menu.searchNone", { term })}
          description={t("menu.searchHint")}
          action={<Button onClick={onClear}>{t("menu.searchClear")}</Button>}
        />
      </div>
    );
  }

  const levelOfMatch = (match: { id: string; parentId: string | null }) =>
    sectionLevel(match, ctx.sections, ctx.layout);

  const pathOf = (id: string) => {
    const section = ctx.sections.find((one) => one.id === id);
    return section ? pickLocalized(sectionPath(section, ctx.sections)) : "";
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-3">
        {t("menu.searchResults", { count })}
        {", "}
        {t("menu.searchNoDrag")}
      </p>

      {matches.sections.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
          <ul className="divide-y divide-line">
            {matches.sections.map((section) => (
              <li
                key={section.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <LevelTag level={levelOfMatch(section)} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                  {pickLocalized(sectionPath(section, ctx.sections))}
                </span>
                <span className="text-[12.5px] text-ink-3 tabular-nums">
                  {t("menu.itemCount", { count: section.itemCount })}
                </span>
                <SearchSectionActions
                  id={section.id}
                  ctx={ctx}
                  onReveal={onClear}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {matches.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
          <DishList>
            {matches.items.map((item) => (
              <DishRow
                key={item.id}
                item={item}
                storeId={ctx.storeId}
                code={ctx.code}
                shopRate={ctx.shopRate}
                context={pathOf(item.sectionId)}
                bundles={ctx.bundlesOf(item.id)}
                storePrice={ctx.storePriceOf(item.id)}
                update={ctx.update}
                archive={ctx.archive}
                selection={
                  ctx.selection
                    ? {
                        checked: ctx.selection.has(item.id),
                        onChange: (on) => ctx.selection?.set([item.id], on),
                      }
                    : undefined
                }
              />
            ))}
          </DishList>
        </div>
      )}
    </div>
  );
}

/**
 * A matching section's way back into the list: clear the search with that
 * section opened, where its rename, move and archive live.
 */
function SearchSectionActions({
  id,
  ctx,
  onReveal,
}: {
  id: string;
  ctx: BoardContext;
  onReveal: () => void;
}) {
  const section = ctx.sections.find((one) => one.id === id);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        ctx.setOpen(id, true);
        if (section?.parentId) ctx.setOpen(section.parentId, true);
        onReveal();
        requestAnimationFrame(() =>
          document
            .querySelector(`[data-reorder-id="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ block: "start", behavior: "smooth" }),
        );
      }}
    >
      {t("menu.showInMenu")}
    </Button>
  );
}

/**
 * The sections, beside the menu on a wide screen — Square's and Uber Eats'
 * category column. A click opens the section (and its aisle) and scrolls to
 * it; the order is the menu's, drag preview included.
 */
function SectionRail({
  tree,
  levelOf,
  onGo,
}: {
  tree: MenuAisle[];
  levelOf: (section: MenuSection) => SectionLevel;
  onGo: (section: MenuSection) => void;
}) {
  const count = (one: MenuSection, subs: MenuSection[]) =>
    one.items.length + subs.reduce((sum, sub) => sum + sub.items.length, 0);
  return (
    <nav
      aria-label={t("menu.sections")}
      className="sticky top-4 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-lg border border-line bg-surface py-2 shadow-xs xl:block"
    >
      <p className="px-3 pt-1 pb-2 text-[12.5px] font-semibold text-ink-3">
        {t("menu.sections")}
      </p>
      <ul className="flex flex-col">
        {tree.map((aisle) => (
          <li key={aisle.id}>
            <RailLink
              label={pickLocalized(aisle.title)}
              count={count(aisle, aisle.subAisles)}
              onClick={() => onGo(aisle)}
              level={levelOf(aisle)}
            />
            {aisle.subAisles.length > 0 && (
              <ul className="ms-[18px] mb-1 flex flex-col border-s border-line-strong">
                {aisle.subAisles.map((sub) => (
                  <li key={sub.id}>
                    <RailLink
                      label={pickLocalized(sub.title)}
                      count={sub.items.length}
                      onClick={() => onGo(sub)}
                      level="subAisle"
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * One line of the rail. An aisle is semibold with a stack icon, a section
 * regular with a list icon, and a sub-aisle indented behind its aisle's guide
 * line — the same three cues as the headings in the list.
 */
function RailLink({
  label,
  count,
  onClick,
  level,
}: {
  label: string;
  count: number;
  onClick: () => void;
  level: SectionLevel;
}) {
  const Icon = level === "aisle" ? Layers : level === "section" ? List : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("menu.jumpTo", { name: label })}
      className={cx(
        "flex w-full items-center gap-2 py-1.5 pe-3 text-start transition-colors hover:bg-hover hover:text-ink",
        level === "aisle" && "ps-3 text-[13px] font-semibold text-ink",
        level === "section" && "ps-3 text-[13px] text-ink-2",
        level === "subAisle" && "ps-3 text-[12.5px] text-ink-3",
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className="size-3.5 shrink-0 text-ink-4 rtl:-scale-x-100"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[12px] text-ink-4 tabular-nums">
        {count}
      </span>
    </button>
  );
}

/**
 * Moves every product in one section into another section that holds
 * products, keeping their order, after whatever the target already has.
 *
 * Each dish goes through the same optimistic update as everywhere else, and
 * the archive offer waits for **every** move to have landed: archiving a
 * section takes what is still in it along, so offering it while a move is in
 * flight could archive a dish that was on its way out.
 */
function MergeProductsDialog({
  section,
  ctx,
  onClose,
  onEmptied,
}: {
  section: MenuSection;
  ctx: BoardContext;
  onClose: () => void;
  onEmptied: () => void;
}) {
  const [target, setTarget] = useState("");
  const [archiveAfter, setArchiveAfter] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(0);

  const name = pickLocalized(section.title);
  const holders = ctx.tree
    .flatMap((aisle) => [aisle, ...aisle.subAisles])
    .filter(
      (one) =>
        one.id !== section.id && canHoldProducts(one, ctx.sections, ctx.layout),
    );
  const destination = holders.find((one) => one.id === target) ?? null;
  const count = section.items.length;

  async function merge() {
    if (!destination) return;
    setPending(true);
    setFailed(0);
    const base = nextSortOrder(
      ctx.sections.find((one) => one.id === destination.id),
    );
    const ordered = [...section.items].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const results = await Promise.allSettled(
      ordered.map((item, index) =>
        ctx.update.mutateAsync({
          id: item.id,
          patch: { sectionId: destination.id, sortOrder: base + index },
        }),
      ),
    );
    setPending(false);
    const refused = results.filter((one) => one.status === "rejected").length;
    if (refused > 0) {
      // The hook has toasted each refusal; the dialog stays so it is clear
      // the section is not empty, and nothing is offered for archiving.
      setFailed(refused);
      return;
    }
    if (archiveAfter) onEmptied();
    else onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && onClose()}
      title={t("menu.mergeTitle", { name })}
      description={t("menu.mergeBody", { count })}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!destination}
            pending={pending}
            onClick={() => void merge()}
          >
            {t("menu.mergeConfirm", { count })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("menu.mergeTo")} hint={t("menu.mergeHint")}>
          {(field) => (
            <Select
              {...field}
              value={target}
              disabled={pending}
              onChange={setTarget}
              placeholder={t("menu.moveChoose")}
              options={holders.map((one) => ({
                value: one.id,
                label: pickLocalized(sectionPath(one, ctx.sections)),
              }))}
            />
          )}
        </Field>
        <Checkbox
          checked={archiveAfter}
          onCheckedChange={setArchiveAfter}
          disabled={pending}
          label={t("menu.mergeArchive", { name })}
          description={t("menu.mergeArchiveHint")}
        />
        {failed > 0 && (
          <p role="alert" className="text-[13px] text-danger-ink">
            {t("menu.mergePartial", { count: failed })}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/**
 * What the ticked dishes can have done to them together, pinned to the bottom
 * of the screen while anything is ticked (Shopify's bulk bar).
 *
 * Each action writes dish by dish through the same optimistic update the row's
 * own switch uses, so a refusal puts that one dish back and says why, and the
 * refetch after settles the rest.
 */
function BulkBar({
  items,
  ctx,
  onClear,
}: {
  items: MenuItem[];
  ctx: BoardContext;
  onClear: () => void;
}) {
  const [asking, setAsking] = useState<null | "show" | "hide" | "move">(null);
  const [target, setTarget] = useState("");

  const hidden = items.filter((item) => !item.isActive);
  const live = items.filter((item) => item.isActive);
  const bundles = [
    ...new Set(live.flatMap((item) => ctx.bundlesOf(item.id))),
  ].join(", ");

  const holders = ctx.tree
    .flatMap((aisle) => [aisle, ...aisle.subAisles])
    .filter((one) => canHoldProducts(one, ctx.sections, ctx.layout));
  const destination = holders.find((one) => one.id === target) ?? null;
  const moving = destination
    ? items.filter((item) => item.sectionId !== destination.id)
    : [];

  function setActive(rows: MenuItem[], isActive: boolean) {
    for (const item of rows) {
      ctx.update.mutate({ id: item.id, patch: { isActive } });
    }
    onClear();
  }

  function move() {
    if (!destination) return;
    // In menu order, after whatever the section already holds.
    const base = nextSortOrder(
      ctx.sections.find((one) => one.id === destination.id),
    );
    moving.forEach((item, index) =>
      ctx.update.mutate({
        id: item.id,
        patch: { sectionId: destination.id, sortOrder: base + index },
      }),
    );
    setAsking(null);
    onClear();
  }

  return (
    <>
      <div
        role="region"
        aria-label={t("menu.selected", { count: items.length })}
        className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-lg"
      >
        <span className="me-auto ps-1 text-[13.5px] font-medium text-ink tabular-nums">
          {t("menu.selected", { count: items.length })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={hidden.length === 0}
          onClick={() => setAsking("show")}
        >
          <Eye />
          {t("menu.bulkShow")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={live.length === 0}
          onClick={() => setAsking("hide")}
        >
          <EyeOff />
          {t("menu.bulkHide")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={holders.length === 0}
          onClick={() => {
            setTarget("");
            setAsking("move");
          }}
        >
          <FolderInput />
          {t("menu.bulkMove")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("menu.bulkClear")}
          onClick={onClear}
        >
          <X />
        </Button>
      </div>

      <ConfirmDialog
        open={asking === "show"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("menu.bulkShowTitle", { count: hidden.length })}
        description={t("menu.bulkShowBody")}
        confirmLabel={t("menu.showConfirm")}
        onConfirm={() => setActive(hidden, true)}
      />
      <ConfirmDialog
        open={asking === "hide"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("menu.bulkHideTitle", { count: live.length })}
        description={
          bundles
            ? t("menu.bulkHideInBundlesBody", { bundles })
            : t("menu.bulkHideBody")
        }
        confirmLabel={t("menu.hideConfirm")}
        onConfirm={() => setActive(live, false)}
      />
      <Dialog
        open={asking === "move"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("menu.bulkMoveTitle", { count: items.length })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsking(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={moving.length === 0}
              onClick={move}
            >
              {t("menu.bulkMoveConfirm")}
            </Button>
          </>
        }
      >
        <Field label={t("menu.bulkMoveLabel")} hint={t("menu.bulkMoveHint")}>
          {(field) => (
            <Select
              {...field}
              value={target}
              onChange={setTarget}
              placeholder={t("menu.moveChoose")}
              options={holders.map((one) => ({
                value: one.id,
                label: pickLocalized(sectionPath(one, ctx.sections)),
              }))}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
