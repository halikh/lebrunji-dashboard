"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, cx } from "@/components/ui";
import { ColorPicker, isHex } from "@/components/ui/color-picker";
import { IconPicker } from "@/components/ui/icon-picker";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EditorPage } from "@/components/ui/editor-page";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { contrastRatio } from "@/lib/contrast";
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
      {missing && (
        <p className="text-[14px] text-text-soft">{t("categories.notFound")}</p>
      )}
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
    emptyIcon: string | null;
    iconUrl: string | null;
    emptyBackgroundColor: string | null;
    storeTextColor: string | null;
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
   * The category's own artwork — see `0117`.
   *
   * Null on all three, and null is the answer for almost every category: it
   * means "whatever the app's own table says", which is a live reference rather
   * than a missing value. Nothing here is seeded with a colour, because seeding
   * one would quietly turn a category that follows the palette into one that
   * has an opinion.
   */
  const [emptyIcon, setEmptyIcon] = useState<string | null>(
    initial?.emptyIcon ?? null,
  );
  const [iconUrl, setIconUrl] = useState<string | null>(initial?.iconUrl ?? null);
  const [emptyBackground, setEmptyBackground] = useState<string | null>(
    initial?.emptyBackgroundColor ?? null,
  );
  const [storeText, setStoreText] = useState<string | null>(
    initial?.storeTextColor ?? null,
  );

  const [errors, setErrors] = useState<{ name?: string; kind?: string }>({});

  // The pair the preview below draws, measured live. `0114`'s rule: the shape
  // is the database's business and the legibility is this screen's.
  const ratio = contrastRatio(
    emptyBackground ?? "#f0eae1",
    storeText ?? "#1e1b18",
  );
  const readable = ratio >= 4.5;

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
        emptyIcon,
        iconUrl,
        emptyBackground,
        storeText,
      },
      {
        name: initial?.name ?? {},
        kindId: initial?.kindId ?? "",
        isActive: initial?.isActive ?? true,
        hasMenuNav: initial?.hasMenuNav ?? true,
        emptyIcon: initial?.emptyIcon ?? null,
        iconUrl: initial?.iconUrl ?? null,
        emptyBackground: initial?.emptyBackgroundColor ?? null,
        storeText: initial?.storeTextColor ?? null,
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
    };

    setErrors(found);
    if (found.name || found.kind) return;

    onSave({
      name,
      kindId,
      isActive,
      hasMenuNav,
      // Half-typed hex is not a colour and not an error either — it is somebody
      // mid-word. Anything that is not six digits is saved as "not set", which
      // is what the database's own shape check would otherwise refuse.
      emptyIcon,
      iconUrl,
      emptyBackgroundColor: isHex(emptyBackground) ? emptyBackground : null,
      storeTextColor: isHex(storeText) ? storeText : null,
    });
  }

  return (
    <EditorPage
      title={initial ? pickLocalized(initial.name) : t("categories.add")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("categories.tab")}
      /* Two columns — the words on the left, what it looks like on the right.
         See the grid below. */
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
       * What it is, and what it looks like.
       *
       * The form was four short controls in a 640pt column on a page with room
       * for twice that — a name, a select and two switches, then a screen of
       * nothing. The artwork it now carries is the natural other half: the left
       * column is the category as a *record*, the right is the category as
       * something a customer sees.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <LocalizedField
            label={t("categories.name")}
            value={name}
            onChange={setName}
            maxLength={TEXT.name}
            error={errors.name}
            format="sentence"
            placeholder={{ en: "Restaurants", ar: "مطاعم" }}
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
              options={kinds.map((kind) => ({
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

        <div className="flex min-w-0 flex-col gap-lg">
          {/* Says whose answers these are and, more importantly, that leaving
              them alone is a real answer — the app has its own table and a null
              here follows it. */}
          <div className="flex flex-col gap-xxs">
            <h3 className="ps-md text-[17px]">
              {t("categories.artworkSection")}
            </h3>
            <p className="ps-md text-[12px] text-text-faint">
              {t("categories.artworkSectionHint")}
            </p>
          </div>

          {/* The category's own mark, first — it is the one a customer meets,
              in the strip across the top of Home and Search. The two below it
              are about how a *shop* in this category is drawn when it has sent
              nothing of its own, which is a narrower question. */}
          <Field label={t("categories.icon")} hint={t("categories.iconHint")}>
            <ImageUploader
              value={iconUrl}
              onChange={setIconUrl}
              folder="category-art"
              disabled={pending}
            />
          </Field>

          <Field
            label={t("categories.emptyIcon")}
            hint={t("categories.emptyIconHint")}
          >
            <IconPicker
              value={emptyIcon}
              onChange={setEmptyIcon}
              disabled={pending}
            />
          </Field>

          <Field
            label={t("categories.emptyBackground")}
            hint={t("categories.emptyBackgroundHint")}
          >
            <ColorPicker
              value={emptyBackground}
              onChange={setEmptyBackground}
              // Sand, which is what an empty well is drawn as today when the
              // app has no tint for a slug. So the swatch shows what will
              // actually be used while nothing is picked.
              fallback="#f0eae1"
            />
          </Field>

          <Field
            label={t("categories.storeText")}
            hint={t("categories.storeTextHint")}
          >
            <ColorPicker
              value={storeText}
              onChange={setStoreText}
              fallback="#1e1b18"
              /* The pair, measured. Not a refusal: `0114` settled that the
                 database checks shape and the dashboard reports legibility,
                 because contrast is a property of two colours and only one of
                 them is on this field. */
              trailing={
                isHex(storeText) ? (
                  <span
                    className={cx(
                      "text-[12px]",
                      readable
                        ? "text-text-faint"
                        : "font-semibold text-danger",
                    )}
                  >
                    {readable
                      ? t("categories.contrast", { ratio: ratio.toFixed(1) })
                      : t("categories.contrastPoor")}
                  </span>
                ) : null
              }
            />
          </Field>

          {/* The two colours together, at the size they are actually read: the
              category's name over a ground, which is what a shop's page shows
              above its own name. A swatch pair says nothing about type. */}
          <Field label={t("categories.artworkPreview")}>
            <div
              className="flex items-center justify-center rounded-md px-lg py-xxl"
              style={{ background: emptyBackground ?? "#f0eae1" }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: storeText ?? "#1e1b18" }}
              >
                {pickLocalized(name) || t("categories.name")}
              </span>
            </div>
          </Field>
        </div>
      </div>
    </EditorPage>
  );
}
