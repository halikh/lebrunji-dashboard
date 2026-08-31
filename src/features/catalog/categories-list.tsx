"use client";

import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ROW } from "@/components/ui/row";
import {
  StickyAddBar,
  StickyAddTop,
  useStickyAdd,
} from "@/components/ui/sticky-add";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH, TEXT } from "@/lib/limits";
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
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering are different jobs on one list and cannot both be
   * on: a position among matches is not a position on the home screen, so
   * dragging while filtered would write a `sort_order` nobody chose. The
   * handles go away and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const categories = useCategories(searching ? search : "");
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const reorder = useReorderCategories();

  /**
   * The row the panel is editing, or `"new"` while one is being added.
   *
   * **Any action on a row closes it.** A form open beside the list holds a copy
   * of a row as it was when it opened; flipping a switch or archiving something
   * changes the list underneath it, and a form that stays open then is either
   * showing a row that no longer exists or is about to save values from before
   * the change. Closing is the honest answer: the operator has moved on to the
   * list, and nothing they typed is lost that they had not already abandoned by
   * reaching past the form to act on a row.
   */
  const [open, setOpen] = useState<string | null>(null);

  /**
   * The pinned "add" bar.
   *
   * Suppressed while searching — there is no list position for a new row to
   * join — and while the panel is open, where a second way to open it would be
   * a button that closes the form somebody is filling in.
   */
  const { attachTop, attachAddButton, showAddBar } = useStickyAdd(
    !searching && open === null,
  );

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
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="relative flex min-w-0 flex-grow flex-col">
        {/* The same bar the shops have — same border, same padding, same place
            for the box — so moving between the two tabs is not relearning
            where the search is. */}
        <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
          <h1 className="flex-grow text-[24px]">{t("categories.tab")}</h1>
          {searching && (
            <span className="text-[13px] text-text-faint">
              {t("categories.searchNoDrag")}
            </span>
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("categories.search")}
            aria-label={t("categories.search")}
            className="w-[260px]"
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          <StickyAddTop attach={attachTop} />

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
                onToggleActive={() => {
                  // The panel closes on any row action — see the note on
                  // `setOpen` above.
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onToggleFeatured={() => {
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isFeatured: !row.isFeatured },
                  });
                }}
                onArchive={async () => {
                  setOpen(null);
                  await archive.mutateAsync({ id: row.id, name: row.name });
                }}
              />
            ))}

          {searching && rows.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-lg py-xl text-center text-[14px] text-text-soft">
              {t("categories.searchNone", { term: search.trim() })}
            </p>
          )}

          {/* Where a new row actually goes: the end of the list. The pinned
              bar below is a shortcut to this one, and only exists while this
              one is out of sight. */}
          {categories.isSuccess && !searching && (
            <div ref={attachAddButton} className="mt-lg">
              <Button fullWidth onClick={() => setOpen("new")}>
                {t("categories.add")}
              </Button>
            </div>
          )}
        </div>

        {categories.isSuccess && (
          <StickyAddBar visible={showAddBar}>
            <Button fullWidth onClick={() => setOpen("new")}>
              {t("categories.add")}
            </Button>
          </StickyAddBar>
        )}
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
      ROW,
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

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col gap-xxs text-left"
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
        <ConfirmToggle
          on={category.isFeatured}
          onChange={onToggleFeatured}
          labelOn={t("categories.featured")}
          params={{ name: pickLocalized(category.name) }}
          whenTurningOn={{
            titleKey: "categories.featureTitle",
            bodyKey: "categories.featureBody",
            confirmKey: "categories.featureConfirm",
          }}
          whenTurningOff={{
            titleKey: "categories.unfeatureTitle",
            bodyKey: "categories.unfeatureBody",
            confirmKey: "categories.unfeatureConfirm",
          }}
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
