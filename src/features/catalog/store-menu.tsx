"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Toggle } from "@/components/ui/toggle";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";

import type { MenuItem, MenuSection } from "./api/menu";
import { MenuItemEditor, type ItemDraft } from "./menu-item-editor";
import {
  useArchiveMenuItem,
  useCreateMenuItem,
  useMenu,
  useUpdateMenuItem,
} from "./use-menu";
import { useStore } from "./use-stores";

/**
 * One shop's menu, edited in place.
 *
 * The highest-volume editing in the product, and the flow study's clearest
 * decision: an item is added as a row at the bottom of its section and edited
 * by opening that row, never by navigating to a page. "Save and add another"
 * keeps the operator where they are, which is the whole point — the second item
 * is added in the context of the first.
 */
export function StoreMenu({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const menu = useMenu(storeId);
  const create = useCreateMenuItem(storeId);
  const update = useUpdateMenuItem(storeId);
  const archive = useArchiveMenuItem(storeId);
  const { format } = useMoney();

  // Which row is open, if any. One at a time: two half-filled editors on one
  // screen is a way to lose work, and there is no reason to edit two items at
  // once.
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-xs border-b border-border bg-surface px-xxl py-lg">
        <Link
          href="/catalogue"
          className="flex items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
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

        {menu.data?.map((section) => (
          <Section
            key={section.id}
            section={section}
            format={format}
            // The shop's own currency. Menu prices are set in it, and a
            // hardcoded code here would print every price in the wrong money
            // for any shop that does not use that one.
            currencyCode={store.data?.currencyCode ?? ""}
            editing={editing}
            adding={adding === section.id}
            createPending={create.isPending}
            createError={
              create.error instanceof Error ? create.error.message : null
            }
            onEdit={setEditing}
            onAdd={() => {
              setEditing(null);
              setAdding(section.id);
            }}
            onCancel={() => {
              setEditing(null);
              setAdding(null);
            }}
            onCreate={(draft, another) => {
              create.mutate(
                {
                  draft: { ...draft, storeId, sectionId: section.id },
                  // At the end of the section it was added to. The database has
                  // no default for `sort_order`, and "where does it go" is a
                  // question the caller can answer and the column cannot.
                  sortOrder: nextSortOrder(section),
                },
                {
                  onSuccess: () => {
                    // Stay open for another, close otherwise. The whole reason
                    // the editor is a row: the second item is added in the
                    // context of the first.
                    if (!another) setAdding(null);
                  },
                },
              );
            }}
            onUpdate={(id, draft) => {
              update.mutate(
                { id, patch: draft },
                { onSuccess: () => setEditing(null) },
              );
            }}
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
      </div>
    </div>
  );
}

function Section({
  section,
  format,
  currencyCode,
  editing,
  adding,
  createPending,
  createError,
  onEdit,
  onAdd,
  onCancel,
  onCreate,
  onUpdate,
  onToggle,
  onArchive,
}: {
  section: MenuSection;
  format: (minorUnits: number, code: string) => string;
  currencyCode: string;
  editing: string | null;
  adding: boolean;
  createPending: boolean;
  createError: string | null;
  onEdit: (id: string | null) => void;
  onAdd: () => void;
  onCancel: () => void;
  onCreate: (draft: ItemDraft, another: boolean) => void;
  onUpdate: (id: string, draft: ItemDraft) => void;
  onToggle: (item: MenuItem) => void;
  onArchive: (item: MenuItem) => Promise<void>;
}) {
  const title = pick(section.title);

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex items-center gap-md">
        <h2 className="text-[18px]">{title}</h2>
        <span className="text-[13px] text-text-faint">
          {t("menu.itemCount", { count: section.items.length })}
        </span>
      </div>

      {section.items.map((item) =>
        editing === item.id ? (
          <MenuItemEditor
            key={item.id}
            initial={item}
            pending={false}
            onSave={(draft) => onUpdate(item.id, draft)}
            onCancel={onCancel}
          />
        ) : (
          <ItemRow
            key={item.id}
            item={item}
            format={format}
            currencyCode={currencyCode}
            onEdit={() => onEdit(item.id)}
            onToggle={() => onToggle(item)}
            onArchive={() => onArchive(item)}
          />
        ),
      )}

      {adding ? (
        <MenuItemEditor
          pending={createPending}
          error={createError}
          onSave={(draft) => onCreate(draft, false)}
          onSaveAndAnother={(draft) => onCreate(draft, true)}
          onCancel={onCancel}
        />
      ) : (
        // At the bottom of the section, not in a header. It is where the eye
        // already is after reading the list, and where the new row will appear.
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
      )}
    </section>
  );
}

function ItemRow({
  item,
  format,
  currencyCode,
  onEdit,
  onToggle,
  onArchive,
}: {
  item: MenuItem;
  format: (minorUnits: number, code: string) => string;
  currencyCode: string;
  onEdit: () => void;
  onToggle: () => void;
  onArchive: () => Promise<void>;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
        // Marked, not dimmed — fading the row takes the controls with it, and a
        // faded button reads as disabled.
        item.isActive
          ? "border-border"
          : "border-danger-wash bg-danger-wash/30",
      )}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden
          className="size-[44px] shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="size-[44px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      {/* The row opens the editor. A pencil icon would be a second target for
          the same intent, and the whole row is the bigger one. */}
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span className="truncate text-[15px] font-semibold">
          {pick(item.name)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {pick(item.description)}
        </span>
      </button>

      <span className="shrink-0 text-[15px] font-semibold tabular-nums">
        {/* The shop's own currency. Menu prices are set in it, and converting
            here would show a number nobody typed. */}
        {format(item.price, currencyCode)}
      </span>

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
