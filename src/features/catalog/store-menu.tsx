"use client";

import { useId, useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { useOnScreen } from "@/components/ui/on-screen";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useRevealOnMount } from "@/components/ui/reveal";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Price } from "@/features/reference/price";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH, TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import { applyOrder, type MenuItem, type MenuSection } from "./api/menu";
import { MenuItemEditor } from "./menu-item-editor";
import {
  useArchiveMenuItem,
  useArchiveMenuSection,
  useCreateMenuItem,
  useCreateMenuSection,
  useMenu,
  useMenuSearch,
  useReorderMenu,
  useUpdateMenuItem,
  useUpdateMenuSection,
} from "./use-menu";
import { useLanguages } from "@/features/reference/use-languages";
import { useStore } from "./use-stores";

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
 * What the side panel is editing.
 *
 * A null id means adding rather than editing, in both cases.
 */
type PanelTarget =
  | { kind: "item"; sectionId: string; itemId: string | null }
  /** Renaming only. Adding one is inline at the bottom of the list. */
  | { kind: "section"; sectionId: string };

export function StoreMenu({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const menu = useMenu(storeId);
  const create = useCreateMenuItem(storeId);
  const update = useUpdateMenuItem(storeId);
  const archive = useArchiveMenuItem(storeId);

  const createSection = useCreateMenuSection(storeId);
  const renameSection = useUpdateMenuSection(storeId);
  const archiveSection = useArchiveMenuSection(storeId);
  const reorder = useReorderMenu(storeId);

  const sections = menu.data ?? [];

  function reorderSections(ids: string[]) {
    const { next, updates } = applyOrder(sections, ids);
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
    ids: sections.map((section) => section.id),
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

  /**
   * What the panel is showing, if anything.
   *
   * **One piece of state for both kinds of edit**, and one panel. A section's
   * name and an item's details are different forms, but "something is being
   * edited beside the list" is one condition — two states for it would allow
   * two open at once, and two half-filled forms on one screen is a way to lose
   * work.
   *
   * A null id means adding rather than editing, in both cases.
   */
  const [open, setOpen] = useState<PanelTarget | null>(null);

  /**
   * Adding a section, which stays inline while renaming one does not.
   *
   * Not an inconsistency. Renaming is an edit to a thing already in the list,
   * and it opens beside it the way editing an item does. Adding is the end of
   * the list growing by one, in the place the new section will be — and the
   * form is where the button was, so nothing has to move to make room.
   */
  const [adding, setAdding] = useState(false);

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
  const [addButtonRef, addButtonOnScreen] = useOnScreen<HTMLDivElement>();
  /**
   * A marker at the very top of the list, watched to tell whether the operator
   * has scrolled at all.
   *
   * Two conditions decide the pinned bar, and each removes a different kind of
   * clutter. It stays away **at the top**, where the menu is being read rather
   * than built and a floating bar is a strip of chrome over the first section.
   * And it stays away **at the bottom**, where the real button is already in
   * view — the two are never on screen together.
   *
   * Sentinels rather than a scroll listener: the question is only ever "can
   * this be seen", which is what an `IntersectionObserver` answers without
   * running anything on every frame of a scroll.
   */
  const [topRef, atTop] = useOnScreen<HTMLDivElement>();
  const matches = useMenuSearch(storeId, search);

  const openSection =
    open?.kind === "item" || open?.sectionId
      ? menu.data?.find((section) => section.id === open.sectionId)
      : undefined;

  const editingItem =
    open?.kind === "item" && open.itemId !== null
      ? menu.data
          ?.flatMap((section) => section.items)
          .find((item) => item.id === open.itemId)
      : undefined;

  const pending = create.isPending || update.isPending;
  const error =
    create.error instanceof Error
      ? create.error.message
      : update.error instanceof Error
        ? update.error.message
        : null;

  return (
    // The shop's name and its tabs belong to `StoreScreen`, which draws them
    // once for both panes. This is the menu itself and the panel beside it.
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The hint sits under the box, not beside it — where a field's helper
            always goes, so it reads as belonging to the input rather than as a
            note that happens to be next to it.

            It stays while a search is running, too. Hiding it then would move
            the list up by a line on the first keystroke, and the sentence is
            most worth reading at exactly the moment somebody has searched and
            found less than they expected. */}
        <div className="flex shrink-0 flex-col gap-xs px-xxl pt-lg">
          <div className="flex items-center gap-lg">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("menu.search")}
              aria-label={t("menu.search")}
              aria-describedby={searchHintId}
              className="w-[280px]"
            />
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

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
          <div ref={topRef} aria-hidden className="h-px shrink-0" />
          {menu.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="h-[66px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {menu.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <div className="flex flex-col gap-xs">
                <h2 className="text-[18px]">{t("menu.failedTitle")}</h2>
                <p className="text-[14px] text-text-soft">
                  {t("menu.failedBody")}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void menu.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {menu.isSuccess && menu.data.length === 0 && (
            <EmptyState titleKey="menu.emptyTitle" bodyKey="menu.emptyBody" />
          )}

          {searching ? (
            <div className="flex flex-col gap-sm">
              {matches.data?.sections.length === 0 &&
                matches.data.items.length === 0 &&
                !matches.isFetching && (
                  <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[14px] text-text-soft">
                    {t("menu.searchNone", { term: search.trim() })}
                  </p>
                )}

              {/* Sections first. A heading matching the term is the broader
                  answer — "you meant this part of the menu" — and burying it
                  under the dishes would make the operator scroll past what
                  they were looking for. */}
              {matches.data?.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() =>
                    setOpen({ kind: "section", sectionId: section.id })
                  }
                  className="flex items-center gap-md rounded-md border border-border bg-surface px-lg py-md text-left"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                    {t("menu.sectionLabel")}
                  </span>
                  <span className="text-[16px] font-semibold">
                    {pickLocalized(section.title)}
                  </span>
                  <span className="text-[13px] text-text-faint">
                    {t("menu.itemCount", { count: section.itemCount })}
                  </span>
                  <span className="ms-auto text-[13px] font-semibold text-primary">
                    {t("menu.renameSection")}
                  </span>
                </button>
              ))}

              {matches.data?.items.map((item) => (
                <SearchResult
                  key={item.id}
                  item={item}
                  currencyCode={store.data?.currencyCode ?? ""}
                  sectionTitle={pickLocalized(
                    sections.find((one) => one.id === item.sectionId)?.title ??
                      {},
                  )}
                  open={open?.kind === "item" && open.itemId === item.id}
                  onEdit={() =>
                    setOpen({
                      kind: "item",
                      sectionId: item.sectionId,
                      itemId: item.id,
                    })
                  }
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
              .ordered(sections, (section) => section.id)
              .map((section) => (
                <Section
                  key={section.id}
                  section={section}
                  currencyCode={store.data?.currencyCode ?? ""}
                  openItemId={open?.kind === "item" ? open.itemId : null}
                  renaming={
                    open?.kind === "section" && open.sectionId === section.id
                  }
                  carried={sectionOrder.movingId === section.id}
                  rowProps={sectionOrder.rowProps}
                  handleProps={sectionOrder.handleProps}
                  onRename={() =>
                    setOpen({ kind: "section", sectionId: section.id })
                  }
                  onArchiveSection={async () => {
                    await archiveSection.mutateAsync({
                      id: section.id,
                      name: section.title,
                    });
                  }}
                  onReorderItems={(ids) => reorderItems(section.id, ids)}
                  onEdit={(itemId) =>
                    setOpen({ kind: "item", sectionId: section.id, itemId })
                  }
                  onAdd={() =>
                    setOpen({
                      kind: "item",
                      sectionId: section.id,
                      itemId: null,
                    })
                  }
                  onToggle={(item) =>
                    update.mutate({
                      id: item.id,
                      patch: { isActive: !item.isActive },
                    })
                  }
                  onArchive={async (item) => {
                    await archive.mutateAsync({ id: item.id, name: item.name });
                  }}
                />
              ))}

          {/* Adding a section is the bottom of the menu, because that is where
              a new one goes and where the eye already is after reading it.
              Full width, like the "add an item" button inside each section: a
              row of controls that all mean "add something here" should not be
              three different widths. */}
          {/* The form appears where the new section will, at the end of the
              list — and scrolls itself into view, because on a long menu it
              opens below the fold. The button that opens it is pinned below. */}
          {!searching && menu.isSuccess && adding && (
            <SectionForm
              pending={createSection.isPending}
              onSave={(title) =>
                createSection.mutate(
                  {
                    draft: { storeId, title },
                    // At the end. The column has no default, and where a new
                    // section goes is a question the caller can answer and the
                    // database cannot.
                    sortOrder: sections.length,
                  },
                  { onSuccess: () => setAdding(false) },
                )
              }
              onCancel={() => setAdding(false)}
            />
          )}

          {/* Where a new section actually goes: the end of the list. This is
              the real button; the pinned one below is a shortcut to it that
              only exists while this one is out of sight. */}
          {!searching && menu.isSuccess && !adding && (
            <div ref={addButtonRef}>
              <Button fullWidth onClick={() => setAdding(true)}>
                {t("menu.addSection")}
              </Button>
            </div>
          )}
        </div>

        {/* The same action, within reach.
            A menu runs to several screens, and scrolling to the bottom to add a
            section is a cost paid over and over on the day a shop is set up —
            which is exactly when it is used most. It appears only when the real
            button has scrolled out of view, so a short menu never grows a bar
            it does not need and the two are never on screen together.

            Hidden while searching, because there is no menu on screen for a new
            section to join. */}
        {!searching &&
          menu.isSuccess &&
          !adding &&
          !atTop &&
          !addButtonOnScreen && (
            <div className="flex shrink-0 items-center border-t border-border bg-surface p-lg">
              <Button fullWidth onClick={() => setAdding(true)}>
                {t("menu.addSection")}
              </Button>
            </div>
          )}
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("menu.formLabel")}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <div className="flex flex-grow flex-col gap-xxs">
                {/* The overline says where in the menu this lands. On a section
                    it says what is being edited *is* a section, which the title
                    below cannot — "Cold mezze" alone reads as an item. */}
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  {open.kind === "section"
                    ? t("menu.sections")
                    : pickLocalized(openSection?.title ?? {})}
                </span>
                <h2 className="text-[20px]">
                  {open.kind === "section"
                    ? openSection
                      ? pickLocalized(openSection.title)
                      : t("menu.addSection")
                    : editingItem
                      ? pickLocalized(editingItem.name)
                      : t("menu.newItem")}
                </h2>
              </div>
              {/* The same close the receipt has. Escape and Cancel both work,
                  but a visible affordance is what people look for first. */}
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label={t("common.close")}
                className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft hover:bg-neutral-fill lg:flex"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {open.kind === "section" ? (
              <SectionForm
                // Keyed on the section, so opening a different one rebuilds
                // the form rather than leaving the previous name in the field.
                key={open.sectionId}
                variant="panel"
                initial={openSection?.title}
                pending={renameSection.isPending}
                onSave={(title) =>
                  renameSection.mutate(
                    { id: open.sectionId, title },
                    { onSuccess: () => setOpen(null) },
                  )
                }
                onCancel={() => setOpen(null)}
              />
            ) : (
              <MenuItemEditor
                // Keyed, so switching from one item to another rebuilds the form
                // rather than leaving the previous item's text in the fields — the
                // state lives inside the editor, and React would otherwise reuse
                // it. The counter on a new item is what makes "add another" clear
                // the form.
                key={
                  open.itemId ?? `new-${open.sectionId}-${create.submittedAt}`
                }
                initial={editingItem}
                pending={pending}
                error={error}
                onSave={(draft) => {
                  if (open.itemId) {
                    update.mutate(
                      { id: open.itemId, patch: draft },
                      { onSuccess: () => setOpen(null) },
                    );
                  } else {
                    create.mutate(
                      {
                        draft: { ...draft, storeId, sectionId: open.sectionId },
                        sortOrder: nextSortOrder(openSection),
                      },
                      { onSuccess: () => setOpen(null) },
                    );
                  }
                }}
                onSaveAndAnother={
                  // Only while adding. "Add another" means nothing when editing
                  // something that already exists.
                  open.itemId
                    ? undefined
                    : (draft) =>
                        create.mutate({
                          draft: {
                            ...draft,
                            storeId,
                            sectionId: open.sectionId,
                          },
                          // At the end of the section it was added to. The column
                          // has no default, and "where does it go" is a question
                          // the caller can answer and the database cannot.
                          sortOrder: nextSortOrder(openSection),
                        })
                }
                onCancel={() => setOpen(null)}
              />
            )}
          </>
        )}
      </Panel>
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

