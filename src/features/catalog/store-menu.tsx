"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { Toggle } from "@/components/ui/toggle";
import { Price } from "@/features/reference/price";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import { applyOrder, type MenuItem, type MenuSection } from "./api/menu";
import { MenuItemEditor } from "./menu-item-editor";
import {
  useArchiveMenuItem,
  useArchiveMenuSection,
  useCreateMenuItem,
  useCreateMenuSection,
  useMenu,
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

  /** Which section is being renamed, or `"new"` while one is being added. */
  const [editingSection, setEditingSection] = useState<string | null>(null);

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
      pick(sections.find((section) => section.id === id)?.title ?? {}),
    // Nothing to reorder while a title is being edited: the fields would be
    // moving under the cursor.
    disabled: editingSection !== null,
  });

  /**
   * What the panel is showing, if anything. `itemId: null` means adding.
   *
   * One at a time, which the panel enforces by construction where a set of
   * inline editors did not: two half-filled forms on one screen is a way to
   * lose work.
   */
  const [open, setOpen] = useState<{
    sectionId: string;
    itemId: string | null;
  } | null>(null);

  const openSection = menu.data?.find(
    (section) => section.id === open?.sectionId,
  );
  const editingItem =
    open?.itemId != null
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
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex shrink-0 flex-col gap-xs border-b border-border bg-surface px-xxl py-lg">
          <Link
            href="/catalogue"
            className="flex w-fit items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {t("menu.back")}
          </Link>
          <h1 className="text-[24px]">
            {store.data ? pick(store.data.name) : ""}
          </h1>
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
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

          {sectionOrder.instructions}

          {sectionOrder
            .ordered(sections, (section) => section.id)
            .map((section) => (
              <Section
                key={section.id}
                section={section}
                currencyCode={store.data?.currencyCode ?? ""}
                openItemId={open?.itemId ?? null}
                rowProps={sectionOrder.rowProps}
                handleProps={sectionOrder.handleProps}
                renaming={editingSection === section.id}
                onRename={() => setEditingSection(section.id)}
                onRenamed={(title) =>
                  renameSection.mutate(
                    { id: section.id, title },
                    { onSuccess: () => setEditingSection(null) },
                  )
                }
                onCancelRename={() => setEditingSection(null)}
                renamePending={renameSection.isPending}
                onArchiveSection={async () => {
                  await archiveSection.mutateAsync(section.id);
                }}
                onReorderItems={(ids) => reorderItems(section.id, ids)}
                onEdit={(itemId) => setOpen({ sectionId: section.id, itemId })}
                onAdd={() => setOpen({ sectionId: section.id, itemId: null })}
                onToggle={(item) =>
                  update.mutate({
                    id: item.id,
                    patch: { isActive: !item.isActive },
                  })
                }
                onArchive={async (item) => {
                  await archive.mutateAsync(item.id);
                }}
              />
            ))}

          {/* Adding a section is the bottom of the menu, because that is where
              a new one goes and where the eye already is after reading it. */}
          {menu.isSuccess &&
            (editingSection === "new" ? (
              <SectionForm
                pending={createSection.isPending}
                onSave={(title) =>
                  createSection.mutate(
                    { draft: { storeId, title }, sortOrder: sections.length },
                    { onSuccess: () => setEditingSection(null) },
                  )
                }
                onCancel={() => setEditingSection(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingSection("new")}
                className="flex w-fit items-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-soft hover:border-primary hover:text-primary"
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
                {t("menu.addSection")}
              </button>
            ))}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("menu.formLabel")}
      >
        {open && openSection && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <div className="flex flex-grow flex-col gap-xxs">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  {pick(openSection.title)}
                </span>
                <h2 className="text-[20px]">
                  {editingItem ? pick(editingItem.name) : t("menu.newItem")}
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

            <MenuItemEditor
              // Keyed, so switching from one item to another rebuilds the form
              // rather than leaving the previous item's text in the fields — the
              // state lives inside the editor, and React would otherwise reuse
              // it. The counter on a new item is what makes "add another" clear
              // the form.
              key={open.itemId ?? `new-${open.sectionId}-${create.submittedAt}`}
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
                        draft: { ...draft, storeId, sectionId: open.sectionId },
                        // At the end of the section it was added to. The column
                        // has no default, and "where does it go" is a question
                        // the caller can answer and the database cannot.
                        sortOrder: nextSortOrder(openSection),
                      })
              }
              onCancel={() => setOpen(null)}
            />
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
    style: React.CSSProperties | undefined;
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
  onRename,
  onRenamed,
  onCancelRename,
  renamePending,
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
  renaming: boolean;
  onRename: () => void;
  onRenamed: (title: Localized) => void;
  onCancelRename: () => void;
  renamePending: boolean;
  onArchiveSection: () => Promise<void>;
  onReorderItems: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onToggle: (item: MenuItem) => void;
  onArchive: (item: MenuItem) => Promise<void>;
} & ReorderProps) {
  const title = pick(section.title);

  const itemOrder = useReorder({
    ids: section.items.map((item) => item.id),
    onReorder: onReorderItems,
    labelOf: (id) =>
      pick(section.items.find((item) => item.id === id)?.name ?? {}),
  });

  const row = rowProps(section.id, "flex flex-col gap-sm");

  return (
    <section {...row}>
      {renaming ? (
        <SectionForm
          initial={section.title}
          pending={renamePending}
          onSave={onRenamed}
          onCancel={onCancelRename}
        />
      ) : (
        <div className="flex items-center gap-md">
          <button {...handleProps(section.id)}>
            <GripIcon />
          </button>

          <h2 className="text-[18px]">{title}</h2>
          <span className="text-[13px] text-text-faint">
            {t("menu.itemCount", { count: section.items.length })}
          </span>

          {/* Pushed to the far end, and quiet. These are the section's own
              controls and they should not compete with the items under it,
              which is what the operator is actually reading. */}
          <div className="ms-auto flex items-center gap-sm">
            <Button variant="quiet" size="sm" onClick={onRename}>
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
      )}

      {itemOrder.instructions}

      {section.items.length === 0 && !renaming && (
        <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
          {t("menu.sectionEmpty")}
        </p>
      )}

      {itemOrder
        .ordered(section.items, (item) => item.id)
        .map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            currencyCode={currencyCode}
            handleProps={itemOrder.handleProps}
            rowProps={itemOrder.rowProps}
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
  rowProps,
  handleProps,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  currencyCode: string;
  open: boolean;
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
          {pick(item.name)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {pick(item.description)}
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

      <Toggle
        on={item.isActive}
        onChange={onToggle}
        labelOn={t("menu.live")}
        labelOff={t("menu.hidden")}
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
function SectionForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Localized;
  pending: boolean;
  onSave: (title: Localized) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

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

  return (
    <div className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg">
      <LocalizedField
        label={t("menu.sectionTitle")}
        value={title}
        onChange={setTitle}
        maxLength={TEXT.title}
        hint={t("menu.sectionTitleHint")}
        error={error}
        placeholder={{ en: "Starters", ar: "المقبلات" }}
      />

      <div className="flex items-center gap-sm">
        {/* Cancel first, then save — the same order as the item editor, so the
            button in a given place always does the same thing. */}
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("menu.saveSection")}
        </Button>
      </div>
    </div>
  );
}

function nextSortOrder(section: MenuSection): number {
  return (
    section.items.reduce(
      (highest, item) => Math.max(highest, item.sortOrder),
      0,
    ) + 1
  );
}

function pick(value: Record<string, string>): string {
  for (const candidate of [value.en, ...Object.values(value)]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}
