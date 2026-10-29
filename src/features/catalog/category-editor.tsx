"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EditorPage } from "@/components/ui/editor-page";
import { FieldPair, FormSection } from "@/components/ui/form-section";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { CategoryDraft } from "./api/categories";
import {
  useCategories,
  useCategoryKinds,
  useCreateCategory,
  useUpdateCategory,
} from "./use-categories";

/**
 * One category, on a page of its own.
 *
 * ## Why it is no longer a panel
 *
 * It opened beside the list, and the reasoning was recorded in
 * `categories-list.tsx`: the flow study asked for editing *inline*, a category
 * carries two languages of name, a kind and three switches, and growing a row
 * to fit that reflows every row beneath it — so the panel kept what mattered
 * about the inline idea, which was not losing your place in the list.
 *
 * The panel is gone across the dashboard now, and what it was protecting is
 * kept another way: this page hands the list back the id it was editing, and
 * the list scrolls that row into view. See `useRowFocus`.
 *
 * What is gained is what a URL gives and a panel cannot — a link somebody can
 * send, a refresh that lands where it left off, and a back button that means
 * what it says.
 *
 * ## One component for both, keyed by whether there is a row
 *
 * Adding and editing differ by two things: what the fields start as, and which
 * mutation runs. Splitting them into two files would duplicate the form to
 * express that, and the copy that was not being looked at would be the one that
 * drifted.
 */
export function CategoryEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const languages = useLanguages();
  const kinds = useCategoryKinds();
  const codes = languages.data?.map((language) => language.code) ?? [];

  /**
   * The row being edited, out of the list's own cache.
   *
   * The list is unpaginated and short — the whole vocabulary is one query — so
   * this is nearly always a cache hit and needs no read of its own. On a cold
   * arrival (a pasted link, a refresh) the query runs and the form fills when
   * it lands, which is why the fields are keyed on the row below.
   */
  const categories = useCategories("");
  const rows = categories.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateCategory();
  const update = useUpdateCategory();

  // A cold arrival has nothing to fill the fields with yet. Keyed on the row so
  // the form is rebuilt once it lands rather than left holding empty values.
  if (id && !initial) {
    return categories.isPending ? (
      <Frame title={t("categories.add")} pending />
    ) : (
      <Frame title={t("categories.add")} missing />
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial}
      codes={codes}
      kinds={kinds.data ?? []}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => back(router, initial?.id ?? null);
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name: draft.name },
            { onSuccess: done },
          );
        } else {
          create.mutate({ draft, sortOrder: rows.length }, { onSuccess: done });
        }
      }}
      onCancel={() => back(router, initial?.id ?? null)}
    />
  );
}

/**
 * Back to the list, with the row to return to.
 *
 * `replace`, not `push`: the editor is where the journey ended, and a Back from
 * the list should leave the catalogue rather than walk back into a form that
 * has just been saved and would reopen holding stale values.
 */
function back(router: ReturnType<typeof useRouter>, id: string | null) {
  const focus = id ? `&focus=${id}` : "";
  router.replace(`/catalogue?tab=categories${focus}`);
}

const LIST_HREF = "/catalogue?tab=categories";

/** The page around a state that has no form to show. */
function Frame({
  title,
  pending,
  missing,
}: {
  title: string;
  pending?: boolean;
  missing?: boolean;
}) {
  return (
    <EditorPage
      title={title}
      backHref={LIST_HREF}
      backLabel={t("categories.tab")}
    >
      {pending && (
        <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
      )}
      {missing && <EmptyState titleKey="categories.notFound" mood="lost" />}
    </EditorPage>
  );
}

