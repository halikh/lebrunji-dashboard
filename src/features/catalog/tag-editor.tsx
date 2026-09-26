"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { ColorPicker } from "@/components/ui/color-picker";
import { EditorPage } from "@/components/ui/editor-page";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import {
  CONTRAST_FLOOR,
  INK_HEX,
  bestInk,
  contrastRatio,
} from "@/lib/contrast";
import { TEXT } from "@/lib/limits";
import { hasEmoji } from "@/lib/text-format";
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
import { useCreateTag, useTags, useUpdateTag } from "./use-tags";

const LIST_HREF = "/catalogue?tab=tags";

/**
 * One tag, on a page of its own.
 *
 * The panel it used to open in is gone — see `CategoryEditor` for the reasoning
 * and `useRowFocus` for what replaced the one thing the panel was good at.
 *
 * This one had the most to gain from the move: a tag carries two languages of
 * name, a colour picker, a hex field and an ink comparison drawn as two real
 * chips side by side. That is a screen's worth of decisions, and it was being
 * made in a 420pt column.
 */
export function TagEditor({ id }: { id: string | null }) {
  const router = useRouter();

  // The vocabulary is one short unpaginated query, so this is nearly always a
  // cache hit. A pasted link on a cold load fills the form when it lands, which
  // is why the form is keyed on the row.
  const tags = useTags("");
  const rows = tags.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateTag();
  const update = useUpdateTag();

  const back = (focusId: string | null) => {
    const focus = focusId ? `&focus=${focusId}` : "";
    // `replace`: the editor is where the journey ended, and Back from the list
    // should leave the catalogue rather than reopen a form already saved.
    router.replace(`${LIST_HREF}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("tags.add")}
        backHref={LIST_HREF}
        backLabel={t("tags.tab")}
      >
        {tags.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="tags.notFound" mood="lost" />
        )}
      </EditorPage>
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => back(initial?.id ?? null);
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name: draft.name },
            { onSuccess: done },
          );
        } else {
          create.mutate({ draft }, { onSuccess: done });
        }
      }}
      onCancel={() => back(initial?.id ?? null)}
    />
  );
}

function Form({
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

  /**
   * The guard the panel used to provide.
   *
   * A panel was left by Escape or a tab switch and `useGuardedAction` caught
   * both; a page is left by navigating, which nothing intercepts — so the form
   * registers itself dirty and the rail and the tab strip ask before they go.
   *
   * `ink` and `color` are compared as they will be *written*, not as they
   * arrived: the form resolves a null ink to the tone's own on load, so
   * comparing against `initial.ink` directly would mark every tag dirty the
   * moment it opened.
   */
  useUnsavedChanges(
    changed(
      { name, tone, ink, color, isActive },
      {
        name: initial?.name ?? {},
        tone: initial?.tone ?? "neutral",
        ink: inkFor(
          initial?.tone ?? "neutral",
          initial?.ink ?? null,
          initial?.color ?? null,
        ),
        color: initial?.color ?? null,
        isActive: initial?.isActive ?? true,
      },
    ),
  );

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
    <EditorPage
      title={initial ? pickLocalized(initial.name) : t("tags.add")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("tags.tab")}
      /* Two columns: the tag as a record on the left, the tag as something a
         customer sees on the right. */
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("tags.save")}
          </Button>
        </>
      }
    >
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
        {/*
          The picker is `ColorPicker` now — the same control the category form
          uses — and the five tones are handed to it as presets.

          What is tag-specific stays here, because it is about meaning rather
          than about picking a colour: pressing a preset writes **null** rather
          than its hex, so a tag left on a role still follows the palette if the
          palette ever moves, and the ink follows whatever was chosen — measured
          for a colour the palette has never seen, looked up for one of its own.
        */}
        <ColorPicker
          value={color}
          onChange={(picked) => {
            setColor(picked);
            setInk(picked ? bestInk(picked) : inkFor(tone, null));
          }}
          fallback={TONE_HEX[tone]}
          customLabel={t("tags.colorCustom")}
          hexLabel={t("tags.colorHex")}
          presets={TAG_TONES.map((option) => ({
            hex: TONE_HEX[option],
            label: t(`tags.tones.${option}`),
            on: color === null && tone === option,
            onSelect: () => {
              setTone(option);
              setColor(null);
              setInk(inkFor(option, null));
            },
          }))}
        />
      </Field>

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
                  "flex flex-1 flex-col items-center gap-sm rounded-md border bg-surface p-lg",
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
    </EditorPage>
  );
}
