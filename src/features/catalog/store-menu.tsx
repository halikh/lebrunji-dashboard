"use client";

import { useRouter } from "next/navigation";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useGuardedAction } from "@/components/unsaved-changes";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { Button, cx, Field } from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useRowFocus } from "@/components/ui/row-focus";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { Collapse } from "@/components/ui/collapse";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalizedField } from "@/components/ui/localized-field";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useRevealOnMount } from "@/components/ui/reveal";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH, TEXT } from "@/lib/limits";
import { itemUnit, pricePerUnit, unitKey } from "@/lib/units";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import {
  applyOrder,
  applySectionOrder,
  canHoldProducts,
  menuTree,
  sectionPath,
  type MenuItem,
  type MenuSection,
} from "./api/menu";
import {
  BranchItemStrip,
  BranchMenuProvider,
  BranchSectionControls,
  BranchSectionNote,
  useBranchMenu,
} from "./branch-menu";
import { BulkForm } from "./bulk-form";
import { ItemTags } from "./tag-chip";
import {
  useAisles,
  useArchiveMenuItem,
  useArchiveMenuSection,
  useUpdateMenuSection,
  useCreateMenuItems,
  useCreateMenuSection,
  useCreateMenuSections,
  useMenu,
  useMenuSearch,
  useReorderMenu,
  useUpdateMenuItem,
} from "./use-menu";
import { useLanguages } from "@/features/reference/use-languages";
import { useStore } from "./use-stores";
import { useBranches } from "./use-branches";

/**
 * One shop's menu.
 *
 * ## The form opens beside the list, not inside it
 *
 * The flow study called for editing in the row itself. This replaces that, and
 * the reason is what an item actually carries: two languages of name, two of
 * description, a price, a slug, a switch, and an image to come. Growing a row
 * to fit all of that reflows every row beneath it, so the list the operator was
 * reading moves under them each time they open one.
 *
 * The panel keeps what mattered about the inline idea and drops what did not.
 * **The section stays on screen beside the form** — the context that says
 * whether the thing being added belongs there — and "save and add another"
 * still leaves the operator exactly where they are. What is lost is editing
 * literally within the row, which was never the point; not losing your place
 * was.
 *
 * It also means one shell pattern: detail opens beside the list here exactly as
 * an order's receipt does.
 */
/**
 * How each shop's menu was left: which sections were open, and how far down
 * the list had been scrolled.
 *
 * Editing a dish is a page of its own, so going to it unmounts this screen and
 * coming back mounts a fresh one — every section closed and the list at the
 * top, which on a long menu is the operator's place thrown away by a Save.
 * `?focus=` brings back the one row; this brings back the rest of the view.
 *
 * Per shop, so arriving at a *different* shop's menu does not open sections
 * somebody chose on another one. Module state rather than storage: it is for
 * the round trip to an editor and back, and a reload starting fresh is fine.
 */
const menuViews = new Map<string, { open: Set<string>; scrollTop: number }>();

function menuView(storeId: string) {
  let view = menuViews.get(storeId);
  if (!view) {
    view = { open: new Set(), scrollTop: 0 };
    menuViews.set(storeId, view);
  }
  return view;
}

function rememberScroll(storeId: string, scrollTop: number) {
  menuView(storeId).scrollTop = scrollTop;
}

function rememberOpen(storeId: string, sectionId: string, open: boolean) {
  const { open: opened } = menuView(storeId);
  if (open) opened.add(sectionId);
  else opened.delete(sectionId);
}

/**
 * The Menu tab — on a chain, always at one of its branches.
 *
 * ## The picker lists branches, and nothing else
 *
 * A branch's differences used to be a page of their own, reached from a
 * "Menu here" button on the Branches tab, and then a view this tab swapped in
 * beside an "every branch" choice. Either way there were two screens of the
 * same dishes — one to rename, photograph and add them, one to turn them off
 * or reprice them at Jounieh — and the operator had to know which they wanted
 * before they could see it.
 *
 * Now there is one. The picker chooses which branch is being read, the full
 * editor is always there, and that branch's switches and prices sit on the
 * rows beside it (see `branch-menu.tsx`). Defaults to the first branch, as the
 * Hours tab does: the list is ordered, and the first one is the one the shop
 * thinks of as its own.
 *
 * It hides itself on a shop with one branch — there is nothing for a branch to
 * differ from, so the shared menu is the whole story.
 *
 * Each branch carries its WhatsApp number under its name in the list: branch
 * names are often a neighbourhood, and the number is what the kitchen answers.
 */
export function StoreMenu({ storeId }: { storeId: string }) {
  const branches = useBranches(storeId);
  const rows = branches.data ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  // A chosen branch since closed falls back to the first rather than to
  // nothing.
  const branch =
    rows.length > 1
      ? (rows.find((row) => row.id === chosen) ?? rows[0] ?? null)
      : null;

  return (
    <div className="flex h-full flex-col">
      {branch && (
        <div className="flex shrink-0 items-center gap-md border-b border-border bg-surface px-lg md:px-xxl py-lg">
          <span className="shrink-0 text-[13px] font-semibold text-text-soft">
            {t("menu.forBranch")}
          </span>
          {/* The rest of the line on a phone, where 280px and the label
              between them are wider than the screen. */}
          <span className="min-w-0 flex-1 md:w-[280px] md:flex-none">
            <Select
              value={branch.id}
              onChange={setChosen}
              options={rows.map((one) => ({
                value: one.id,
                label: pickLocalized(one.name),
                detail: one.whatsappPhone ? `+${one.whatsappPhone}` : undefined,
              }))}
            />
          </span>
        </div>
      )}

      {/* Not keyed on the branch: switching branch changes what the strips
          read, and the menu under them — its scroll, its open sections, a
          half-typed section name — stays exactly where it was. */}
      <div className="min-h-0 flex-1">
        <BranchMenuProvider branch={branch} storeId={storeId}>
          <MenuEditor storeId={storeId} />
        </BranchMenuProvider>
      </div>
    </div>
  );
}