function Section({
  section,
  currencyCode,
  openItemId,
  rowProps,
  handleProps,
  renaming,
  carried,
  onRename,
  onArchiveSection,
  onReorderItems,
  onEdit,
  onAdd,
  onToggle,
  onArchive,
}: {
  section: MenuSection;
  currencyCode: string;
  openItemId: string | null;
  /** The panel is showing this section's name — the heading is marked, not
   *  replaced. */
  renaming: boolean;
  /** Being dragged, so it shows as its heading alone. */
  carried: boolean;
  onRename: () => void;
  onArchiveSection: () => Promise<void>;
  onReorderItems: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onToggle: (item: MenuItem) => void;
  onArchive: (item: MenuItem) => Promise<void>;
} & ReorderProps) {
  const title = pickLocalized(section.title);

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

  const row = rowProps(
    section.id,
    cx("flex flex-col gap-sm", carried && "px-md py-sm"),
  );

  return (
    <section {...row}>
      <div className="flex items-center gap-md">
        <button {...handleProps(section.id)}>
          <GripIcon />
        </button>

        {/* Marked while the panel is renaming it, so the form and the list
            agree about what is being edited — the same mark an item row gets. */}
        <h2 className={cx("text-[18px]", renaming && "text-active")}>
          {title}
        </h2>
        <span className="text-[13px] text-text-faint">
          {t("menu.itemCount", { count: section.items.length })}
        </span>

        {/* Pushed to the far end. These are the section's own controls and
            should not compete with the items under it, which is what the
            operator is actually reading.

            Hidden while the section is being carried: they are things to press,
            and nothing in a block travelling under the cursor is pressable. */}
        <div
          className={cx(
            "ms-auto flex items-center gap-sm",
            carried && "hidden",
          )}
        >
          {/* Blue on a blue tint, beside a filled red Archive.
              It needs a ground of its own — two controls together where only
              one has a surface read as one button and one label — and the
              palette says which ground: **blue is what you act on**. A neutral
              fill made it look like a label with a box round it, and coral is
              reserved for the one primary move on a screen. */}
          <Button variant="primary-quiet" size="sm" onClick={onRename}>
            {t("menu.renameSection")}
          </Button>
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

      {itemOrder.instructions}

      {section.items.length === 0 && !carried && (
        <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
          {t("menu.sectionEmpty")}
        </p>
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
          moment `useReorder` re-measures on purpose. */}
      {!carried &&
        itemOrder
          .ordered(section.items, (item) => item.id)
          .map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              currencyCode={currencyCode}
              handleProps={itemOrder.handleProps}
              rowProps={itemOrder.rowProps}
              carried={itemOrder.movingId === item.id}
              // The row the panel is showing is marked, so the form and the list
              // agree about what is being edited.
              open={openItemId === item.id}
              onEdit={() => onEdit(item.id)}
              onToggle={() => onToggle(item)}
              onArchive={() => onArchive(item)}
            />
          ))}

      {/* At the bottom of the section, not in a header. It is where the eye
          already is after reading the list. */}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-faint hover:bg-neutral-fill hover:text-text-soft"
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
    </section>
  );
}

