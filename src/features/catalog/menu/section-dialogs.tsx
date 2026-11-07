"use client";

import { useState } from "react";

import { Button, Dialog, Field } from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { ARTWORK_SHAPES } from "@/lib/image-shape";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { SectionLevel } from "./shared";

/** What the section form edits — its name, and its aisle picture. */
export type SectionFields = { title: Localized; imageUrl: string | null };

/**
 * Naming a section — new, a new sub-aisle, or a rename. One form for all three,
 * because two would drift and the way they would drift is that one grows a
 * field the other does not.
 *
 * `level` is which kind of heading it makes or edits — aisle, sub-aisle or
 * section — and the field is labelled for it (the title says it too).
 *
 * No slug field: the trigger from migration 0071 derives one from the English
 * title and keeps it unique within the shop.
 *
 * The picture is asked of every shop's sections, not only supermarkets': it is
 * read only when the shop's layout is Aisles, and asking regardless lets the
 * pictures be in place before the layout is switched. For an aisle or a
 * sub-aisle it is required: those are tiles in the app, and a tile falling
 * back to its first item's picture looks like a product, not an aisle.
 */
export function SectionDialog({
  open,
  onOpenChange,
  title,
  level,
  initial,
  placeholder = { en: "Starters", ar: "المقبلات" },
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  level: SectionLevel;
  initial?: SectionFields;
  placeholder?: Localized;
  pending: boolean;
  /** Called with valid fields; the caller closes the dialog on success. */
  onSave: (fields: SectionFields) => void;
}) {
  const guarded = useGuardedAction();
  // Closing asks first when something was typed; a save that landed closes
  // through the caller's `onSuccess` and asks nothing.
  const close = guarded(() => onOpenChange(false));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={title}
      size="md"
    >
      {open && (
        <SectionForm
          level={level}
          initial={initial}
          placeholder={placeholder}
          pending={pending}
          onSave={onSave}
          onCancel={close}
        />
      )}
    </Dialog>
  );
}

const TITLE_LABEL = {
  aisle: "menu.aisleTitle",
  subAisle: "menu.subAisleTitle",
  section: "menu.sectionTitle",
} as const;