function MenuEditor({ storeId }: { storeId: string }) {
  const router = useRouter();
  const store = useStore(storeId);
  const menu = useMenu(storeId);
  const update = useUpdateMenuItem(storeId);
  const archive = useArchiveMenuItem(storeId);

  const createSection = useCreateMenuSection(storeId);
  const archiveSection = useArchiveMenuSection(storeId);
  const renameSection = useUpdateMenuSection(storeId);
  const reorder = useReorderMenu(storeId);

  const sections = menu.data ?? [];
  const layout = store.data?.menuLayout ?? "list";
  /**
   * The aisles, each holding its sub-aisles (0196). A restaurant's menu is
   * the same tree with nothing on the second level, so it draws as before.
   */
  const tree = menuTree(sections);
  const aisles = useAisles(storeId);

  /** Either level — the aisles, or one aisle's sub-aisles. */
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
      // The whole menu, with one section's items replaced — the optimistic
      // update replaces the query's data outright, so it has to be everything
      // the screen draws, not just the part that moved.
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
    // Carried, a section is just its heading — see `carried` on `Section`. So
    // the lifted look is a small card rather than a slab: white, because that
    // is what every other draggable row in this list is.
    lifted: "relative z-10 rounded-md bg-surface shadow-raised",
    // Reordering stays available while the panel is open — it is beside the
    // list, not over it, and moving a section is not an edit to the one being
    // renamed.
  });

  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  /**
   * The section being renamed, if any.
   *
   * Inline, in the section's own heading — the twin of adding one, which
   * happens inline at the bottom of the list. A name is one field, and sending
   * somebody to a page of their own for it would cost them their place in a
   * menu that runs to several screens, to type eight characters.
   *
   * Here rather than inside `Section` so that a *search result* can open it
   * too: renaming from there clears the search and the form opens on the row in
   * the list, which is where the section actually is.
   */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const guarded = useGuardedAction();

  /**
   * Adding a section, which stays inline while renaming one does not.
   *
   * Not an inconsistency. Renaming is an edit to a thing already in the list,
   * and it opens beside it the way editing an item does. Adding is the end of
   * the list growing by one, in the place the new section will be — and the
   * form is where the button was, so nothing has to move to make room.
   */
  /**
   * How a section is being added: not at all, one at a time, or as a list.
   *
   * One state rather than two booleans — they are mutually exclusive, and two
   * booleans is a fourth state that means nothing.
   */
  const createItems = useCreateMenuItems(storeId);
  const createSections = useCreateMenuSections(storeId);
  const { decimalsOf } = useMoney();

  const [adding, setAddingMode] = useState<"none" | "one" | "bulk">("none");
  const setAdding = (on: boolean) => setAddingMode(on ? "one" : "none");

  /**
   * The search term, and the mode it puts the screen in.
   *
   * Searching and reordering are different jobs on the same list and cannot be
   * done at once: a position among matches is not a position in the menu, so
   * dragging while filtered would either mean nothing or write a `sort_order`
   * the operator never saw. The handles go away and the screen says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;
  // Tied to the input, so the sentence is read out with the field rather than
  // being drawn near it and announced to nobody.
  const searchHintId = useId();

  /**
   * Whether the in-list "Add a section" can be seen.
   *
   * The pinned copy only appears when it cannot. A menu that fits on screen
   * needs no floating bar — the button is right there at the end of the list,
   * where a new section is going to appear — and a menu that does not fit gets
   * the bar so the action is not several screens away. Never both at once.
   */
  const matches = useMenuSearch(storeId, search);

  /**
   * One section, at either level — an aisle, or one of its sub-aisles (0196).
   *
   * A function rather than a second component, so the sub-aisles an aisle
   * draws inside itself get exactly the props, handlers and branch strips the
   * aisles do: the two levels are one thing a step apart, and two call sites
   * would drift. `subAisles` is null for a sub-aisle, which has none.
   */
  function renderSection(
    section: MenuSection,
    subAisles: MenuSection[] | null,
    order: ReorderProps & { carried: boolean },
  ): ReactNode {
    const isSub = subAisles === null;
    const holdsProducts = canHoldProducts(section, sections, layout);
    // One level deep, so an aisle that has sub-aisles goes nowhere; anything
    // else may go under any other aisle.
    const movable = isSub || subAisles.length === 0;
    const targets = tree
      .filter(
        (aisle) => aisle.id !== section.id && aisle.id !== section.parentId,
      )
      .map((aisle) => ({ id: aisle.id, title: aisle.title }));

    return (
      <Section
        key={section.id}
        section={section}
        level={isSub ? "sub" : "aisle"}
        layout={layout}
        subAisles={subAisles ?? []}
        holdsProducts={holdsProducts}
        currencyCode={store.data?.currencyCode ?? ""}
        shopRate={store.data?.exchangeRate ?? null}
        focus={focus}
        initiallyOpen={menuView(storeId).open.has(section.id)}
        onOpenChange={(open) => rememberOpen(storeId, section.id, open)}
        carried={order.carried}
        rowProps={order.rowProps}
        handleProps={order.handleProps}
        renaming={renamingId === section.id}
        renamingWithin={
          subAisles?.some((sub) => sub.id === renamingId) ?? false
        }
        renamePending={renameSection.isPending}
        onRename={guarded(() => setRenamingId(section.id))}
        onRenameSave={(fields) =>
          renameSection.mutate(
            { id: section.id, ...fields },
            { onSuccess: () => setRenamingId(null) },
          )
        }
        onRenameCancel={guarded(() => setRenamingId(null))}
        onArchiveSection={async () => {
          await archiveSection.mutateAsync({
            id: section.id,
            name: section.title,
          });
        }}
        onReorderItems={(ids) => reorderItems(section.id, ids)}
        onEdit={(itemId: string) =>
          guarded(() => router.push(`/catalogue/${storeId}/items/${itemId}`))()
        }
        onAdd={guarded(() =>
          // Which section it joins, so a reload or a pasted link
          // still lands in the right part of the menu.
          router.push(`/catalogue/${storeId}/items/new?section=${section.id}`),
        )}
        decimals={decimalsOf(store.data?.currencyCode ?? "")}
        bulk={{
          pending: createItems.isPending,
          add: (sectionId, items, sortOrder) =>
            createItems.mutate({ sectionId, items, sortOrder }),
        }}
        onToggle={(item) =>
          update.mutate({
            id: item.id,
            patch: { isActive: !item.isActive },
          })
        }
        onArchive={async (item) => {
          await archive.mutateAsync({ id: item.id, name: item.name });
        }}
        renderSubAisle={(sub, subOrder) => renderSection(sub, null, subOrder)}
        onReorderSubAisles={reorderSections}
        subAisleAdd={{
          pending: createSection.isPending || createSections.isPending,
          add: (fields, done) =>
            createSection.mutate(
              {
                draft: { storeId, ...fields, parentId: section.id },
                sortOrder: nextSectionSort(subAisles ?? []),
              },
              { onSuccess: done },
            ),
          paste: (titles, done) =>
            createSections.mutate(
              {
                titles,
                sortOrder: nextSectionSort(subAisles ?? []),
                parentId: section.id,
              },
              { onSuccess: done },
            ),
        }}
        moves={
          movable
            ? {
                targets,
                // An aisle may be gathered into a new one; a sub-aisle may come
                // back out to an aisle of its own — refused on an aisles shop
                // while it holds products, so not offered there.
                canGroup: !isSub,
                canUnnest:
                  isSub && (layout === "list" || section.items.length === 0),
                pending: aisles.move.isPending || aisles.group.isPending,
                move: (target, done) =>
                  aisles.move.mutate(
                    {
                      id: section.id,
                      name: section.title,
                      parentId: target,
                      sortOrder: target
                        ? nextSectionSort(
                            tree.find((aisle) => aisle.id === target)
                              ?.subAisles ?? [],
                          )
                        : nextSectionSort(tree),
                    },
                    { onSuccess: done },
                  ),
                group: (title, done) =>
                  aisles.group.mutate(
                    { title, sectionIds: [section.id] },
                    { onSuccess: done },
                  ),
              }
            : null
        }
        gather={
          !holdsProducts && section.items.length > 0
            ? {
                pending: aisles.gather.isPending,
                run: () =>
                  aisles.gather.mutate({
                    sectionId: section.id,
                    name: section.title,
                  }),
              }
            : null
        }
      />
    );
  }

  /**
   * Put the list back where it was left — once, as soon as the rows it was
   * scrolled through exist. Before paint, so the top of the menu never shows.
   *
   * `instant`, because the scrollers ease (see `globals.css`) and this is not
   * a jump the operator should watch: it is the page they left, unchanged.
   */
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !menu.isSuccess || !scroller.current) return;
    restored.current = true;
    // Nothing remembered is left alone rather than pinned to the top, so a
    // cold arrival's `?focus=` can still scroll its row into view.
    const { scrollTop } = menuView(storeId);
    if (scrollTop === 0) return;
    scroller.current.scrollTo({ top: scrollTop, behavior: "instant" });
  }, [menu.isSuccess, storeId]);

  return (
    // The shop's name and its tabs belong to `StoreScreen`, which draws them
    // once for every tab. This is the menu itself.
    <div className="flex h-full flex-col">
      {/* `relative`, so the pinned add-a-section bar can lie over the bottom of
          the list rather than taking height from it.

          `min-h-0` because this is now a *column* child rather than a row one:
          a flex item's min-height defaults to its content, so without it this
          grows to the height of the whole menu, the scroller inside never
          bounds, and the page picks up a second scrollbar. */}
      <div className="relative flex min-h-0 min-w-0 flex-grow flex-col">
        {/* The hint sits under the box, not beside it — where a field's helper
            always goes, so it reads as belonging to the input rather than as a
            note that happens to be next to it.

            It stays while a search is running, too. Hiding it then would move
            the list up by a line on the first keystroke, and the sentence is
            most worth reading at exactly the moment somebody has searched and
            found less than they expected. */}
        <div className="flex shrink-0 flex-col gap-xs px-lg md:px-xxl pt-lg">
          {/* Wraps on a phone, the box on a line of its own and the buttons
              under it. Kept on one line, two buttons left the box too narrow
              to show what was typed in it. */}
          <div className="flex flex-wrap items-center gap-lg max-md:gap-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("menu.search")}
              className="max-md:basis-full"
            />
            {/* Beside the search rather than at the end of the list. The
                header does not scroll, so this is reachable on a menu of any
                length — which is what the pinned bar used to be for. */}
            {menu.isSuccess && adding === "none" && (
              // Grouped so they wrap as a pair: on a phone they share the line
              // under the search equally rather than stacking one per line.
              <div className="flex items-center gap-lg max-md:basis-full max-md:gap-sm">
                <Button
                  onClick={() => setAddingMode("one")}
                  className="max-md:flex-1"
                >
                  {t("menu.addSection")}
                </Button>
                {/* Beside the one-at-a-time button, because they are two ways
                    to start the same job and the choice is made before either
                    is open. */}
                <Button
                  variant="secondary"
                  onClick={() => setAddingMode("bulk")}
                  className="max-md:flex-1"
                >
                  {t("menu.bulkSections")}
                </Button>
              </div>
            )}
            {searching && (
              <>
                <span className="text-[13px] text-text-faint">
                  {t("menu.searchResults", {
                    count:
                      (matches.data?.sections.length ?? 0) +
                      (matches.data?.items.length ?? 0),
                  })}
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => setSearch("")}
                  className="ms-auto"
                >
                  {t("menu.searchClear")}
                </Button>
              </>
            )}
          </div>
          {/* `ps-md`, matching the input's own padding, so the sentence starts
              under the text rather than under the border. See `Field`. */}
          <span id={searchHintId} className="ps-md text-[12px] text-text-faint">
            {t("menu.searchHint")}
          </span>
        </div>
        <div
          ref={scroller}
          onScroll={(event) => {
            // Only once restored, or the scroll the restore itself causes —
            // and anything before it — would overwrite the place it restores.
            if (restored.current) {
              rememberScroll(storeId, event.currentTarget.scrollTop);
            }
          }}
          className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto scroll-hint p-lg md:p-xxl"
        >
          {menu.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-[66px] rounded-lg bg-line-soft" />
              ))}
            </div>
          )}

          {menu.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <div className="flex flex-col gap-xs">
                <h2 className="text-[19px]">{t("menu.failedTitle")}</h2>
                <p className="text-[14px] text-text-soft">
                  {t("menu.failedBody")}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void menu.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {/* Not while a section is being added: the empty state fills the
              scroller, so the form opened under it — below the fold, on a page
              that said there was nothing here. Nor while searching, which has
              its own empty state and would stack a second one on this. */}
          {menu.isSuccess &&
            menu.data.length === 0 &&
            adding === "none" &&
            !searching && (
              <EmptyState titleKey="menu.emptyTitle" bodyKey="menu.emptyBody" />
            )}

          {searching ? (
            <div className="flex flex-col gap-sm">
              {matches.data?.sections.length === 0 &&
                matches.data.items.length === 0 &&
                !matches.isFetching && (
                  <EmptyState
                    titleKey="menu.searchNone"
                    params={{ term: search.trim() }}
                    mood="lost"
                  />
                )}

              {/* Sections first. A heading matching the term is the broader
                  answer — "you meant this part of the menu" — and burying it
                  under the dishes would make the operator scroll past what
                  they were looking for. */}
              {/* The same controls a section has in the list.
                  A result is the same thing found a different way, so what can
                  be done to it should not depend on how it was reached — and a
                  row that offers only Rename quietly says archiving is
                  unavailable here, which is not true. */}
              {matches.data?.sections.map((section) => (
                <div
                  key={section.id}
                  className="flex flex-wrap items-center gap-md rounded-lg border-2 border-transparent bg-surface px-lg py-md shadow-card"
                >
                  <span className="text-[12px] font-medium tracking-[0.05em] text-text-faint">
                    {section.parentId
                      ? t("menu.subAisleLabel")
                      : t("menu.sectionLabel")}
                  </span>
                  <span className="text-[16px] font-semibold">
                    {/* "Dairy › Milk": a bare "Milk" could be under any
                        aisle. */}
                    {pickLocalized(sectionPath(section, sections))}
                  </span>
                  <span className="text-[13px] text-text-faint">
                    {t("menu.itemCount", { count: section.itemCount })}
                  </span>

                  <div className="ms-auto flex flex-wrap items-center justify-end gap-sm max-md:w-full">
                    {/* The branch's switch, as on the section's heading in
                        the list. */}
                    <BranchSectionControls sectionId={section.id} />
                    <Button
                      variant="primary-quiet"
                      size="sm"
                      // In the list, where the section is — see `renamingId`.
                      // There is no page for a section: clearing the search
                      // brings the list back, and the form, opening in the
                      // section's heading, scrolls itself into view.
                      onClick={guarded(() => {
                        setSearch("");
                        setRenamingId(section.id);
                      })}
                    >
                      {t("menu.renameSection")}
                    </Button>
                    <ConfirmButton
                      onConfirm={async () => {
                        await archiveSection.mutateAsync({
                          id: section.id,
                          name: section.title,
                        });
                      }}
                      titleKey="menu.sectionArchiveTitle"
                      bodyKey="menu.sectionArchiveBody"
                      confirmKey="menu.archiveConfirm"
                      params={{ name: pickLocalized(section.title) }}
                      variant="danger"
                      triggerVariant="danger"
                      size="sm"
                    >
                      {t("menu.archive")}
                    </ConfirmButton>
                  </div>
                </div>
              ))}

              {matches.data?.items.map((item) => (
                <SearchResult
                  key={item.id}
                  item={item}
                  currencyCode={store.data?.currencyCode ?? ""}
                  shopRate={store.data?.exchangeRate ?? null}
                  sectionTitle={pickLocalized(
                    sectionPathOf(item.sectionId, sections),
                  )}
                  onEdit={guarded(() =>
                    router.push(`/catalogue/${storeId}/items/${item.id}`),
                  )}
                  onToggle={() =>
                    update.mutate({
                      id: item.id,
                      patch: { isActive: !item.isActive },
                    })
                  }
                  onArchive={async () => {
                    await archive.mutateAsync({ id: item.id, name: item.name });
                  }}
                />
              ))}
            </div>
          ) : null}

          {!searching && sectionOrder.instructions}

          {!searching &&
            sectionOrder
              .ordered(tree, (section) => section.id)
              .map((section) =>
                renderSection(section, section.subAisles, {
                  rowProps: sectionOrder.rowProps,
                  handleProps: sectionOrder.handleProps,
                  carried: sectionOrder.movingId === section.id,
                }),
              )}

          {/* Adding a section is the bottom of the menu, because that is where
              a new one goes and where the eye already is after reading it.
              Full width, like the "add an item" button inside each section: a
              row of controls that all mean "add something here" should not be
              three different widths. */}
          {/* The form appears where the new section will, at the end of the
              list — and scrolls itself into view, because on a long menu it
              opens below the fold. The button that opens it is pinned below. */}
          {!searching && menu.isSuccess && adding === "bulk" && (
            <BulkForm
              kind="sections"
              // A section is a heading and nothing else — no price column.
              price="none"
              decimals={null}
              pending={createSections.isPending}
              onCancel={guarded(() => setAddingMode("none"))}
              onSubmit={(rows) =>
                createSections.mutate(
                  {
                    titles: rows.map((row) => row.name),
                    sortOrder: sections.length,
                  },
                  { onSuccess: () => setAddingMode("none") },
                )
              }
            />
          )}

          {!searching && menu.isSuccess && adding === "one" && (
            <SectionForm
              pending={createSection.isPending}
              onSave={(fields) =>
                createSection.mutate(
                  {
                    draft: { storeId, ...fields },
                    // At the end. The column has no default, and where a new
                    // section goes is a question the caller can answer and the
                    // database cannot.
                    sortOrder: sections.length,
                  },
                  { onSuccess: () => setAdding(false) },
                )
              }
              onCancel={guarded(() => setAdding(false))}
            />
          )}
        </div>
        {/* The same action, within reach.
            A menu runs to several screens, and scrolling to the bottom to add a
            section is a cost paid over and over on the day a shop is set up —
            which is exactly when it is used most. It appears only when the real
            button has scrolled out of view, so a short menu never grows a bar
            it does not need and the two are never on screen together.

            Hidden while searching, because there is no menu on screen for a new
            section to join. */}{" "}
      </div>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => {
    "data-reorder-id": string;
    className: string;
  };
  handleProps: (id: string) => Record<string, unknown>;
};