function Form({
  initial,
  codes,
  kinds,
  pending,
  onSave,
  onCancel,
}: {
  initial: {
    id: string;
    name: Localized;
    kindId: string;
    isActive: boolean;
    hasMenuNav: boolean;
    iconUrl: string | null;
    /** Live shops in it — shown under the title. */
    usedBy: number;
  } | null;
  codes: string[];
  kinds: { id: string; name: Localized }[];
  pending: boolean;
  onSave: (draft: CategoryDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [kindId, setKindId] = useState(initial?.kindId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [hasMenuNav, setHasMenuNav] = useState(initial?.hasMenuNav ?? true);

  /**
   * The category's own icon — required, see `Category.iconUrl`.
   *
   * Null only for a new category, or for a legacy row from before
   * `categories_icon_required`; the database refuses to save either until one
   * is added.
   */
  const [iconUrl, setIconUrl] = useState<string | null>(
    initial?.iconUrl ?? null,
  );

  /**
   * Seeded with the icon's error for a legacy row that has none.
   *
   * The constraint refuses *every* update to a live category without an icon
   * — a rename, a kind change, a switch — so opening one should say so up
   * front rather than letting the operator fill the form in and find out on
   * Save. Archiving is the exception and does not come through this form.
   */
  const [errors, setErrors] = useState<{
    name?: string;
    kind?: string;
    icon?: string;
  }>(() =>
    initial && !hasIcon(initial.iconUrl)
      ? { icon: t("categories.iconRequired") }
      : {},
  );

  /**
   * The guard that used to belong to the panel.
   *
   * A panel was left by pressing Escape or switching tabs, and `useGuardedAction`
   * caught both. A page is left by *navigating*, which nothing in the app
   * intercepts — so this registers the form as dirty and `useConfirmLeave` on
   * the rail and the tab strip asks before it goes.
   */
  useUnsavedChanges(
    changed(
      {
        name,
        kindId,
        isActive,
        hasMenuNav,
        iconUrl,
      },
      {
        name: initial?.name ?? {},
        kindId: initial?.kindId ?? "",
        isActive: initial?.isActive ?? true,
        hasMenuNav: initial?.hasMenuNav ?? true,
        iconUrl: initial?.iconUrl ?? null,
      },
    ),
  );

  function submit() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // `category_kind_id` is `not null` with no default, so an empty one is a
      // refusal from Postgres rather than a message about the field it came
      // from. Caught here so it reads as a form.
      kind: kindId ? undefined : t("categories.kindRequired"),
      // Every category carries its own icon — `categories_icon_required`. The
      // strip across Home and Search is all of them side by side, and a gap
      // among uploaded pictures reads as the one that is broken. Checked here
      // so it lands under the uploader rather than as a refusal from Postgres.
      icon: hasIcon(iconUrl) ? undefined : t("categories.iconRequired"),
    };

    setErrors(found);
    if (found.name || found.kind || found.icon) return;

    onSave({
      name,
      kindId,
      isActive,
      hasMenuNav,
      iconUrl,
    });
  }

  return (
    <EditorPage
      title={initial ? pickLocalized(initial.name) : t("categories.add")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("categories.tab")}
      // How many shops sit in it, under its name — the same count the row
      // shows, and the one archiving is refused on.
      aside={
        initial ? (
          <span className="text-[13px] text-text-soft">
            {initial.usedBy === 0
              ? t("categories.unused")
              : t("categories.usedBy", { count: initial.usedBy })}
          </span>
        ) : undefined
      }
      /* The record in a wide column, its icon beside it. See the grid below. */
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("categories.save")}
          </Button>
        </>
      }
    >
      {/**
       * What it is, and what it looks like — the frame `PromotionEditor` uses.
       *
       * The main column is the category as a *record*: its name and kind in
       * one card, the two switches that decide where it shows paired in
       * another. The side column is the category as something a customer sees,
       * which is its icon, pinned on a wide screen. The empty-state glyph, its
       * background, the shop page's text colour and the preview that drew them
       * together went with their columns.
       *
       * One column below `lg`, icon last.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <FormSection>
            <LocalizedField
              label={t("categories.name")}
              value={name}
              onChange={setName}
              maxLength={TEXT.name}
              error={errors.name}
              filter="title"
              placeholder={{ en: "Restaurants", ar: "مطاعم" }}
            />

            {/* Half the card, like every short answer here: a select stretched
                across the page is harder to aim at, not easier. */}
            <FieldPair>
              <Field
                label={t("categories.kind")}
                hint={t("categories.kindHint")}
                error={errors.kind}
              >
                <Select
                  value={kindId}
                  onChange={setKindId}
                  placeholder={t("categories.pickKind")}
                  options={kinds.map((kind) => ({
                    value: kind.id,
                    label: pickLocalized(kind.name),
                  }))}
                />
              </Field>
            </FieldPair>
          </FormSection>

          <FormSection title={t("categories.showSection")}>
            <FieldPair>
              <Field
                label={t("categories.visibility")}
                hint={
                  isActive
                    ? t("categories.liveHint")
                    : t("categories.hiddenHint")
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
            </FieldPair>
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-lg lg:sticky lg:top-0">
          <FormSection title={t("categories.artworkSection")}>
            <p className="-mt-sm text-[13px] text-text-soft">
              {t("categories.artworkSectionHint")}
            </p>

            {/* The category's own mark — the one a customer meets, in the strip
                across the top of Home and Search. Required: the error under it
                is cleared as soon as something is uploaded, and comes back on
                Save if it is removed again. */}
            <Field
              label={t("categories.icon")}
              hint={t("categories.iconHint")}
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
                folder="category-art"
                disabled={pending}
              />
            </Field>
          </FormSection>
        </aside>
      </div>
    </EditorPage>
  );
}

/** Whether a URL counts as an icon — blank does not, as the constraint trims. */
function hasIcon(url: string | null | undefined): boolean {
  return Boolean(url && url.trim() !== "");
}
