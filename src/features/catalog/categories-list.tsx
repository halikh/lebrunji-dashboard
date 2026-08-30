"use client";

import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import { applyOrder } from "./api/menu";
import type { Category, CategoryDraft } from "./api/categories";
import {
  useArchiveCategory,
  useCategories,
  useCategoryKinds,
  useCreateCategory,
  useReorderCategories,
  useUpdateCategory,
} from "./use-categories";

/**
 * The tiles on the app's home screen.
 *
 * ## Why the order matters more than anything else here
 *
 * A category is what a customer picks before they pick a shop, and the app
 * orders by `sort_order` — as the primary order when browsing, and as the
 * tiebreak everywhere else. So dragging a row is not decoration: it is the one
 * control on this screen that decides what a customer sees first.
 *
 * That is why the list is the screen and the form is a panel beside it, rather
 * than the other way round.
 *
 * ## The form opens beside the list, as it does for a menu item
 *
 * The flow study called for editing inline, in the row. A category carries two
 * languages of name, two of tagline, a picture, a kind and three switches, and
 * growing a row to fit that reflows every row beneath it — the same reason the
 * menu item editor moved out of the row. The panel keeps what mattered about
 * the inline idea, which was never editing *within* the row: it was not losing
 * your place in the list.
 */
export function CategoriesList() {
  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const reorder = useReorderCategories();

  /** The row the panel is editing, or `"new"` while one is being added. */
  const [open, setOpen] = useState<string | null>(null);

  const rows = categories.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { next, updates } = applyOrder(rows, ids);
      reorder.mutate({ updates, next });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {categories.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="h-[66px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {categories.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <h2 className="text-[18px]">{t("categories.failedTitle")}</h2>
              <Button
                variant="secondary"
                onClick={() => void categories.refetch()}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          {order.instructions}

          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                category={row}
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onToggleActive={() =>
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  })
                }
                onToggleFeatured={() =>
                  update.mutate({
                    id: row.id,
                    patch: { isFeatured: !row.isFeatured },
                  })
                }
                onArchive={async () => {
                  await archive.mutateAsync({ id: row.id, name: row.name });
                }}
              />
            ))}

          {categories.isSuccess && (
            <Button fullWidth className="mt-lg" onClick={() => setOpen("new")}>
              {t("categories.add")}
            </Button>
          )}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("categories.formLabel")}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <h2 className="flex-grow text-[20px]">
                {editing ? pickLocalized(editing.name) : t("categories.add")}
              </h2>
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

            <Editor
              key={open}
              initial={editing ?? undefined}
              pending={create.isPending || update.isPending}
              onSave={(draft) => {
                if (editing) {
                  update.mutate(
                    { id: editing.id, patch: draft, name: draft.name },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    { draft, sortOrder: rows.length },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
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
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function Row({
  category,
  open,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onToggleFeatured,
  onArchive,
}: {
  category: Category;
  open: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const row = rowProps(
    category.id,
    cx(
      "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
      // Marked, not dimmed — fading a row takes its controls with it, and a
      // faded button reads as a disabled one.
      !category.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      category.isActive && !open && "border-border",
      category.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row}>
      <button {...handleProps(category.id)}>
        <GripIcon />
      </button>

      {category.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={category.imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "size-[44px] shrink-0 rounded-md object-cover",
            !category.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="size-[44px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span className="truncate text-[15px] font-semibold">
          {pickLocalized(category.name)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {pickLocalized(category.tagline)}
        </span>
      </button>

      {/* Under each other, so a row stays one line high whatever the labels
          say — the same arrangement the shop list uses. */}
      <div className="flex shrink-0 flex-col gap-xs">
        <ConfirmToggle
          on={category.isActive}
          onChange={onToggleActive}
          labelOn={t("categories.live")}
          labelOff={t("categories.hidden")}
          params={{ name: pickLocalized(category.name) }}
          whenTurningOn={{
            titleKey: "categories.showTitle",
            bodyKey: "categories.showBody",
            confirmKey: "categories.showConfirm",
          }}
          whenTurningOff={{
            titleKey: "categories.hideTitle",
            bodyKey: "categories.hideBody",
            confirmKey: "categories.hideConfirm",
          }}
          className="w-[104px]"
        />
        <Toggle
          on={category.isFeatured}
          onChange={onToggleFeatured}
          labelOn={t("categories.featured")}
          className="w-[104px]"
        />
      </div>

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="categories.archiveTitle"
        bodyKey="categories.archiveBody"
        confirmKey="categories.archiveConfirm"
        params={{ name: pickLocalized(category.name) }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("categories.archive")}
      </ConfirmButton>
    </div>
  );
}

function Editor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Category;
  pending: boolean;
  onSave: (draft: CategoryDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const kinds = useCategoryKinds();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [tagline, setTagline] = useState<Localized>(initial?.tagline ?? {});
  const [kindId, setKindId] = useState(initial?.kindId ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [hasMenuNav, setHasMenuNav] = useState(initial?.hasMenuNav ?? true);

  const [errors, setErrors] = useState<{ name?: string; kind?: string }>({});

  function submit() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // `category_kind_id` is `not null` with no default, so an empty one is a
      // refusal from Postgres rather than a message about the field it came
      // from. Caught here so it reads as a form.
      kind: kindId ? undefined : t("categories.kindRequired"),
    };

    setErrors(found);
    if (found.name || found.kind) return;

    onSave({
      name,
      tagline,
      kindId,
      imageUrl,
      isActive,
      isFeatured,
      hasMenuNav,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <LocalizedField
          label={t("categories.name")}
          value={name}
          onChange={setName}
          maxLength={TEXT.name}
          error={errors.name}
          placeholder={{ en: "Restaurants", ar: "مطاعم" }}
        />

        <LocalizedField
          label={t("categories.tagline")}
          value={tagline}
          onChange={setTagline}
          maxLength={TEXT.tagline}
          hint={t("categories.taglineHint")}
          optional
          placeholder={{ en: "Grills, mezze and more", ar: "مشاوي ومازة" }}
        />

        <Field
          label={t("categories.kind")}
          hint={t("categories.kindHint")}
          error={errors.kind}
        >
          <Select
            value={kindId}
            onChange={setKindId}
            placeholder={t("categories.pickKind")}
            options={(kinds.data ?? []).map((kind) => ({
              value: kind.id,
              label: pickLocalized(kind.name),
            }))}
          />
        </Field>

        <Field label={t("images.label")} hint={t("categories.imageHint")}>
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            folder="categories"
            disabled={pending}
          />
        </Field>

        <Field
          label={t("categories.visibility")}
          hint={
            isActive ? t("categories.liveHint") : t("categories.hiddenHint")
          }
        >
          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("categories.live")}
            labelOff={t("categories.hidden")}
          />
        </Field>

        <Field
          label={t("categories.featuredLabel")}
          hint={t("categories.featuredHint")}
        >
          <Toggle
            on={isFeatured}
            onChange={() => setIsFeatured((current) => !current)}
            labelOn={t("categories.featured")}
          />
        </Field>

        <Field
          label={t("categories.menuNav")}
          hint={t("categories.menuNavHint")}
        >
          <Toggle
            on={hasMenuNav}
            onChange={() => setHasMenuNav((current) => !current)}
            labelOn={t("categories.menuNavOn")}
            labelOff={t("categories.menuNavOff")}
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("categories.save")}
        </Button>
      </div>
    </div>
  );
}
