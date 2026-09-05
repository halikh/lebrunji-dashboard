"use client";

import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ListHeader } from "@/components/ui/list-header";
import { ROW } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { PanelHeader } from "@/components/ui/panel-header";
import { Toggle } from "@/components/ui/toggle";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import {
  CONTRAST_FLOOR,
  INK_HEX,
  bestInk,
  contrastRatio,
} from "@/lib/contrast";
import { hasEmoji } from "@/lib/text-format";
import { t } from "@/i18n/translations";
import { SEARCH, TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import {
  TAG_INKS,
  TAG_TONES,
  type Tag,
  type TagDraft,
  type TagInk,
  type TagTone,
} from "./api/tags";
import { TONE_HEX, TagChip, groundOf, inkFor } from "./tag-chip";
import { useArchiveTag, useCreateTag, useTags, useUpdateTag } from "./use-tags";

/**
 * The tag vocabulary — the chips a dish can be given.
 *
 * ## Why there is no ordering here
 *
 * There used to be: rows were dragged, and a tag's position was a property of
 * the vocabulary rather than of a dish. It was removed because the result was
 * never visible. The app shows two or three chips on one dish, never the
 * vocabulary end to end, so an operator arranging fifty tags was doing careful
 * work whose only effect was which of two chips came first.
 *
 * Newest first instead. The reason to open this screen is almost always a tag
 * just added — to check it, rename it, fix its tone — so the row wanted is the
 * one at the top rather than one to be found. See `fetchTags`.
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
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const tags = useTags(searching ? search : "");
  const create = useCreateTag();
  const update = useUpdateTag();
  const archive = useArchiveTag();

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

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The action is repeated here and at the end of the list: the end is
            where a new row appears, and the bar is how it stays reachable while
            the end is out of sight. */}
        <ListHeader
          title={t("tags.tab")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("tags.search"),
          }}
          action={
            <Button onClick={() => setOpen("new")}>{t("tags.add")}</Button>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
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

          {rows.map((row) => (
            <Row
              key={row.id}
              tag={row}
              open={open === row.id}
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
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("tags.formLabel")}
      >
        {open && (
          <>
            <PanelHeader
              title={editing ? pickLocalized(editing.name) : t("tags.add")}
              onClose={() => setOpen(null)}
            />

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
                  create.mutate({ draft }, { onSuccess: () => setOpen(null) });
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

function Row({
  tag,
  open,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  tag: Tag;
  open: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
}) {
  const name = pickLocalized(tag.name);

  const className = cx(
    ROW,
    // Marked, not dimmed — fading a row takes its controls with it, and a
    // faded button reads as a disabled one.
    !tag.isActive && "border-danger-wash bg-danger-wash/30",
    open &&
      "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
    tag.isActive && !open && "border-border",
    tag.isActive && open && "border-active",
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow items-center gap-md text-left"
      >
        {/* The chip itself, at the size a phone draws it. The row shows the
            thing rather than describing it — a tone named in words would ask
            the operator to picture the result of their own setting. */}
        <TagChip
          label={name}
          tone={tag.tone}
          ink={tag.ink}
          color={tag.color}
        />

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
  /**
   * The ink, resolved rather than left null.
   *
   * A row may carry null — "whatever the tone measures well against" — and the
   * form does not show that as a third state. It shows the answer that is
   * currently being drawn, and saving writes it back explicitly: the moment a
   * merchant has looked at the chip and pressed Save is the moment the choice
   * stops being a default.
   *
   * Re-derived when the tone changes below, because the sensible ink for grape
   * is not the sensible ink for sun, and carrying the old one across would be
   * the form quietly making the worse choice on their behalf.
   */
  /**
   * The tag's own ground, or null while it is still following its role.
   *
   * Null is not "no colour" — it is a live reference to whatever the palette
   * calls the tone, which is what keeps a preset worth picking. So choosing a
   * swatch clears this rather than storing its hex, and only a colour the
   * palette does not have becomes a value. See `Tag.color`.
   */
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [ink, setInk] = useState<TagInk>(
    inkFor(tone, initial?.ink ?? null, initial?.color ?? null),
  );

  /** What the chip is actually painted in right now, preset or custom. */
  const ground = groundOf(tone, color);
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

    /*
     * The emoji rule, checked here as well as in `api/tags.ts`.
     *
     * The api copy is what makes it true on every path; this one is what makes
     * it a *form error*, under the field, before the panel closes. A rule
     * enforced only at the write boundary arrives as a toast over a form the
     * operator has to reconstruct from memory.
     *
     * The languages are named for the same reason `stillNeeded` names them:
     * "add an emoji" to somebody who added one is a message they cannot act on.
     */
    const short = codes.filter((code) => {
      const text = name[code] ?? "";
      return text.trim().length > 0 && !hasEmoji(text);
    });

    const found = {
      name: !check.ok
        ? t(check.key, check.params)
        : short.length > 0
          ? t("tags.needsEmoji", { language: short.join(", ") })
          : undefined,
    };

    setErrors(found);
    if (found.name) return;

    onSave({ name, tone, ink, color, isActive });
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
          format="sentence"
          hint={t("tags.emojiHint")}
          placeholder={{ en: "🌶️ Spicy", ar: "🌶️ حار" }}
        />

        {/*
          The ground, as a colour rather than as one of five.

          It was a `Select` over the five palette roles, and `0114` is the
          admission that those roles were doing two jobs: naming a meaning in
          *this product's* vocabulary, and choosing a paint. Only the first was
          ever really true of a merchant's own label — "Halal" is not one of the
          app's five states, and a chain's house green is not the app's mint.

          The five stay as **presets**, first and one press away, because they
          are the colours that already agree with everything else on a phone.
          Picking one writes `null` rather than its hex, so a tag left on a
          preset still follows the palette if the palette ever moves. The custom
          swatch is the escape hatch, not the default.
        */}
        <Field label={t("tags.colorLabel")} hint={t("tags.colorHint")}>
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-sm">
              {TAG_TONES.map((option) => {
                const on = color === null && tone === option;
                return (
                  <button
                    key={option}
                    type="button"
                    title={t(`tags.tones.${option}`)}
                    aria-label={t(`tags.tones.${option}`)}
                    aria-pressed={on}
                    onClick={() => {
                      setTone(option);
                      // Back to following the role — see the note on `color`.
                      setColor(null);
                      setInk(inkFor(option, null));
                    }}
                    className={cx(
                      "size-[34px] rounded-full border-2",
                      on ? "border-active" : "border-border hover:border-active",
                    )}
                    style={{ background: TONE_HEX[option] }}
                  />
                );
              })}

              {/*
                The native picker, which is the right tool here: it is the one
                every operating system already taught this person to use, it
                carries an eyedropper on the desktops that have one, and a
                hand-rolled wheel would be a worse version of it that also has
                to be reachable from a keyboard.

                A label wrapping the input rather than a button beside it, so
                the swatch *is* the control and the two cannot drift apart.
              */}
              <label
                className={cx(
                  "relative flex size-[34px] cursor-pointer items-center justify-center rounded-full border-2",
                  color ? "border-active" : "border-border hover:border-active",
                )}
                style={{ background: ground }}
                title={t("tags.colorCustom")}
              >
                <input
                  type="color"
                  value={ground}
                  onChange={(event) => {
                    const picked = event.target.value;
                    setColor(picked);
                    // The ink follows the ground, measured rather than looked
                    // up — the palette has no recorded answer for a colour it
                    // has never seen.
                    setInk(bestInk(picked));
                  }}
                  aria-label={t("tags.colorCustom")}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                {!color && (
                  <svg
                    aria-hidden
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-text)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </label>
            </div>

            {/* Typed as well as picked: a brand colour arrives as six
                characters in an email, and hunting for it on a wheel is worse
                than pasting it. Anything that is not a colour yet is simply not
                applied — a half-typed `#1e` is somebody mid-word, not a
                mistake to report. */}
            <span className="w-[140px]">
              <Input
                value={color ?? ""}
                onChange={(event) => {
                  const typed = event.target.value.trim();
                  if (typed === "") {
                    setColor(null);
                    setInk(inkFor(tone, null));
                    return;
                  }
                  const hex = typed.startsWith("#") ? typed : `#${typed}`;
                  setColor(hex);
                  if (/^#[0-9a-fA-F]{6}$/.test(hex)) setInk(bestInk(hex));
                }}
                placeholder={TONE_HEX[tone]}
                aria-label={t("tags.colorHex")}
                className="font-mono text-[13px] tabular-nums"
              />
            </span>
          </div>
        </Field>

        {/*
          The other half of the chip, chosen the same way the tone is — by
          looking at it.

          Two buttons rather than a select, because there are exactly two
          answers and both fit on the screen at once: the choice is a
          *comparison*, and a dropdown that shows one at a time is the one shape
          that cannot be compared. Each is the real chip, in the real ground,
          with what it measures written under it.
        */}
        <Field label={t("tags.inkLabel")} hint={t("tags.inkHint")}>
          <div className="flex items-stretch gap-sm">
            {TAG_INKS.map((option) => {
              // Measured against the colour actually chosen, not looked up:
              // since `0114` the ground can be anything, and a table has
              // nothing to say about a merchant's own hex.
              const ratio = contrastRatio(ground, INK_HEX[option]);
              const poor = ratio < CONTRAST_FLOOR;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setInk(option)}
                  aria-pressed={ink === option}
                  className={cx(
                    "flex flex-1 flex-col items-center gap-sm rounded-md border p-lg",
                    ink === option
                      ? "border-active shadow-[0_0_0_3px_var(--color-active-wash)]"
                      : "border-border hover:border-active",
                  )}
                >
                  <TagChip
                    tone={tone}
                    ink={option}
                    color={color}
                    label={previewLabel}
                  />

                  <span className="text-[12px] font-semibold text-text">
                    {t(`tags.inks.${option}`)}
                  </span>

                  {/* The number, not a verdict. A merchant is allowed the
                      quieter pairing — it is their brand — and the honest way
                      to offer it is with the figure beside it rather than a
                      control that refuses. */}
                  <span
                    className={cx(
                      "text-[11px] tabular-nums",
                      poor ? "font-semibold text-danger" : "text-text-faint",
                    )}
                  >
                    {poor
                      ? t("tags.inkTooLow", { ratio: ratio.toFixed(1) })
                      : t("tags.inkRatio", { ratio: ratio.toFixed(1) })}
                  </span>
                </button>
              );
            })}
          </div>
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
