"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field, cx } from "@/components/ui";
import { DateField } from "@/components/ui/date-field";
import { EditorPage } from "@/components/ui/editor-page";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalizedImageField } from "@/components/ui/localized-image-field";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";
import { FALLBACK_LANGUAGE, type Localized } from "@/lib/validation";

import {
  ARTWORK_FORMATS,
  PLACEMENTS,
  nextSortOrder,
  togglePlacement,
  type Artwork,
  type ArtworkDraft,
  type ArtworkFormat,
  type Placement,
} from "./api/artworks";
import {
  useArtworks,
  useCreateArtwork,
  useUpdateArtwork,
} from "./use-artworks";
import { usePromotions } from "./use-promotions";

const LIST_HREF = "/catalogue?tab=artworks";

/**
 * One picture, on a page of its own — the same shape as `PromotionEditor`,
 * which is where most of these fields lived until `0129`.
 *
 * `initialDiscountId` preselects the linked promotion, for the link in the
 * promotion editor that sends the operator here to add its picture.
 */
export function ArtworkEditor({
  id,
  initialDiscountId = null,
}: {
  id: string | null;
  initialDiscountId?: string | null;
}) {
  const router = useRouter();

  const artworks = useArtworks();
  const rows = artworks.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateArtwork();
  const update = useUpdateArtwork();

  const back = (focusId: string | null) => {
    const focus = focusId ? `&focus=${focusId}` : "";
    router.replace(`${LIST_HREF}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("artworks.edit")}
        backHref={LIST_HREF}
        backLabel={t("artworks.tab")}
      >
        {artworks.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="artworks.notFound" mood="lost" />
        )}
      </EditorPage>
    );
  }

  // A new one waits for the list too: where it goes in its format's order is
  // read from it, and guessing zero would put it first.
  if (!id && artworks.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-xxl text-[13px] text-text-faint">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      initialDiscountId={initialDiscountId}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => back(initial?.id ?? null);
        if (initial) {
          // Moving to the other format puts it at the end of that list — its
          // old position was among the other shape's pictures and means
          // nothing there.
          const others = rows.filter((row) => row.id !== initial.id);
          const patch =
            draft.format === initial.format
              ? draft
              : { ...draft, sortOrder: nextSortOrder(others, draft.format) };
          update.mutate(
            { id: initial.id, patch, confirm: true },
            { onSuccess: done },
          );
        } else {
          create.mutate(
            { draft, sortOrder: nextSortOrder(rows, draft.format) },
            { onSuccess: done },
          );
        }
      }}
      onCancel={() => back(initial?.id ?? null)}
    />
  );
}

function Form({
  initial,
  initialDiscountId,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Artwork;
  initialDiscountId: string | null;
  pending: boolean;
  onSave: (draft: ArtworkDraft) => void;
  onCancel: () => void;
}) {
  const promotions = usePromotions("");

  const start = {
    format: initial?.format ?? ("banner" as ArtworkFormat),
    imageUrl: initial?.imageUrl ?? null,
    // A new picture starts on Home, which is where every card has been shown
    // since `0053`.
    placements: initial?.placements ?? (["home"] as Placement[]),
    discountId: initial ? (initial.discount?.id ?? null) : initialDiscountId,
    startsAt: initial?.startsAt ?? null,
    endsAt: initial?.endsAt ?? null,
    isActive: initial?.isActive ?? true,
  };

  const [format, setFormat] = useState<ArtworkFormat>(start.format);
  const [imageUrl, setImageUrl] = useState<Localized | null>(start.imageUrl);
  const [placements, setPlacements] = useState<Placement[]>(start.placements);
  const [discountId, setDiscountId] = useState<string | null>(start.discountId);
  const [startsAt, setStartsAt] = useState<string | null>(start.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(start.endsAt);
  const [isActive, setIsActive] = useState(start.isActive);

  useUnsavedChanges(
    changed(
      { format, imageUrl, placements, discountId, startsAt, endsAt, isActive },
      start,
    ),
  );

  const [errors, setErrors] = useState<{ image?: string; window?: string }>({});

  /**
   * The promotions it can advertise: the live list, plus the one it already
   * points at if that has been archived since — otherwise the select would
   * show nothing and saving would look like it unlinks the picture.
   */
  const options = [
    { value: "", label: t("artworks.noPromotion") },
    ...(promotions.data ?? []).map((promotion) => ({
      value: promotion.id,
      label: promotion.slug,
    })),
    ...(initial?.discount?.archived
      ? [
          {
            value: initial.discount.id,
            label: t("artworks.archivedPromotionOption", {
              slug: initial.discount.slug,
            }),
          },
        ]
      : []),
  ];

  function submit() {
    const found = {
      // Required, and it means an English one: English is what every device
      // falls back to (`0128`), and `artworks_image_url_locales` refuses a
      // picture without it. Two messages, because "add a picture" to somebody
      // who added an Arabic one is not a thing they can act on.
      image: !imageUrl
        ? t("artworks.imageRequired")
        : !(imageUrl[FALLBACK_LANGUAGE] ?? "").trim()
          ? t("artworks.imageNeedsEnglish")
          : undefined,
      window:
        startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)
          ? t("artworks.windowBackwards")
          : undefined,
    };

    setErrors(found);
    if (found.image || found.window || !imageUrl) return;

    onSave({
      format,
      imageUrl,
      placements,
      discountId,
      startsAt,
      endsAt,
      isActive,
    });
  }

  return (
    <EditorPage
      title={
        initial ? t(`artworks.formats.${initial.format}`) : t("artworks.add")
      }
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("artworks.tab")}
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("artworks.save")}
          </Button>
        </>
      }
    >
      {/* The picture on the left — its shape and the files; where and when it
          is shown on the right. */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <Field label={t("artworks.format")} hint={t("artworks.formatHint")}>
            <FormatChoice
              value={format}
              onChange={setFormat}
              disabled={pending}
            />
          </Field>

          {/* One file per language, because the words are inside the picture.
              The expected shape is stated with it, since a banner cropped to a
              square or a tile stretched wide is the likeliest way to get this
              wrong. */}
          <LocalizedImageField
            label={t("images.label")}
            hint={t(`artworks.imageHint.${format}`)}
            value={imageUrl}
            onChange={setImageUrl}
            folder="artwork"
            disabled={pending}
            error={errors.image}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-lg">
          <Field
            label={t("artworks.promotion")}
            hint={t("artworks.promotionHint")}
          >
            <Select
              value={discountId ?? ""}
              onChange={(next) => setDiscountId(next === "" ? null : next)}
              options={options}
              disabled={pending || !promotions.isSuccess}
            />
          </Field>

          <Field
            label={t("artworks.placement")}
            hint={t("artworks.placementHint")}
          >
            {/* One switch per screen — the answers are not exclusive, and each
                is independently on or off. Moved here from the promotion
                editor by `0129`, because a promotion with a banner on Home and
                a tile in the basket is two answers to "where". */}
            <div className="flex flex-col gap-md">
              {PLACEMENTS.map((option) => (
                <div
                  key={option}
                  className="flex items-start justify-between gap-lg rounded-md border border-border bg-surface px-lg py-md"
                >
                  <span className="flex min-w-0 flex-col gap-xxs">
                    <span className="text-[14px] font-semibold text-text">
                      {t(`artworks.placements.${option}`)}
                    </span>
                    <span className="text-[12px] text-text-faint">
                      {t(`artworks.placementsHint.${option}`)}
                    </span>
                  </span>

                  <Toggle
                    on={placements.includes(option)}
                    onChange={() =>
                      setPlacements((current) =>
                        togglePlacement(current, option),
                      )
                    }
                    labelOn={t("artworks.placementOn")}
                    labelOff={t("artworks.placementOff")}
                    className="w-[104px] shrink-0"
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* Side by side, as in `PromotionEditor` — see the note there on why
              it is a container query and why 32rem. */}
          <div className="@container">
            <div className="grid grid-cols-1 items-start gap-lg @[32rem]:grid-cols-2">
              <Field
                label={t("artworks.startsAt")}
                hint={t("artworks.startsHint")}
              >
                <DateField value={startsAt} onChange={setStartsAt} />
              </Field>

              <Field
                label={t("artworks.endsAt")}
                hint={t("artworks.endsHint")}
                error={errors.window}
              >
                <DateField value={endsAt} onChange={setEndsAt} />
              </Field>
            </div>
          </div>

          <Field
            label={t("artworks.visibility")}
            hint={t("artworks.visibilityHint")}
          >
            {/* A plain switch: nothing is published until Save. See the same
                note in `PromotionEditor`. */}
            <Toggle
              on={isActive}
              onChange={() => setIsActive((current) => !current)}
              labelOn={t("artworks.live")}
              labelOff={t("artworks.hidden")}
            />
          </Field>
        </div>
      </div>
    </EditorPage>
  );
}

/**
 * Banner or tile, as two buttons side by side.
 *
 * Not a select: there are two answers, both fit, and seeing the other one is
 * what tells the operator there was a choice at all.
 */
function FormatChoice({
  value,
  onChange,
  disabled,
}: {
  value: ArtworkFormat;
  onChange: (next: ArtworkFormat) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t("artworks.format")}
      className="flex gap-sm"
    >
      {ARTWORK_FORMATS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cx(
              "flex flex-1 flex-col items-start gap-xxs rounded-md border px-lg py-md text-left",
              selected
                ? "border-primary bg-primary-wash"
                : "border-border bg-surface hover:bg-neutral-fill",
              disabled && "opacity-60",
            )}
          >
            <span
              className={cx(
                "text-[14px] font-semibold",
                selected ? "text-primary" : "text-text",
              )}
            >
              {t(`artworks.formats.${option}`)}
            </span>
            <span className="text-[12px] text-text-faint">
              {t(`artworks.formatNotes.${option}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
