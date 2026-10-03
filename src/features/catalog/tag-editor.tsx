"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { FieldPair, FormSection } from "@/components/ui/form-section";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { isTagName } from "@/lib/text-format";
import {
  FALLBACK_LANGUAGE,
  validateLocalizedText,
  type Localized,
} from "@/lib/validation";

import type { Tag, TagDraft } from "./api/tags";
import { TagChip } from "./tag-chip";
import { useCreateTag, useTags, useUpdateTag } from "./use-tags";

const LIST_HREF = "/catalogue?tab=tags";

/**
 * One tag, on a page of its own.
 *
 * The panel it used to open in is gone — see `CategoryEditor` for the reasoning
 * and `useRowFocus` for what replaced the one thing the panel was good at.
 *
 * It is a short form now. A tag used to carry a colour, an ink and a contrast
 * readout as well; those columns were dropped, and a tag is drawn as its icon
 * and its name (see `tag-chip.tsx`). What is left to decide is what it says,
 * in every language, what its icon is, and whether it is live.
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
  const [iconUrl, setIconUrl] = useState<string | null>(
    initial?.iconUrl ?? null,
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  /**
   * The guard the panel used to provide.
   *
   * A panel was left by Escape or a tab switch and `useGuardedAction` caught
   * both; a page is left by navigating, which nothing intercepts — so the form
   * registers itself dirty and the rail and the tab strip ask before they go.
   */
  useUnsavedChanges(
    changed(
      { name, iconUrl, isActive },
      {
        name: initial?.name ?? {},
        iconUrl: initial?.iconUrl ?? null,
        isActive: initial?.isActive ?? true,
      },
    ),
  );

  /**
   * Seeded with the icon's error for a legacy tag that has none.
   *
   * `menu_item_tags_icon_required` refuses every update to a live tag without
   * one — a rename, or the switch on the list — so opening such a tag says so
   * up front rather than on Save. Archiving is the exception and does not come
   * through this form.
   */
  const [errors, setErrors] = useState<{ name?: string; icon?: string }>(() =>
    initial && !hasIcon(initial.iconUrl)
      ? { icon: t("tags.iconRequired") }
      : {},
  );

  function submit() {
    const check = validateLocalizedText(name, codes, TEXT.tag);

    /*
     * The letters rule, checked here as well as in `api/tags.ts`.
     *
     * The field already drops anything that is not a letter as it is typed,
     * so this mostly catches a value that arrived some other way — a legacy
     * tag still carrying an emoji, say. The api copy is what makes the rule
     * true on every path; this one is what makes it a *form error*, under the
     * field, before the page closes.
     *
     * The languages are named for the same reason `stillNeeded` names them: a
     * message about "the name" when only the Arabic is wrong is one somebody
     * has to go looking to act on.
     */
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
      // Required — `menu_item_tags_icon_required`.
      icon: hasIcon(iconUrl) ? undefined : t("tags.iconRequired"),
    };

    setErrors(found);
    if (found.name || found.icon) return;

    onSave({ name, iconUrl, isActive });
  }

  return (
    <EditorPage
      title={initial ? pickLocalized(initial.name) : t("tags.add")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("tags.tab")}
      // How far the tag reaches, under its name — the same count the row
      // shows, and the thing that makes a rename or a hide a decision.
      aside={
        initial ? (
          <span className="text-[13px] text-text-soft">
            {initial.usedBy === 0
              ? t("tags.unused")
              : t("tags.usedBy", { count: initial.usedBy })}
          </span>
        ) : undefined
      }
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
      {/* The fields in a wide column, the chip they make beside them — the
          same frame as `PromotionEditor`. Three fields in a 640pt column left
          most of the page empty, and the one thing worth having next to them
          was missing: what a customer will actually see. One column below
          `lg`, preview last. */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-xxl">
        <FormSection>
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

          <FieldPair>
            {/* The same uploader, and the same rule, as a category's icon:
                required, the error cleared as soon as something is uploaded,
                and back on Save if it is removed again. */}
            <Field
              label={t("tags.icon")}
              hint={t("tags.iconHint")}
              error={errors.icon}
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
                disabled={pending}
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
          </FieldPair>
        </FormSection>

        <aside className="flex min-w-0 flex-col gap-lg lg:sticky lg:top-0">
          <Preview name={name} iconUrl={iconUrl} />
        </aside>
      </div>
    </EditorPage>
  );
}

/**
 * The chip as the app draws it, in every language, from the draft.
 *
 * A tag is a few millimetres of screen, and whether "Gluten free" with that
 * icon reads at that size is not something the inputs can show. So each
 * language gets a line: a bar standing in for an item's name — the chip's real
 * neighbour, and deliberately not a made-up dish — then the chip at the size
 * it rides beside one.
 *
 * A blank language shows the English, because that is what the app falls back
 * to; an empty name altogether shows nothing to preview and says so.
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
    <FormSection title={t("tags.previewTitle")}>
      <p className="-mt-sm text-[13px] text-text-soft">
        {t("tags.previewHint")}
      </p>

      {any ? (
        <ul className="flex flex-col gap-sm">
          {lines.map(({ language, label }) => (
            <li
              key={language.code}
              className="flex flex-col gap-xs rounded-md bg-neutral-fill px-lg py-md"
            >
              <span className="text-[12px] text-text-faint">
                {language.name}
              </span>
              <span
                dir={language.rtl ? "rtl" : "ltr"}
                className="flex min-w-0 items-center gap-md"
              >
                <span
                  aria-hidden
                  className="h-[10px] w-[96px] shrink-0 rounded-full bg-border"
                />
                {label ? (
                  <TagChip
                    label={label}
                    iconUrl={hasIcon(iconUrl) ? iconUrl : null}
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-neutral-fill px-lg py-md text-[13px] text-text-faint">
          {t("tags.previewEmpty")}
        </p>
      )}
    </FormSection>
  );
}

/** Whether a URL counts as an icon — blank does not, as the constraint trims. */
function hasIcon(url: string | null | undefined): boolean {
  return Boolean(url && url.trim() !== "");
}