function ItemRow({
  item,
  currencyCode,
  open,
  carried,
  rowProps,
  handleProps,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  currencyCode: string;
  open: boolean;
  /** Being dragged, so it sheds everything that is not identity. */
  carried: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const row = rowProps(
    item.id,
    cx(
      "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
      // Marked, not dimmed — fading a row takes its controls with it, and a
      // faded button reads as a disabled one.
      !item.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      item.isActive && !open && "border-border",
      item.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row}>
      <button {...handleProps(item.id)}>
        <GripIcon />
      </button>

      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "size-[44px] shrink-0 rounded-md object-cover",
            !item.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="size-[44px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      {/* The row opens the form. A pencil icon would be a second target for the
          same intent, and the whole row is the bigger one. */}
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span
          className={cx(
            "truncate text-[15px] font-semibold",
            !item.isActive && "text-text-soft",
          )}
        >
          {pickLocalized(item.name)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {pickLocalized(item.description)}
        </span>
      </button>

      {/* Set in the shop's own currency, shown in both: the price the merchant
          typed on top, what a customer thinking in the other one would hear
          underneath. */}
      <div className="shrink-0">
        <Price
          value={item.price}
          code={currencyCode}
          align="end"
          className="text-[15px] font-semibold"
        />
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
            className="w-[92px]"
          />

          <ConfirmButton
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
 * Two placements, one form:
 *
 * - **In the panel**, when renaming — beside the section it is renaming, the
 *   same way an item's details open beside the list. It wears the panel's own
 *   layout there: no card of its own, and the buttons in a footer at the
 *   bottom, because a bordered box inside a bordered panel is a frame around a
 *   frame.
 * - **Inline at the bottom**, when adding — in the place the new section will
 *   appear, where the button was, so nothing has to move to make room. There it
 *   needs its own edges, because it is sitting among the sections rather than
 *   in a space of its own.
 *
 * One component either way. Two would drift, and the way they would drift is
 * that one grows a field the other does not.
 *
 * No slug field, in either: the trigger from migration 0071 derives one from
 * the English title and makes it unique within the shop.
 */
function SectionForm({
  initial,
  pending,
  variant = "inline",
  onSave,
  onCancel,
}: {
  initial?: Localized;
  pending: boolean;
  variant?: "inline" | "panel";
  onSave: (title: Localized) => void;
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

  const [title, setTitle] = useState<Localized>(initial ?? {});
  const [error, setError] = useState<string | undefined>(undefined);

  function submit() {
    const result = validateLocalizedText(title, codes, TEXT.title);
    if (!result.ok) {
      setError(t(result.key, result.params));
      return;
    }
    setError(undefined);
    onSave(title);
  }

  const field = (
    <LocalizedField
      label={t("menu.sectionTitle")}
      value={title}
      onChange={setTitle}
      maxLength={TEXT.title}
      hint={t("menu.sectionTitleHint")}
      error={error}
      placeholder={{ en: "Starters", ar: "المقبلات" }}
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

  if (variant === "panel") {
    return (
      // `flex-1 min-h-0` rather than `h-full`, for the reason the item editor
      // records: there is a header above this in the same column, and `h-full`
      // asks for the panel's whole height in addition to it — which pushes the
      // buttons out of the bottom.
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
          {field}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
          {buttons}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      {field}
      <div className="flex items-center gap-sm">{buttons}</div>
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
  sectionTitle,
  open,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  currencyCode: string;
  sectionTitle: string;
  open: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => Promise<void>;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
        !item.isActive && "border-danger-wash bg-danger-wash/30",
        open &&
          "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
        item.isActive && !open && "border-border",
        item.isActive && open && "border-active",
      )}
    >
      <Thumbnail url={item.imageUrl} dim={!item.isActive} />

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span
          className={cx(
            "truncate text-[15px] font-semibold",
            !item.isActive && "text-text-soft",
          )}
        >
          {pickLocalized(item.name)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {sectionTitle}
        </span>
      </button>

      <div className="shrink-0">
        <Price
          value={item.price}
          code={currencyCode}
          align="end"
          className="text-[15px] font-semibold"
        />
      </div>

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
        className="w-[92px]"
      />

      <ConfirmButton
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
  );
}

/** The item's picture, or the space one would take. */
function Thumbnail({ url, dim }: { url: string | null; dim: boolean }) {
  if (!url) {
    return (
      <div
        aria-hidden
        className="size-[44px] shrink-0 rounded-md bg-neutral-fill"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      className={cx(
        "size-[44px] shrink-0 rounded-md object-cover",
        dim && "opacity-50 grayscale",
      )}
    />
  );
}
