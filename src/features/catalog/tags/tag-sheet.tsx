"use client";

import { SearchX } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  Field,
  Sheet,
  Skeleton,
  Switch,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
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
import { isTagName } from "@/lib/text-format";
import {
  FALLBACK_LANGUAGE,
  validateLocalizedText,
  type Localized,
} from "@/lib/validation";

import type { Tag, TagDraft } from "../api/tags";
import { useCreateTag, useTags, useUpdateTag } from "../use-tags";
import { TagChip } from "./tag-chip";

/**
 * One tag, in a sheet over the list: what it says in each language, its icon,
 * and whether it is live — with the chip it makes, drawn as the app draws it,
 * underneath. A tag is a few millimetres of screen, and whether a name and an
 * icon read at that size is not something the inputs can show.
 */
export function TagSheet({
  editing,
  onClose,
}: {
  editing: string | null;
  onClose: () => void;
}) {
  const guarded = useGuardedAction();
  const tags = useTags("");
  const rows = tags.data ?? [];
  const isNew = editing === "new";
  const initial =
    editing && !isNew ? (rows.find((row) => row.id === editing) ?? null) : null;

  return (
    <Sheet
      open={editing !== null}
      onOpenChange={(open) => !open && guarded(onClose)()}
      title={
        initial
          ? pickLocalized(initial.name)
          : isNew
            ? t("tags.add")
            : t("tags.edit")
      }
      description={
        initial
          ? initial.usedBy === 0
            ? t("tags.unused")
            : t("tags.usedBy", { count: initial.usedBy })
          : t("tags.newHint")
      }
    >
      {editing === null ? null : isNew || initial ? (
        <Form
          key={initial?.id ?? "new"}
          initial={initial}
          onDone={onClose}
          onCancel={guarded(onClose)}
        />
      ) : tags.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title={t("tags.notFound")}
          action={<Button onClick={onClose}>{t("tags.backToList")}</Button>}
        />
      )}
    </Sheet>
  );
}

function Form({
  initial,
  onDone,
  onCancel,
}: {
  initial: Tag | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const create = useCreateTag();
  const update = useUpdateTag();
  const pending = create.isPending || update.isPending;

  const start = {
    name: initial?.name ?? ({} as Localized),
    iconUrl: initial?.iconUrl ?? null,
    isActive: initial?.isActive ?? true,
  };
  const [name, setName] = useState<Localized>(start.name);
  const [iconUrl, setIconUrl] = useState<string | null>(start.iconUrl);
  const [isActive, setIsActive] = useState(start.isActive);

  const dirty = changed({ name, iconUrl, isActive }, start);
  useUnsavedChanges(dirty);

  // `menu_item_tags_icon_required` refuses every update to a live tag without
  // one, so a legacy tag opened without an icon says so up front.
  const [errors, setErrors] = useState<{ name?: string; icon?: string }>(() =>
    initial && !hasIcon(initial.iconUrl)
      ? { icon: t("tags.iconRequired") }
      : {},
  );

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.tag);
    // The letters rule, here as well as in `api/tags.ts`: the api copy makes it
    // true on every path, this one makes it an error under the field. The
    // languages are named, because "the name" when only the Arabic is wrong
    // sends somebody looking.
    const bad = codes.filter((code) => {
      const text = name[code] ?? "";
      return text.trim().length > 0 && !isTagName(text);
    });
    const found = {
      name: !check.ok
        ? t(check.key, check.params)
        : bad.length > 0
          ? t("tags.lettersOnly", { language: bad.join(", ") })
          : undefined,
      icon: hasIcon(iconUrl) ? undefined : t("tags.iconRequired"),
    };
    setErrors(found);
    if (found.name || found.icon) return;

    const draft: TagDraft = { name, iconUrl, isActive };
    if (initial) {
      update.mutate(
        { id: initial.id, patch: draft, name: draft.name },
        { onSuccess: onDone },
      );
    } else {
      create.mutate({ draft }, { onSuccess: onDone });
    }
  }

  return (
    <form
      className="flex min-h-full flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <LocalizedField
        label={t("tags.name")}
        value={name}
        onChange={setName}
        maxLength={TEXT.tag}
        error={errors.name}
        filter="letters"
        hint={t("tags.lettersHint")}
        placeholder={{ en: "Spicy", ar: "حار" }}
      />

      <Field
        label={t("tags.icon")}
        hint={t("tags.iconHint")}
        error={errors.icon}
        required
      >
        <ImageUploader
          value={iconUrl}
          onChange={(url) => {
            setIconUrl(url);
            if (hasIcon(url)) {
              setErrors((current) => ({ ...current, icon: undefined }));
            }
          }}
          folder="tag-art"
          shape={ARTWORK_SHAPES.tagIcon}
          cutout
          prompt={{ kind: "tag", subject: name.en ?? "" }}
          disabled={pending}
        />
      </Field>

      <div className="rounded-lg border border-line p-4">
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t("tags.visibility")}
          description={isActive ? t("tags.liveHint") : t("tags.hiddenHint")}
          disabled={pending}
        />
      </div>

      <Preview name={name} iconUrl={iconUrl} />

      <div className="sticky bottom-0 -mx-6 -mb-5 mt-auto flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={!dirty}
        >
          {initial ? t("tags.save") : t("tags.create")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The chip in every language, beside a grey bar standing in for a dish's name
 * — its real neighbour. A blank language shows the English, as the app does.
 */
function Preview({
  name,
  iconUrl,
}: {
  name: Localized;
  iconUrl: string | null;
}) {
  const languages = useLanguages();
  const fallback = (name[FALLBACK_LANGUAGE] ?? "").trim();
  const lines = (languages.data ?? []).map((language) => ({
    language,
    label: (name[language.code] ?? "").trim() || fallback,
  }));
  const any = lines.some((line) => line.label !== "");

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[13px] font-medium text-ink">
          {t("tags.previewTitle")}
        </h3>
        <p className="text-[12.5px] text-ink-3">{t("tags.previewHint")}</p>
      </div>
      {any ? (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-subtle">
          {lines.map(({ language, label }) => (
            <li
              key={language.code}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span
                dir={language.rtl ? "rtl" : "ltr"}
                className="flex min-w-0 items-center gap-2.5"
              >
                <span
                  aria-hidden
                  className="h-2 w-20 shrink-0 rounded-full bg-line-strong"
                />
                {label ? (
                  <TagChip
                    label={label}
                    iconUrl={hasIcon(iconUrl) ? iconUrl : null}
                  />
                ) : null}
              </span>
              <span className="shrink-0 text-[12px] text-ink-4">
                {language.name}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong bg-subtle px-3 py-3 text-[13px] text-ink-3">
          {t("tags.previewEmpty")}
        </p>
      )}
    </section>
  );
}

function hasIcon(url: string | null | undefined): boolean {
  return Boolean(url && url.trim() !== "");
}