function SectionForm({
  level,
  initial,
  placeholder,
  pending,
  onSave,
  onCancel,
}: {
  level: SectionLevel;
  initial?: SectionFields;
  placeholder: Localized;
  pending: boolean;
  onSave: (fields: SectionFields) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [title, setTitle] = useState<Localized>(initial?.title ?? {});
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const needsImage = level !== "section";

  const dirty = changed(
    { title, imageUrl },
    { title: initial?.title ?? {}, imageUrl: initial?.imageUrl ?? null },
  );
  useUnsavedChanges(dirty);

  function submit() {
    const result = validateLocalizedText(title, codes, TEXT.title);
    setError(result.ok ? undefined : t(result.key, result.params));
    const missingImage = needsImage && !imageUrl?.trim();
    setImageError(missingImage ? t("menu.sectionImageRequired") : undefined);
    if (!result.ok || missingImage) return;
    onSave({ title, imageUrl });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <LocalizedField
        label={t(TITLE_LABEL[level])}
        value={title}
        onChange={setTitle}
        maxLength={TEXT.title}
        hint={t("menu.sectionTitleHint")}
        error={error}
        filter="title"
        placeholder={placeholder}
      />
      <Field
        label={t("menu.sectionImage")}
        hint={t(
          needsImage
            ? "menu.sectionImageHintRequired"
            : "menu.sectionImageHint",
        )}
        required={needsImage}
        error={imageError}
      >
        <ImageUploader
          value={imageUrl}
          onChange={(next) => {
            setImageUrl(next);
            if (next) setImageError(undefined);
          }}
          folder="menu-sections"
          shape={ARTWORK_SHAPES.aisle}
          cutout
          disabled={pending}
        />
      </Field>
      <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-auto flex justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={!dirty}
        >
          {t("menu.saveSection")}
        </Button>
      </div>
    </form>
  );
}

/** The Move dialog's two choices that are not an existing aisle. */
const NEW_AISLE = "new";
const OWN_AISLE = "own";

export type SectionMoves = {
  /** The aisles it can go under. */
  targets: { id: string; title: Localized }[];
  /** Offer "a new aisle" — an aisle only. */
  canGroup: boolean;
  /** Offer "an aisle of its own" — a sub-aisle the database will let out. */
  canUnnest: boolean;
  pending: boolean;
  /** Under `target`, or out to an aisle of its own when null. */
  move: (target: string | null, done: () => void) => void;
  /** Into a new aisle called `title`, with its (required) picture. */
  group: (title: Localized, imageUrl: string, done: () => void) => void;
};

/**
 * Moving a section around the aisles tree (0196): under another aisle, into a
 * new aisle made for it, or — for a sub-aisle the database will let out — back
 * to an aisle of its own.
 */
export function MoveSectionDialog({
  open,
  onOpenChange,
  name,
  isSub,
  moves,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  isSub: boolean;
  moves: SectionMoves;
}) {
  const guarded = useGuardedAction();
  const close = guarded(() => onOpenChange(false));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t("menu.moveSectionTitle", { name })}
      description={t("menu.moveHint")}
    >
      {open && (
        <MoveForm
          isSub={isSub}
          moves={moves}
          onCancel={close}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function MoveForm({
  isSub,
  moves,
  onCancel,
  onDone,
}: {
  isSub: boolean;
  moves: SectionMoves;
  onCancel: () => void;
  onDone: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [target, setTarget] = useState("");
  const [title, setTitle] = useState<Localized>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState<string | undefined>(undefined);

  useUnsavedChanges(
    changed(
      { target, title, imageUrl },
      { target: "", title: {}, imageUrl: null },
    ),
  );

  const options = [
    ...(moves.canGroup
      ? [{ value: NEW_AISLE, label: t("menu.moveNewAisle") }]
      : []),
    ...(moves.canUnnest
      ? [{ value: OWN_AISLE, label: t("menu.moveOwnAisle") }]
      : []),
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
      setError(result.ok ? undefined : t(result.key, result.params));
      const picture = imageUrl?.trim() ?? "";
      setImageError(picture ? undefined : t("menu.sectionImageRequired"));
      if (!result.ok || !picture) return;
      moves.group(title, picture, onDone);
      return;
    }
    setError(undefined);
    moves.move(target === OWN_AISLE ? null : target, onDone);
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        label={isSub ? t("menu.moveSubAisleTo") : t("menu.moveAisleInto")}
        error={target === NEW_AISLE ? undefined : error}
      >
        <Select
          value={target}
          onChange={setTarget}
          options={options}
          disabled={moves.pending}
          placeholder={t("menu.moveChoose")}
          aria-label={
            isSub ? t("menu.moveSubAisleTo") : t("menu.moveAisleInto")
          }
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
      {target === NEW_AISLE && (
        <Field
          label={t("menu.sectionImage")}
          hint={t("menu.sectionImageHintRequired")}
          required
          error={imageError}
        >
          <ImageUploader
            value={imageUrl}
            onChange={(next) => {
              setImageUrl(next);
              if (next) setImageError(undefined);
            }}
            folder="menu-sections"
            shape={ARTWORK_SHAPES.aisle}
            cutout
            disabled={moves.pending}
          />
        </Field>
      )}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-auto flex justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={moves.pending}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={submit} pending={moves.pending}>
          {t("menu.moveConfirm")}
        </Button>
      </div>
    </div>
  );
}

/**
 * "Gather loose products" — a new sub-aisle holding every product sitting
 * directly on the aisle. It is a sub-aisle, so it needs its picture before it
 * is made (0261); the title is the aisle's, as before.
 */
export function GatherDialog({
  open,
  onOpenChange,
  name,
  pending,
  onGather,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  pending: boolean;
  onGather: (imageUrl: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | undefined>(undefined);

  function submit() {
    const picture = imageUrl?.trim() ?? "";
    if (!picture) {
      setImageError(t("menu.sectionImageRequired"));
      return;
    }
    onGather(picture);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) {
          setImageUrl(null);
          setImageError(undefined);
        }
        onOpenChange(next);
      }}
      title={t("menu.gatherTitle", { name })}
      description={t("menu.looseBody")}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} pending={pending}>
            {t("menu.looseGather")}
          </Button>
        </>
      }
    >
      <Field
        label={t("menu.sectionImage")}
        hint={t("menu.sectionImageHintRequired")}
        required
        error={imageError}
      >
        <ImageUploader
          value={imageUrl}
          onChange={(next) => {
            setImageUrl(next);
            if (next) setImageError(undefined);
          }}
          folder="menu-sections"
          shape={ARTWORK_SHAPES.aisle}
          cutout
          disabled={pending}
        />
      </Field>
    </Dialog>
  );
}
