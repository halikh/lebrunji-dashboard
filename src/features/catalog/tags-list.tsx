"use client";

import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ROW } from "@/components/ui/row";
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
import { TAG_TONES, type Tag, type TagDraft, type TagTone } from "./api/tags";
import { TagChip } from "./tag-chip";
import {
  useArchiveTag,
  useCreateTag,
  useReorderTags,
  useTags,
  useUpdateTag,
} from "./use-tags";

/**
 * The tag vocabulary — the chips a dish can be given.
 *
 * ## Why the order is the most consequential control here
 *
 * `sort_order` decides the order a dish's chips read in, on **every** dish at
 * once. Not per dish: a tag's position is a property of the vocabulary, so
 * "Popular" precedes "Spicy" everywhere rather than on the dishes where
 * somebody happened to click it first. Dragging a row here changes the whole
 * menu, which is why the list is the screen and the form is a panel beside it.
 *
 * ## Retiring one is safe, and the count is what makes that clear
 *
 * Unlike a category, a tag can be retired while it is in use — nothing
 * references it from `menu_items`, so the only effect is chips disappearing.
 * The row carries "on 34 dishes" and the confirmation repeats it, because
 * "Archive Spicy" and "Archive Spicy, which is on 34 dishes" are different
 * questions and only the second one can be answered.
 *
 * The links survive the retirement, so switching a tag back on restores it to
 * every dish that had it rather than asking for thirty-four re-tags.
 */
export function TagsList() {
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering cannot both be on: a position among matches is not
   * a position in the vocabulary, so dragging while filtered would write a
   * `sort_order` nobody chose. The handles go away and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const tags = useTags(searching ? search : "");
  const create = useCreateTag();
  const update = useUpdateTag();
  const archive = useArchiveTag();
  const reorder = useReorderTags();

  /**
   * The row the panel is editing, or `"new"` while one is being added.
   *
   * Any action on a row closes it — the rule every list here follows. A form
   * open beside the list holds a copy of a row as it was when it opened, so one
   * left open after a switch is flipped is either showing a row that has
   * changed or is about to save values from before it.
   */
  const [open, setOpen] = useState<string | null>(null);

  const rows = tags.data ?? [];
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
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The same bar as the shops and the categories — same border, same
            padding, same place for the box — so moving between tabs is not
            relearning where the search is. */}
        <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
          <h1 className="flex-grow text-[24px]">{t("tags.tab")}</h1>
          {searching && (
            <span className="text-[13px] text-text-faint">
              {t("tags.searchNoDrag")}
            </span>
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("tags.search")}
            aria-label={t("tags.search")}
            className="w-[260px]"
          />
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {/* What the list is for, said once at the top. A vocabulary screen
              with no explanation reads as a settings table; the sentence is
              what makes "Popular" here and a chip on a phone the same thing. */}
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("tags.blurb")}
          </p>

          {tags.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="h-[58px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {tags.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <h2 className="text-[18px]">{t("tags.failedTitle")}</h2>
              <Button variant="secondary" onClick={() => void tags.refetch()}>
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
                tag={row}
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onToggleActive={() => {
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
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
              {t("tags.searchNone", { term: search.trim() })}
            </p>
          )}

          {tags.isSuccess && !searching && (
            <Button fullWidth className="mt-lg" onClick={() => setOpen("new")}>
              {t("tags.add")}
            </Button>
          )}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("tags.formLabel")}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <h2 className="flex-grow text-[20px]">
                {editing ? pickLocalized(editing.name) : t("tags.add")}
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
  tag,
  open,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  tag: Tag;
  open: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const name = pickLocalized(tag.name);

  const row = rowProps(
    tag.id,
    cx(
      ROW,
      // Marked, not dimmed — fading a row takes its controls with it, and a
      // faded button reads as a disabled one.
      !tag.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      tag.isActive && !open && "border-border",
      tag.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row}>
      <button {...handleProps(tag.id)}>
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow items-center gap-md text-left"
      >
        {/* The chip itself, at the size a phone draws it. The row shows the
            thing rather than describing it — a tone named in words would ask
            the operator to picture the result of their own setting. */}
        <TagChip label={name} tone={tag.tone} />

        <span className="truncate text-[12px] text-text-faint">
          {tag.usedBy === 0
            ? t("tags.unused")
            : t("tags.usedBy", { count: tag.usedBy })}
        </span>
      </button>

      <ConfirmToggle
        on={tag.isActive}
        onChange={onToggleActive}
        labelOn={t("tags.live")}
        labelOff={t("tags.hidden")}
        params={{ name, count: tag.usedBy }}
        whenTurningOn={{
          titleKey: "tags.showTitle",
          bodyKey: "tags.showBody",
          confirmKey: "tags.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "tags.hideTitle",
          bodyKey: "tags.hideBody",
          confirmKey: "tags.hideConfirm",
        }}
        className="w-[104px]"
      />

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="tags.archiveTitle"
        bodyKey="tags.archiveBody"
        confirmKey="tags.archiveConfirm"
        params={{ name, count: tag.usedBy }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("tags.archive")}
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
  initial?: Tag;
  pending: boolean;
  onSave: (draft: TagDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [tone, setTone] = useState<TagTone>(initial?.tone ?? "neutral");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [errors, setErrors] = useState<{ name?: string }>({});

  /**
   * The chip the operator is building, drawn as they type.
   *
   * The point of a preview is that the two decisions on this form — what it
   * says and what colour it is — only mean anything together. A tone picked
   * against a name in another field is a guess, and the result is not seen
   * until it is on a dish, in the app, on a phone.
   */
  const previewLabel = pickLocalized(name) || t("tags.previewPlaceholder");

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.tag);
    const found = { name: check.ok ? undefined : t(check.key, check.params) };

    setErrors(found);
    if (found.name) return;

    onSave({ name, tone, isActive });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <LocalizedField
          label={t("tags.name")}
          value={name}
          onChange={setName}
          maxLength={TEXT.tag}
          error={errors.name}
          hint={t("tags.nameHint")}
          placeholder={{ en: "Spicy", ar: "حار" }}
        />

        <Field label={t("tags.toneLabel")} hint={t("tags.toneHint")}>
          <Select
            value={tone}
            onChange={(next) => setTone(next as TagTone)}
            options={TAG_TONES.map((option) => ({
              value: option,
              // The label is what the control filters on and what a screen
              // reader says; `render` is what the eye gets. Both are needed —
              // an option recognisable only by sight cannot be typed for.
              label: t(`tags.tones.${option}`),
              render: <TagChip tone={option} label={previewLabel} />,
            }))}
          />
        </Field>

        <Field
          label={t("tags.visibility")}
          hint={isActive ? t("tags.liveHint") : t("tags.hiddenHint")}
        >
          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("tags.live")}
            labelOff={t("tags.hidden")}
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("tags.save")}
        </Button>
      </div>
    </div>
  );
}