/**
 * What an aisle can have done to it as part of the tree (0196) — moved under
 * another aisle, gathered into a new one, or, for a sub-aisle, brought back
 * out. Null where it cannot move at all: an aisle that has sub-aisles of its
 * own, since the tree is one level deep.
 */
type SectionMoves = {
  /** The aisles it can go under. */
  targets: { id: string; title: Localized }[];
  /** Offer "a new aisle" — an aisle only. */
  canGroup: boolean;
  /** Offer "an aisle of its own" — a sub-aisle the database will let out. */
  canUnnest: boolean;
  pending: boolean;
  /** Under `target`, or out to an aisle of its own when null. */
  move: (target: string | null, done: () => void) => void;
  /** Into a new aisle called `title`. */
  group: (title: Localized, done: () => void) => void;
} | null;

function Section({
  section,
  level,
  layout,
  subAisles,
  holdsProducts,
  renderSubAisle,
  onReorderSubAisles,
  subAisleAdd,
  moves,
  gather,
  currencyCode,
  shopRate,
  focus,
  initiallyOpen,
  onOpenChange,
  rowProps,
  handleProps,
  carried,
  renaming,
  renamingWithin,
  renamePending,
  onRename,
  onRenameSave,
  onRenameCancel,
  onArchiveSection,
  onReorderItems,
  onEdit,
  onAdd,
  decimals,
  bulk,
  onToggle,
  onArchive,
}: {
  section: MenuSection;
  /** An aisle, or one of its sub-aisles — see `renderSection`. */
  level: "aisle" | "sub";
  layout: "list" | "aisles";
  /** Its sub-aisles, in order; always empty on a sub-aisle. */
  subAisles: MenuSection[];
  /** Whether a product may be added here — `canHoldProducts`. */
  holdsProducts: boolean;
  renderSubAisle: (
    sub: MenuSection,
    order: ReorderProps & { carried: boolean },
  ) => ReactNode;
  onReorderSubAisles: (ids: string[]) => void;
  /** Adding sub-aisles to this aisle, one at a time or pasted. */
  subAisleAdd: {
    pending: boolean;
    add: (fields: SectionFields, done: () => void) => void;
    paste: (titles: Localized[], done: () => void) => void;
  };
  moves: SectionMoves;
  /**
   * Products sitting directly on an aisle that may not hold them any more —
   * placed before 0196 — and the one call that moves them into a sub-aisle.
   */
  gather: { pending: boolean; run: () => void } | null;
  currencyCode: string;
  /** This shop's own rate — see `ItemRow`. */
  shopRate: number | null;
  /** Which row was just returned from, and how to scroll it back into view. */
  focus: ReturnType<typeof useRowFocus>;
  /** Open when the menu was last left — see `menuViews`. */
  initiallyOpen: boolean;
  /** Told of every open and close, so the menu can remember them. */
  onOpenChange: (open: boolean) => void;
  /** One of its sub-aisles is being renamed, so it opens to show the form. */
  renamingWithin: boolean;
  /** This section's name is being edited, in place of its heading. */
  renaming: boolean;
  renamePending: boolean;
  onRenameSave: (fields: SectionFields) => void;
  onRenameCancel: () => void;
  /** Being dragged, so it shows as its heading alone. */
  carried: boolean;
  onRename: () => void;
  onArchiveSection: () => Promise<void>;
  onReorderItems: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  /** The shop's currency decimals, for scaling prices in a pasted list. */
  decimals: number | null;
  /** Writes a pasted list of items into this section. */
  bulk: {
    pending: boolean;
    add: (
      sectionId: string,
      items: { name: Localized; price: number }[],
      sortOrder: number,
    ) => void;
  };
  onToggle: (item: MenuItem) => void;
  onArchive: (item: MenuItem) => Promise<void>;
} & ReorderProps) {
  const title = pickLocalized(section.title);

  /** Whether this section's paste box is open. Per section, not per menu. */
  const [pasting, setPasting] = useState(false);
  const guarded = useGuardedAction();
  const isSub = level === "sub";

  /** How a sub-aisle is being added here — the menu's own three states. */
  const [subAdding, setSubAdding] = useState<"none" | "one" | "bulk">("none");
  /** Whether the Move panel is open under the heading. */
  const [moving, setMoving] = useState(false);

  /**
   * The sub-aisle block shows on an aisles shop, where every aisle needs one,
   * and wherever there already are some. A restaurant's headings never grow
   * an empty "sub-aisles" area they have no use for.
   */
  const showsSubAisles =
    !isSub && (layout === "aisles" || subAisles.length > 0);
  const totalItems =
    section.items.length +
    subAisles.reduce((sum, sub) => sum + sub.items.length, 0);

  /**
   * Whether this section's items are showing. **Closed to begin with.**
   *
   * A shop's menu is several sections of a dozen-odd rows, and open by default
   * it is a page that has to be scrolled past rather than read: the thing an
   * operator usually wants — which section holds the dish, or what order the
   * sections are in — is the part that was hardest to see. Closed, the whole
   * menu is a short list of headings with their counts, and opening one is a
   * click.
   *
   * It is also what makes dragging sections usable, which is the one control
   * on this screen that decides what a customer sees first.
   *
   * ## And as it was left, after an edit
   *
   * Editing a dish is a page of its own, so coming back remounts this — and
   * an operator who opened three sections, edited a dish and saved found all
   * of them shut again. The menu remembers which were open, per shop (see
   * `menuViews`), and this starts from that.
   *
   * A section returned to through `?focus=` starts open too. It used to be
   * opened by the adjustment below, which compares against the *previous*
   * render — and on a fresh mount there is none, so the section holding the
   * edited dish stayed closed and its row could not be scrolled to.
   */
  const [open, setOpenState] = useState(
    () =>
      initiallyOpen ||
      focus.isFocused(section.id) ||
      section.items.some((item) => focus.isFocused(item.id)) ||
      holdsFocus(subAisles, focus) ||
      renamingWithin,
  );
  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange(next);
  }

  /**
   * Opened by the row focus, so returning from an item's page shows it.
   *
   * `useRowFocus` scrolls the edited row back under the operator's eye — and a
   * row inside a closed section cannot be scrolled to. Adjusted during render
   * rather than in an effect, which is the pattern `StoreScreen` uses for the
   * same kind of state and for the same reason: an effect would paint the
   * section closed once and then open, which is a flash on every return.
   *
   * Opened for a sub-aisle being renamed, too: Rename on a search result puts
   * the form in that sub-aisle's heading, which is inside this collapse.
   */
  const focused =
    focus.isFocused(section.id) ||
    section.items.some((item) => focus.isFocused(item.id)) ||
    holdsFocus(subAisles, focus) ||
    renamingWithin;
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) setOpenState(true);
  }

  const itemOrder = useReorder({
    ids: section.items.map((item) => item.id),
    onReorder: onReorderItems,
    labelOf: (id) =>
      pickLocalized(section.items.find((item) => item.id === id)?.name ?? {}),
    // A ring as well as the shadow. An item row already sits on white, so a
    // shadow alone is a soft edge against a soft background and the carried row
    // is hard to pick out of the ones it is passing — which is the one thing
    // the lifted state exists to say.
    lifted: "relative z-10 shadow-raised ring-2 ring-active",
  });

  /** The sub-aisles' own order, dragged within this aisle only. */
  const subOrder = useReorder({
    ids: subAisles.map((sub) => sub.id),
    onReorder: onReorderSubAisles,
    labelOf: (id) =>
      pickLocalized(subAisles.find((sub) => sub.id === id)?.title ?? {}),
    lifted: "relative z-10 rounded-md bg-surface shadow-raised",
  });

  const row = rowProps(
    section.id,
    cx(
      "flex flex-col gap-sm",
      carried && "px-md py-sm",
      // Inside its aisle, on a tint of its own, so where one sub-aisle ends
      // and the next begins is visible without reading the headings.
      isSub && "rounded-md bg-neutral-fill/40 p-md",
    ),
  );

  return (
    <section {...row}>
      {/* In place of the heading, not under it: the field *is* the name, and a
          form below the thing it edits would leave two of them on screen. The
          items stay where they are — the section is not going anywhere. */}
      {renaming ? (
        <SectionForm
          initial={{ title: section.title, imageUrl: section.imageUrl }}
          pending={renamePending}
          onSave={onRenameSave}
          onCancel={onRenameCancel}
        />
      ) : (
        // `relative`, so the toggle's stretched hit area below has something to
        // be absolute against. The item rows get this from `ROW`; a section
        // heading is not a `ROW` and has to say it itself.
        //
        // It wraps on a phone: the controls take the second line, so the
        // section's name keeps the first rather than being squeezed to nothing
        // between a handle and three buttons.
        <div className="relative flex items-center gap-md max-md:flex-wrap">
          <button {...handleProps(section.id)}>
            <GripIcon />
          </button>

          {/* The heading opens the section, not a chevron beside it — the same
            call `store-options` makes for its groups: the line an operator
            reads to decide whether this is the section they meant should also
            be the thing they press.

            `ROW_TARGET` takes that further: the whole heading **row** toggles,
            including the empty space between the count and the buttons at the
            far end. A strip that responds to a click on the words and ignores
            a click two inches to the right is a target you have to aim at.
            The button stays the control, so the accessible name is the
            section's and `aria-expanded` is on the thing that says it.

            The count comes inside the button, because closed it is the whole
            of what the section says. */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={cx(
              ROW_TARGET,
              "flex min-w-0 items-center gap-md text-left max-md:flex-1",
            )}
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
                "shrink-0 text-text-faint transition-transform",
                open && "rotate-90",
              )}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>

            {/* Marked and scrolled to on the way back from renaming it — the
              same signal an item row gets, for the same "this is the one you
              were working on". */}
            <h2
              ref={focus.attach(section.id)}
              className={cx(
                "truncate",
                isSub ? "text-[16px]" : "text-[18px]",
                focus.isFocused(section.id) && "text-active",
              )}
            >
              {title}
            </h2>
            <span className="shrink-0 text-[13px] text-text-faint">
              {subAisles.length > 0
                ? t("menu.aisleCount", {
                    subAisles: subAisles.length,
                    items: totalItems,
                  })
                : t("menu.itemCount", { count: section.items.length })}
            </span>
          </button>

          {/* Pushed to the far end. These are the section's own controls and
            should not compete with the items under it, which is what the
            operator is actually reading.

            Hidden while the section is being carried: they are things to press,
            and nothing in a block travelling under the cursor is pressable.

            `ROW_ABOVE` keeps them above the heading's stretched hit area —
            without it, Rename and Archive would both just toggle the section. */}
          <div
            className={cx(
              ROW_ABOVE,
              "ms-auto flex items-center gap-sm max-md:w-full max-md:flex-wrap max-md:justify-end",
              carried && "hidden",
            )}
          >
            {/* Blue on a blue tint, beside a filled Archive.
              It needs a ground of its own — two controls together where only
              one has a surface read as one button and one label — and the
              palette says which ground: **blue is what you act on**. A neutral
              fill made it look like a label with a box round it, and blue is
              reserved for the one primary move on a screen. */}
            {/* This branch's switch first, apart from the shop's own Rename
                and Archive — see `branch-menu.tsx`. Nothing on a one-branch
                shop. */}
            <BranchSectionControls sectionId={section.id} />
            <Button variant="primary-quiet" size="sm" onClick={onRename}>
              {t("menu.renameSection")}
            </Button>
            {moves && (
              <Button
                variant="primary-quiet"
                size="sm"
                onClick={() => setMoving(!moving)}
                aria-expanded={moving}
              >
                {t("menu.move")}
              </Button>
            )}
            <ConfirmButton
              onConfirm={onArchiveSection}
              titleKey="menu.sectionArchiveTitle"
              bodyKey="menu.sectionArchiveBody"
              confirmKey="menu.archiveConfirm"
              variant="danger"
              triggerVariant="danger"
              size="sm"
            >
              {t("menu.archive")}
            </ConfirmButton>
          </div>
        </div>
      )}

      {moving && moves && !carried && (
        <MovePanel
          isSub={isSub}
          moves={moves}
          onDone={() => setMoving(false)}
          onCancel={guarded(() => setMoving(false))}
        />
      )}

      <BranchSectionNote sectionId={section.id} />

      {itemOrder.instructions}

      {/* Everything below the heading, in one collapse.

        `open && !carried` rather than two nested wrappers: a carried section is
        already only its heading (see the note below), and that is the same
        state this draws — so the two conditions are one. It also means the
        items do not animate open the moment a drag ends. */}
      <Collapse open={open && !carried}>
        <div className="flex flex-col gap-sm">
          {holdsProducts && section.items.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
              {t("menu.sectionEmpty")}
            </p>
          )}

          {/* Products placed directly on the aisle before 0196. They keep
              selling where they are; this is the way out for them, above the
              rows it is about. */}
          {gather && (
            <div className="flex flex-wrap items-center gap-md rounded-md border border-dashed border-border px-lg py-md">
              <div className="flex min-w-0 flex-1 flex-col gap-xxs">
                <span className="text-[14px] font-semibold">
                  {t("menu.looseTitle", { count: section.items.length })}
                </span>
                <span className="text-[13px] text-text-soft">
                  {t("menu.looseBody")}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                pending={gather.pending}
                onClick={gather.run}
              >
                {t("menu.looseGather")}
              </Button>
            </div>
          )}

          {/* ## Carried, a section is only its heading

          Dragging the whole block meant an opaque slab the height of a screen
          passing over the list and hiding whatever was under it — three items
          would show as "3 items" and one visible row, which reads as data
          missing rather than as something being carried.

          What is being reordered is the *section*, and its heading is the part
          that says which one. So the items fold away for the length of the
          drag and the operator carries a strip instead of a page. It is also
          far less to paint on every frame.

          Changing a row's size mid-drag is normally the one thing that breaks
          all of this — every stored position would be wrong. It is safe here
          because it happens at the instant the drag begins, which is the one
          moment `useReorder` re-measures on purpose.

          The `Collapse` above is what folds them now; this note stays because
          it is *why* a carried section closes, which the condition alone does
          not say. */}
          {itemOrder
            .ordered(section.items, (item) => item.id)
            .map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                sectionId={section.id}
                currencyCode={currencyCode}
                shopRate={shopRate}
                handleProps={itemOrder.handleProps}
                rowProps={itemOrder.rowProps}
                carried={itemOrder.movingId === item.id}
                // Marked and scrolled to on the way back from its own page.
                anchor={focus.attach(item.id)}
                onEdit={() => onEdit(item.id)}
                onToggle={() => onToggle(item)}
                onArchive={() => onArchive(item)}
              />
            ))}

          {showsSubAisles && (
            <div className="flex flex-col gap-sm">
              {subOrder.instructions}
              {subOrder
                .ordered(subAisles, (sub) => sub.id)
                .map((sub) =>
                  renderSubAisle(sub, {
                    rowProps: subOrder.rowProps,
                    handleProps: subOrder.handleProps,
                    carried: subOrder.movingId === sub.id,
                  }),
                )}

              {/* On an aisles shop, an aisle with nothing under it yet says
                  what it is waiting for: products go in a sub-aisle. */}
              {layout === "aisles" &&
                subAisles.length === 0 &&
                section.items.length === 0 && (
                  <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
                    {t("menu.aisleNeedsSubAisle")}
                  </p>
                )}

              {subAdding === "one" ? (
                <SectionForm
                  pending={subAisleAdd.pending}
                  placeholder={{ en: "Milk", ar: "حليب" }}
                  onSave={(fields) =>
                    subAisleAdd.add(fields, () => setSubAdding("none"))
                  }
                  onCancel={guarded(() => setSubAdding("none"))}
                />
              ) : subAdding === "bulk" ? (
                <BulkForm
                  kind="sections"
                  price="none"
                  decimals={null}
                  pending={subAisleAdd.pending}
                  onCancel={guarded(() => setSubAdding("none"))}
                  onSubmit={(rows) =>
                    subAisleAdd.paste(
                      rows.map((one) => one.name),
                      () => setSubAdding("none"),
                    )
                  }
                />
              ) : (
                <div className="flex flex-wrap items-center gap-sm">
                  <Button
                    variant="primary-quiet"
                    size="sm"
                    onClick={() => setSubAdding("one")}
                  >
                    {t("menu.addSubAisle")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSubAdding("bulk")}
                  >
                    {t("menu.bulkSubAisles")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Collapse>

      {/* At the bottom of the section, not in a header. It is where the eye
          already is after reading the list.

          Outside the collapse, so a closed section still offers it: adding a
          dish should not need the section opened first, least of all an empty
          one, where opening it showed nothing but this. Gone while carried —
          a carried section is only its heading. */}
      {!carried &&
        holdsProducts &&
        (pasting ? (
          <BulkForm
            kind="items"
            // An item without a price is not an item — unlike a choice, where
            // free is the common case.
            price="required"
            decimals={decimals}
            pending={bulk.pending}
            onCancel={guarded(() => setPasting(false))}
            onSubmit={(rows) => {
              bulk.add(
                section.id,
                // Never null under the `required` rule.
                rows.map((row) => ({
                  name: row.name,
                  price: row.price ?? 0,
                })),
                nextSortOrder(section),
              );
              setPasting(false);
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-sm">
            <button
              type="button"
              onClick={onAdd}
              className="flex min-w-0 flex-grow items-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-faint hover:bg-neutral-fill hover:text-text-soft"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("menu.addItem", { section: title })}
            </button>

            {/* Full width once it has wrapped under the dashed row on a phone,
                so the two read as one block rather than a stray button. */}
            <Button
              variant="secondary"
              onClick={() => setPasting(true)}
              className="max-md:w-full"
            >
              {t("menu.bulkItems")}
            </Button>
          </div>
        ))}
    </section>
  );
}

function ItemRow({
  item,
  sectionId,
  currencyCode,
  shopRate,
  anchor,
  carried,
  rowProps,
  handleProps,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  /** For the branch strip, which dims under a section off at its branch. */
  sectionId: string;
  currencyCode: string;
  /**
   * `stores.exchange_rate` — `0120` — so the lira line under a dollar price is
   * the number this shop quotes rather than the platform's.
   *
   * Passed down rather than read here: the rate is the shop's, and this row
   * knows about a dish. See `Price`.
   */
  shopRate: number | null;
  anchor: (node: HTMLElement | null) => void;
  /** Being dragged, so it sheds everything that is not identity. */
  carried: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  // On a chain the row wraps, so the branch strip can take a line of its own
  // under the dish rather than crowding the shop's controls.
  const atBranch = useBranchMenu() !== null;
  const row = rowProps(
    item.id,
    cx(
      ROW,
      // On a phone too, whatever the shop: the toggle and Archive take a
      // line of their own there, under the name and the price.
      atBranch ? "flex-wrap" : "max-md:flex-wrap",
      // Marked, not dimmed — fading a row takes its controls with it, and a
      // faded button reads as a disabled one.
      !item.isActive && "border-transparent bg-neutral-fill/60 shadow-none",
      item.isActive && "border-transparent",
    ),
  );

  /** The line under the name: what it is sold by, and what it is. */
  const detail = [unitSize(item), pickLocalized(item.description)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(item.id)}>
        <GripIcon />
      </button>

      {item.imageUrl ? (
        <PreviewImage
          src={item.imageUrl}
          name={pickLocalized(item.name)}
          className={cx(
            "size-[44px] rounded-md",
            !item.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className="size-[44px] rounded-md" />
      )}

      {/* The row opens the form. A pencil icon would be a second target for the
          same intent, and the whole row is the bigger one. */}
      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          // On a phone the name takes the rest of its line — the picture (44px)
          // and a 16px gap are the 60px; the grip sits on the line above, see
          // `handleProps` — and the price drops to the next, at the start of
          // the controls' line. Beside the price a name had about 100px.
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left max-md:basis-[calc(100%-60px)]",
        )}
      >
        <span
          className={cx(
            "truncate text-[15px] font-semibold",
            !item.isActive && "text-text-soft",
          )}
        >
          {pickLocalized(item.name)}
        </span>
        {/* Rendered only when it says something.

            An empty `<span>` is a flex item of zero height, but the column's
            `gap-xxs` is charged for it anyway — so a dish with neither a unit
            nor a description got a trailing gap below its name, the column
            grew by that much, and `items-center` on the row pushed the name
            half a gap **above** the picture and the price beside it. Every
            such row sat visibly high against the ones that had a subtitle. */}
        {detail && (
          <span className="truncate text-[12px] text-text-faint">{detail}</span>
        )}
        {/* What a customer sees on the dish, shown where the operator is
            already looking. Without it, checking which dishes carry "Spicy"
            means opening every one of them.

            Returns null with no tags, so it costs no gap either. */}
        <ItemTags ids={item.tagIds} />
      </button>

      {/* Set in the shop's own currency, shown in both: the price the merchant
          typed on top, what a customer thinking in the other one would hear
          underneath. */}
      <div className="flex shrink-0 flex-col items-end max-md:items-start">
        <Price
          value={item.price}
          code={currencyCode}
          shopRate={shopRate}
          align="end"
          className="text-[15px] font-semibold"
        />
        {/* The comparison figure, quoted per kilo or per litre whichever unit
            was typed — so 500 g at $6.00 and 1 kg at $12.00 read the same. */}
        <PerUnit item={item} code={currencyCode} />
      </div>

      {/* The same rule the section header follows: nothing in a row
          travelling under the cursor is pressable, so a switch and a
          destructive button riding along with it are claims the row cannot
          honour. They go, and what stays is what says *which* row this is —
          the picture, the name and the price.

          Unlike a section this changes almost no height, because these sit
          beside the name rather than under it. That is deliberate: the whole
          reason a section folds is that carrying it hid the list, and an item
          row never did. */}
      {!carried && (
        <>
          {/* Grouped so that on a phone they wrap together, to the end of
              the second line, with the price at its start — see the name's
              basis above. */}
          <div className="flex shrink-0 items-center gap-lg max-md:ms-auto">
            <ConfirmToggle
              on={item.isActive}
              onChange={onToggle}
              labelOn={t("menu.live")}
              labelOff={t("menu.hidden")}
              params={{ name: pickLocalized(item.name) }}
              whenTurningOn={{
                titleKey: "menu.showTitle",
                bodyKey: "menu.showBody",
                confirmKey: "menu.showConfirm",
              }}
              whenTurningOff={{
                titleKey: "menu.hideTitle",
                bodyKey: "menu.hideBody",
                confirmKey: "menu.hideConfirm",
              }}
              className={cx(ROW_ABOVE, "w-[92px]")}
            />

            <ConfirmButton
              className={ROW_ABOVE}
              onConfirm={onArchive}
              titleKey="menu.archiveTitle"
              bodyKey="menu.archiveBody"
              confirmKey="menu.archiveConfirm"
              variant="danger"
              triggerVariant="danger"
              size="sm"
            >
              {t("menu.archive")}
            </ConfirmButton>
          </div>

          <BranchItemStrip item={item} sectionId={sectionId} />
        </>
      )}
    </div>
  );
}

/**
 * Naming a section, inline.
 *
 * ## Why this is not the panel the item editor uses
 *
 * An item carries two languages of name, two of description, a price, a switch
 * and an image; a section carries a name. The panel exists because a form that
 * large reflows the list it is supposed to sit beside — that reasoning does not
 * reach a heading with one field per language, and opening a full-height panel
 * to rename "Starters" would be a bigger interruption than the edit.
 *
 * So it edits in place. The section's own items stay visible underneath, which
 * is the context that says what the heading is naming.
 *
 * No slug field, here or anywhere: the trigger from migration 0071 derives one
 * from the English title and makes it unique within the shop.
 */
/**
 * Naming a section.
 *
 * Two placements, one form, and both of them inline:
 *
 * - **In the section's heading**, when renaming — in place of the name, because
 *   the field *is* the name. The items stay under it, so the section never
 *   leaves the screen to be renamed.
 * - **At the bottom of the list**, when adding — in the place the new section
 *   will appear, where the button was, so nothing has to move to make room.
 *
 * One component either way. Two would drift, and the way they would drift is
 * that one grows a field the other does not.
 *
 * No slug field, in either: the trigger from migration 0071 derives one from
 * the English title and makes it unique within the shop.
 */
/** What the section form edits — its name, and its aisle picture. */
type SectionFields = { title: Localized; imageUrl: string | null };

function SectionForm({
  initial,
  pending,
  placeholder = { en: "Starters", ar: "المقبلات" },
  onSave,
  onCancel,
}: {
  initial?: SectionFields;
  pending: boolean;
  /** The example in the field — a sub-aisle's is "Milk", not "Starters". */
  placeholder?: Localized;
  onSave: (fields: SectionFields) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  // Added at the bottom of a list that scrolls, so it can open entirely below
  // the fold: the click works, the form is there, and the operator sees nothing
  // happen — which reads as the button being broken. Focus lands in the first
  // field too, so they can simply start typing.
  //
  // Only inline. The panel arrives beside the list rather than below it, and it
  // takes focus itself so that Escape closes it.
  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [title, setTitle] = useState<Localized>(initial?.title ?? {});
  // Asked of every shop's sections, not only of supermarkets': it is read only
  // when the shop's menu layout is Aisles, and asking regardless lets the
  // pictures be in place before the layout is switched.
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const result = validateLocalizedText(title, codes, TEXT.title);
    if (!result.ok) {
      setError(t(result.key, result.params));
      return;
    }
    setError(undefined);
    onSave({ title, imageUrl });
  }

  const field = (
    <LocalizedField
      label={t("menu.sectionTitle")}
      value={title}
      onChange={setTitle}
      maxLength={TEXT.title}
      hint={t("menu.sectionTitleHint")}
      error={error}
      filter="title"
      placeholder={placeholder}
    />
  );

  // Cancel then save, in both placements and in the item editor too: the button
  // in a given position should always do the same thing.
  const buttons = (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        {t("common.cancel")}
      </Button>
      <Button onClick={submit} pending={pending}>
        {t("menu.saveSection")}
      </Button>
    </>
  );

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      {field}
      <Field label={t("menu.sectionImage")} hint={t("menu.sectionImageHint")}>
        <ImageUploader
          value={imageUrl}
          onChange={setImageUrl}
          folder="menu-sections"
          disabled={pending}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-sm">{buttons}</div>
    </div>
  );
}

/** The end of one level of the tree — where a new or moved section lands. */
function nextSectionSort(level: { sortOrder: number }[]): number {
  return level.reduce((highest, one) => Math.max(highest, one.sortOrder + 1), 0);
}

/** Whether a row being returned to is in one of these sub-aisles. */
function holdsFocus(
  subAisles: MenuSection[],
  focus: ReturnType<typeof useRowFocus>,
): boolean {
  return subAisles.some(
    (sub) =>
      focus.isFocused(sub.id) ||
      sub.items.some((item) => focus.isFocused(item.id)),
  );
}

/** A section's "Aisle › Sub-aisle" name by id, or nothing for an unknown one. */
function sectionPathOf(id: string, sections: MenuSection[]): Localized {
  const section = sections.find((one) => one.id === id);
  return section ? sectionPath(section, sections) : {};
}

/** The Move panel's two choices that are not an existing aisle. */
const NEW_AISLE = "new";
const OWN_AISLE = "own";

/**
 * Moving a section around the aisles tree, under its heading.
 *
 * One picker of where it can go: any other aisle, plus — for an aisle — a new
 * aisle to gather it into, which asks for that aisle's name, and — for a
 * sub-aisle the database will let out — an aisle of its own. Inline for the
 * reason renaming is: it is one choice, and a page of its own would cost the
 * operator their place in the menu.
 */
function MovePanel({
  isSub,
  moves,
  onDone,
  onCancel,
}: {
  isSub: boolean;
  moves: NonNullable<SectionMoves>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [target, setTarget] = useState("");
  const [title, setTitle] = useState<Localized>({});
  const [error, setError] = useState<string | undefined>(undefined);

  const options = [
    ...(moves.canGroup ? [{ value: NEW_AISLE, label: t("menu.moveNewAisle") }] : []),
    ...(moves.canUnnest ? [{ value: OWN_AISLE, label: t("menu.moveOwnAisle") }] : []),
    ...moves.targets.map((aisle) => ({
      value: aisle.id,
      label: pickLocalized(aisle.title),
    })),
  ];

  function submit() {
    if (!target) {
      setError(t("menu.moveChoose"));
      return;
    }
    if (target === NEW_AISLE) {
      const result = validateLocalizedText(title, codes, TEXT.title);
      if (!result.ok) {
        setError(t(result.key, result.params));
        return;
      }
      setError(undefined);
      moves.group(title, onDone);
      return;
    }
    setError(undefined);
    moves.move(target === OWN_AISLE ? null : target, onDone);
  }

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      <Field
        label={isSub ? t("menu.moveSubAisleTo") : t("menu.moveAisleInto")}
        hint={t("menu.moveHint")}
        error={target === NEW_AISLE ? undefined : error}
      >
        <Select
          value={target}
          onChange={setTarget}
          options={options}
          disabled={moves.pending}
          placeholder={t("menu.moveChoose")}
        />
      </Field>
      {target === NEW_AISLE && (
        <LocalizedField
          label={t("menu.newAisleName")}
          value={title}
          onChange={setTitle}
          maxLength={TEXT.title}
          error={error}
          filter="title"
          placeholder={{ en: "Dairy & Eggs", ar: "ألبان وبيض" }}
        />
      )}
      <div className="flex flex-wrap items-center gap-sm">
        <Button variant="secondary" onClick={onCancel} disabled={moves.pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={moves.pending}>
          {t("menu.moveConfirm")}
        </Button>
      </div>
    </div>
  );
}

function nextSortOrder(section: MenuSection | undefined): number {
  if (!section) return 0;
  return (
    section.items.reduce(
      (highest, item) => Math.max(highest, item.sortOrder),
      0,
    ) + 1
  );
}

/**
 * One search result.
 *
 * ## Why it is not `ItemRow`
 *
 * Two differences, and both are about what a result *is*. It has no drag
 * handle, because a position among matches is not a position in the menu. And
 * it says which section it belongs to, because that is the context the list has
 * stopped providing — a dish's name alone does not say whether it is filed
 * under the right heading, which is quite often what somebody is searching to
 * find out.
 */
function SearchResult({
  item,
  currencyCode,
  shopRate,
  sectionTitle,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  currencyCode: string;
  /** This shop's own rate — see `ItemRow`. */
  shopRate: number | null;
  sectionTitle: string;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => Promise<void>;
}) {
  /** The line under the name — see `ItemRow` on why it is not always drawn. */
  const detail = [unitSize(item), sectionTitle].filter(Boolean).join(" · ");
  // A result is the same dish found a different way, so on a chain it carries
  // the same branch strip its row in the list does — see `ItemRow`.
  const atBranch = useBranchMenu() !== null;

  return (
    <div
      className={cx(
        ROW,
        // As an `ItemRow` does on a phone — see there.
        atBranch ? "flex-wrap" : "max-md:flex-wrap",
        !item.isActive && "border-transparent bg-neutral-fill/60 shadow-none",
        item.isActive && "border-transparent",
      )}
    >
      <Thumbnail
        url={item.imageUrl}
        dim={!item.isActive}
        name={pickLocalized(item.name)}
      />

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left max-md:basis-[calc(100%-60px)]",
        )}
      >
        <span
          className={cx(
            "truncate text-[15px] font-semibold",
            !item.isActive && "text-text-soft",
          )}
        >
          {pickLocalized(item.name)}
        </span>
        {detail && (
          <span className="truncate text-[12px] text-text-faint">{detail}</span>
        )}
        <ItemTags ids={item.tagIds} />
      </button>

      <div className="flex shrink-0 flex-col items-end max-md:items-start">
        <Price
          value={item.price}
          code={currencyCode}
          shopRate={shopRate}
          align="end"
          className="text-[15px] font-semibold"
        />
        {/* The comparison figure, quoted per kilo or per litre whichever unit
            was typed — so 500 g at $6.00 and 1 kg at $12.00 read the same. */}
        <PerUnit item={item} code={currencyCode} />
      </div>

      {/* Together, for the same wrap as an `ItemRow`'s. */}
      <div className="flex shrink-0 items-center gap-lg max-md:ms-auto">
        <ConfirmToggle
          on={item.isActive}
          onChange={onToggle}
          labelOn={t("menu.live")}
          labelOff={t("menu.hidden")}
          params={{ name: pickLocalized(item.name) }}
          whenTurningOn={{
            titleKey: "menu.showTitle",
            bodyKey: "menu.showBody",
            confirmKey: "menu.showConfirm",
          }}
          whenTurningOff={{
            titleKey: "menu.hideTitle",
            bodyKey: "menu.hideBody",
            confirmKey: "menu.hideConfirm",
          }}
          className={cx(ROW_ABOVE, "w-[92px]")}
        />

        <ConfirmButton
          className={ROW_ABOVE}
          onConfirm={onArchive}
          titleKey="menu.archiveTitle"
          bodyKey="menu.archiveBody"
          confirmKey="menu.archiveConfirm"
          params={{ name: pickLocalized(item.name) }}
          variant="danger"
          triggerVariant="danger"
          size="sm"
        >
          {t("menu.archive")}
        </ConfirmButton>
      </div>

      <BranchItemStrip item={item} sectionId={item.sectionId} />
    </div>
  );
}

/**
 * The item's picture, or the space one would take.
 *
 * A click opens it full size. Forty-four points says *whether* there is a
 * photograph; it does not say whether it is the right dish, in focus, or the
 * right way up — and those are what somebody scanning a menu for a bad picture
 * is actually looking for.
 */
function Thumbnail({
  url,
  dim,
  name,
}: {
  url: string | null;
  dim: boolean;
  name: string;
}) {
  if (!url) {
    return <ImagePlaceholder className="size-[44px] rounded-md" />;
  }
  return (
    <PreviewImage
      src={url}
      name={name}
      className={cx("size-[44px] rounded-md", dim && "opacity-50 grayscale")}
    />
  );
}

/**
 * The size an item is sold in — "1 kg", "500 g" — or an empty string.
 *
 * A string rather than a component, because it sits inside a line that already
 * joins two other facts with a separator, and a component there would mean the
 * separator logic had to know whether the component rendered anything.
 */
function unitSize(item: MenuItem): string {
  const unit = itemUnit(item);
  if (!unit) return "";

  return t("units.size", {
    quantity: unit.quantity,
    unit: t(unitKey(unit.unit)),
  });
}

/**
 * What the item comes to per kilo, per litre, or per piece.
 *
 * ## Why it is worth the line
 *
 * A price on its own is not comparable between two items sold in different
 * sizes, and comparing them is the one thing a shelf is for. Quoting both
 * against the same canonical unit — see `lib/units.ts` — is what makes 500 g at
 * $6.00 and 1 kg at $12.00 legible as the same value.
 *
 * ## And why it is often nothing
 *
 * Absent for an item with no unit, which is most of them, and absent for a
 * single piece: "$12.00 per piece" beside "$12.00" is the same number twice.
 * `pricePerUnit` makes that call so no screen has to.
 */
function PerUnit({ item, code }: { item: MenuItem; code: string }) {
  const { format } = useMoney();

  const unit = itemUnit(item);
  const per = unit ? pricePerUnit(item.price, unit) : null;
  if (!per) return null;

  return (
    <span className="text-[11px] tabular-nums text-text-faint">
      {t("units.per", {
        amount: format(per.amount, code),
        unit: t(unitKey(per.unit)),
      })}
    </span>
  );
}
