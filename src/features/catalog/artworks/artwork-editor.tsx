"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Checkbox,
  Field,
  Section,
  Switch,
  cx,
} from "@/components/ui";
import { DateField } from "@/components/ui/date-field";
import { ImagePrompt } from "@/components/ui/image-prompt";
import { LocalizedField } from "@/components/ui/localized-field";
import { LocalizedImageField } from "@/components/ui/localized-image-field";
import { Select } from "@/components/ui/select";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { ARTWORK_SHAPES, fitsShape, measureImage } from "@/lib/image-shape";
import { TEXT } from "@/lib/limits";
import {
  FALLBACK_LANGUAGE,
  validateLocalizedText,
  type Localized,
} from "@/lib/validation";

import {
  ARTWORK_FORMATS,
  PLACEMENTS,
  artworkState,
  nextSortOrder,
  togglePlacement,
  type Artwork,
  type ArtworkDraft,
  type ArtworkFormat,
  type Placement,
} from "../api/artworks";
import { NO_LINK, missingTarget, type TapLink } from "../api/links";
import { EditorLayout, EditorPlaceholder } from "../promotions/editor-layout";
import { LinkFields, useLinkDescription } from "../promotions/link-fields";
import { describeDates, useNow, windowBackwards } from "../promotions/schedule";
import {
  useArtworks,
  useCreateArtwork,
  useUpdateArtwork,
} from "../use-artworks";
import { useBundles } from "../use-bundles";
import { usePromotions } from "../use-promotions";
import { ShopMultiSelect } from "../shops/shop-select";
import { ARTWORK_TONE, artworkName } from "./artwork-status";

const LIST_HREF = "/artworks";

/** What a picture advertises — `artworks.discount_id`, `bundle_id`, or neither. */
type Subject = "none" | "promotion" | "bundle";

/**
 * One picture, on a page of its own.
 *
 * `initialDiscountId` / `initialBundleId` preselect what it advertises, for the
 * links in the promotion and bundle editors that send the operator here to add
 * their picture.
 */
export function ArtworkEditor({
  id,
  initialDiscountId = null,
  initialBundleId = null,
}: {
  id: string | null;
  initialDiscountId?: string | null;
  initialBundleId?: string | null;
}) {
  const router = useRouter();
  const artworks = useArtworks();
  const rows = artworks.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateArtwork();
  const update = useUpdateArtwork();

  if (id && !initial) {
    return (
      <EditorPlaceholder
        state={
          artworks.isPending
            ? "pending"
            : artworks.isError
              ? "error"
              : "missing"
        }
        title={t("artworks.edit")}
        notFound={t("artworks.notFound")}
        onRetry={() => void artworks.refetch()}
      />
    );
  }

  // A new one waits for the list too: where it goes in its format's order is
  // read from it, and guessing zero would put it first.
  if (!id && artworks.isPending) {
    return (
      <EditorPlaceholder
        state="pending"
        title={t("artworks.add")}
        notFound={null}
      />
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      initialDiscountId={initialDiscountId}
      initialBundleId={initialBundleId}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const done = () => router.replace(LIST_HREF);
        if (initial) {
          // Moving to the other format puts it at the end of that list — its
          // old position was among the other shape's pictures.
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
    />
  );
}

function Form({
  initial,
  initialDiscountId,
  initialBundleId,
  pending,
  onSave,
}: {
  initial?: Artwork;
  initialDiscountId: string | null;
  initialBundleId: string | null;
  pending: boolean;
  onSave: (draft: ArtworkDraft) => void;
}) {
  const promotions = usePromotions("");
  const bundles = useBundles("");
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const now = useNow();

  const start = {
    format: initial?.format ?? ("banner" as ArtworkFormat),
    imageUrl: initial?.imageUrl ?? null,
    altText: initial?.altText ?? ({} as Localized),
    // A new picture starts on Home, where every card has been shown since
    // `0053`.
    placements: initial?.placements ?? (["home"] as Placement[]),
    discountId: initial ? (initial.discount?.id ?? null) : initialDiscountId,
    bundleId: initial ? (initial.bundle?.id ?? null) : initialBundleId,
    startsAt: initial?.startsAt ?? null,
    endsAt: initial?.endsAt ?? null,
    isActive: initial?.isActive ?? true,
    storeIds: initial?.storeIds ?? [],
    link: initial?.link ?? NO_LINK,
  };

  const [format, setFormat] = useState<ArtworkFormat>(start.format);
  const [imageUrl, setImageUrl] = useState<Localized | null>(start.imageUrl);
  const [altText, setAltText] = useState<Localized>(start.altText);
  const [placements, setPlacements] = useState<Placement[]>(start.placements);
  const [discountId, setDiscountId] = useState<string | null>(start.discountId);
  const [bundleId, setBundleId] = useState<string | null>(start.bundleId);
  // One question with one answer — the table takes one
  // (`artworks_one_subject`). The picker for the answer follows it.
  const [subject, setSubject] = useState<Subject>(
    start.discountId ? "promotion" : start.bundleId ? "bundle" : "none",
  );
  const linkedDeal = Boolean(discountId || bundleId);
  const [startsAt, setStartsAt] = useState<string | null>(start.startsAt);
  const [endsAt, setEndsAt] = useState<string | null>(start.endsAt);
  const [isActive, setIsActive] = useState(start.isActive);
  const [storeIds, setStoreIds] = useState<string[]>(start.storeIds);
  const [link, setLink] = useState<TapLink>(start.link);

  const dirty = changed(
    {
      format,
      imageUrl,
      altText,
      placements,
      discountId,
      bundleId,
      startsAt,
      endsAt,
      isActive,
      storeIds,
      link,
    },
    start,
  );
  useUnsavedChanges(dirty);

  const [errors, setErrors] = useState<{
    subject?: string;
    image?: string;
    altText?: string;
    window?: string;
    link?: string;
  }>({});

  // The deal it advertises, for its dates and destination — a linked picture
  // runs on both. Null for an archived one the lists omit.
  const promotion = discountId
    ? ((promotions.data ?? []).find((one) => one.id === discountId) ?? null)
    : null;
  const bundle = bundleId
    ? ((bundles.data ?? []).find((one) => one.id === bundleId) ?? null)
    : null;

  // Called unconditionally — it is a hook — and shown only when linked.
  const inherited = useLinkDescription(promotion?.link ?? NO_LINK);

  // The live lists, plus the one it already points at if archived since —
  // otherwise the select would show nothing and saving would look like it
  // unlinks the picture.
  const promotionOptions = [
    ...(promotions.data ?? []).map((one) => ({
      value: one.id,
      label: one.slug,
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
  const bundleOptions = [
    ...(bundles.data ?? []).map((one) => ({
      value: one.id,
      label: pickLocalized(one.name),
      detail: one.storeName,
    })),
    ...(initial?.bundle?.archived
      ? [
          {
            value: initial.bundle.id,
            label: t("artworks.archivedBundleOption", {
              name: pickLocalized(initial.bundle.name),
            }),
          },
        ]
      : []),
  ];

  // While the pictures are measured on Save.
  const [checking, setChecking] = useState(false);

  /**
   * The languages whose picture is the wrong shape for the chosen format.
   *
   * The uploader refuses a wrong file, but not one that was right when it went
   * in: switching Banner to Tile keeps the banners. So the saved pictures are
   * measured again against the format being saved. One that cannot be loaded
   * right now is not counted — see `measureImage`.
   */
  async function wrongShapes(urls: Localized): Promise<string[]> {
    const shape = ARTWORK_SHAPES[format];
    const results = await Promise.all(
      Object.entries(urls).map(async ([code, url]) => {
        const size = url.trim() ? await measureImage(url) : null;
        return size && !fitsShape(size, shape) ? code : null;
      }),
    );
    return results.filter((code): code is string => code !== null);
  }

  async function submit() {
    if (checking) return;
    const found = {
      // English is required: every device falls back to it (`0128`).
      image: !imageUrl
        ? t("artworks.imageRequired")
        : !(imageUrl[FALLBACK_LANGUAGE] ?? "").trim()
          ? t("artworks.imageNeedsEnglish")
          : undefined,
      // Only for a picture with dates of its own — a linked one has none.
      window:
        !linkedDeal && windowBackwards(startsAt, endsAt)
          ? t("artworks.windowBackwards")
          : undefined,
      altText: (() => {
        const check = validateLocalizedText(altText, codes, TEXT.altText, {
          optional: true,
        });
        return check.ok ? undefined : t(check.key, check.params);
      })(),
      link: missingTarget(link) ? t("links.targetRequired") : undefined,
      // "A promotion" with none chosen is not "nothing" — said, not guessed.
      subject:
        subject === "promotion" && !discountId
          ? t("artworks.pickPromotion")
          : subject === "bundle" && !bundleId
            ? t("artworks.pickBundle")
            : undefined,
    };

    if (!found.image && imageUrl) {
      setChecking(true);
      const wrong = await wrongShapes(imageUrl).finally(() =>
        setChecking(false),
      );
      if (wrong.length > 0) {
        const shape = ARTWORK_SHAPES[format];
        found.image = t("artworks.imageWrongShape", {
          languages: wrong.join(", "),
          shape: `${shape.width}:${shape.height}`,
        });
      }
    }

    setErrors(found);
    if (
      found.image ||
      found.altText ||
      found.window ||
      found.link ||
      found.subject ||
      !imageUrl
    ) {
      return;
    }

    onSave({
      format,
      imageUrl,
      altText,
      placements,
      discountId,
      bundleId,
      // Null whenever linked — `artworks_linked_has_no_window`. The form keeps
      // what was typed while a link is tried on and off, but a linked picture
      // is never saved with dates.
      startsAt: linkedDeal ? null : startsAt,
      endsAt: linkedDeal ? null : endsAt,
      isActive,
      // Only meaningful with the shop page on; cleared without it, so turning
      // the placement back on later does not resurrect a forgotten choice.
      storeIds: placements.includes("store") ? storeIds : [],
      link,
    });
  }

  const state = initial ? artworkState(initial, now) : null;
  const dealWindow = bundle ?? promotion;

  return (
    <EditorLayout
      dirty={dirty}
      title={initial ? artworkName(initial) : t("artworks.add")}
      description={
        initial
          ? t(`artworks.formats.${initial.format}`)
          : t("artworks.newDescription")
      }
      meta={
        state ? (
          <Badge tone={ARTWORK_TONE[state]} dot>
            {t(`artworks.status.${state}`)}
          </Badge>
        ) : undefined
      }
      footer={
        <>
          <Button asChild variant="secondary" disabled={pending}>
            <Link href={LIST_HREF}>{t("common.cancel")}</Link>
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            pending={pending || checking}
            disabled={!dirty}
          >
            {initial ? t("artworks.save") : t("artworks.create")}
          </Button>
        </>
      }
      aside={
        <>
          <Section
            title={t("artworks.whenSection")}
            bodyClassName="flex flex-col gap-4"
          >
            <Field
              label={t("artworks.subject")}
              hint={t("artworks.subjectHint")}
            >
              {(wiring) => (
                <Select
                  {...wiring}
                  value={subject}
                  onChange={(next) => {
                    setSubject(next as Subject);
                    // Switching what it advertises lets go of the old one.
                    setDiscountId(null);
                    setBundleId(null);
                    setErrors((current) => ({
                      ...current,
                      subject: undefined,
                    }));
                  }}
                  options={(["none", "promotion", "bundle"] as Subject[]).map(
                    (value) => ({
                      value,
                      label: t(`artworks.subjects.${value}`),
                    }),
                  )}
                  disabled={pending}
                />
              )}
            </Field>

            {subject === "promotion" && (
              <Field
                label={t("artworks.promotion")}
                hint={t("artworks.promotionHint")}
                error={errors.subject}
              >
                {(wiring) => (
                  <Select
                    {...wiring}
                    value={discountId ?? ""}
                    onChange={(next) => setDiscountId(next || null)}
                    options={promotionOptions}
                    placeholder={t("artworks.pickPromotionPlaceholder")}
                    disabled={pending || !promotions.isSuccess}
                  />
                )}
              </Field>
            )}

            {subject === "bundle" && (
              <Field
                label={t("artworks.bundle")}
                hint={t("artworks.bundleHint")}
                error={errors.subject}
              >
                {(wiring) => (
                  <Select
                    {...wiring}
                    value={bundleId ?? ""}
                    onChange={(next) => setBundleId(next || null)}
                    options={bundleOptions}
                    placeholder={t("artworks.pickBundlePlaceholder")}
                    disabled={pending || !bundles.isSuccess}
                  />
                )}
              </Field>
            )}

            {/* A linked picture has no dates of its own (`0136`) — it runs on
                its deal's, said here in place of the two fields. */}
            {linkedDeal ? (
              <p className="rounded-md bg-subtle px-3 py-2.5 text-[13px] text-ink-2">
                {dealWindow && (dealWindow.startsAt || dealWindow.endsAt)
                  ? t(
                      bundleId
                        ? "artworks.runsOnBundle"
                        : "artworks.runsOnPromotion",
                      {
                        window: describeDates(dealWindow, {
                          between: "artworks.between",
                          until: "artworks.until",
                          from: "artworks.startsFrom",
                          always: "artworks.always",
                        }),
                      },
                    )
                  : t(
                      bundleId
                        ? "artworks.runsOnBundleOpen"
                        : "artworks.runsOnPromotionOpen",
                    )}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
                  <DateField
                    value={endsAt}
                    onChange={setEndsAt}
                    invalid={Boolean(errors.window)}
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* Where a tap leads — `0137`. A linked picture with none of its own
              follows its promotion's, and the hint says what that is. */}
          <Section title={t("artworks.tapSection")}>
            <LinkFields
              value={link}
              onChange={setLink}
              disabled={pending}
              error={errors.link}
              hint={
                discountId && link.kind === null
                  ? t("artworks.followsPromotion", { destination: inherited })
                  : bundleId && link.kind === null
                    ? t("artworks.followsBundle")
                    : undefined
              }
            />
          </Section>
        </>
      }
    >
      <Section
        title={t("artworks.pictureSection")}
        bodyClassName="flex flex-col gap-5"
      >
        <Field label={t("artworks.format")} hint={t("artworks.formatHint")}>
          <FormatChoice
            value={format}
            onChange={setFormat}
            disabled={pending}
          />
        </Field>

        {/* One file per language, because the words are inside the picture.
            The expected shape is stated with it — a banner cropped to a tile
            is the likeliest way to get this wrong. */}
        <LocalizedImageField
          label={t("images.label")}
          hint={t(`artworks.imageHint.${format}`)}
          value={imageUrl}
          onChange={setImageUrl}
          folder="artwork"
          shape={ARTWORK_SHAPES[format]}
          disabled={pending}
          error={errors.image}
        />
        {/* One prompt, not one per language: the Arabic picture is the same
            image with its words redone, which the panel's last step asks for. */}
        <ImagePrompt kind={format} subject={altText.en ?? ""} />

        <LocalizedField
          label={t("artworks.altText")}
          hint={t("artworks.altTextHint")}
          value={altText}
          onChange={setAltText}
          maxLength={TEXT.altText}
          optional
          error={errors.altText}
          placeholder={{ en: "20% off at Forno", ar: "خصم 20% في فورنو" }}
        />

        <div className="rounded-lg border border-line p-4">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            label={t("artworks.visibility")}
            description={t("artworks.visibilityHint")}
            disabled={pending}
          />
        </div>
      </Section>

      <Section
        title={t("artworks.whereSection")}
        description={t("artworks.placementHint")}
        bodyClassName="flex flex-col gap-5"
      >
        {/* One checkbox per screen — the answers are not exclusive. Two to a
            row where there is room: there are fifteen. */}
        <fieldset>
          <legend className="sr-only">{t("artworks.placement")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PLACEMENTS.map((option) => {
              const on = placements.includes(option);
              return (
                <div
                  key={option}
                  className={cx(
                    "rounded-md border px-3 py-2.5 transition-colors",
                    on
                      ? "border-accent/30 bg-accent-soft/50"
                      : "border-line bg-surface",
                  )}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={() =>
                      setPlacements((current) =>
                        togglePlacement(current, option),
                      )
                    }
                    label={t(`artworks.placements.${option}`)}
                    description={t(`artworks.placementsHint.${option}`)}
                    disabled={pending}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        {placements.length === 0 && (
          <p className="text-[13px] text-warning-ink">{t("artworks.draft")}</p>
        )}

        {/* Which shops' pages — `artwork_stores`. Only while the shop page is
            one of the screens; empty is every shop, which the placeholder
            says rather than leaving a blank box to interpret. */}
        {placements.includes("store") && (
          <Field
            label={t("artworks.storesLabel")}
            hint={t("artworks.storesHint")}
          >
            {(wiring) => (
              <ShopMultiSelect
                {...wiring}
                value={storeIds}
                onChange={setStoreIds}
                placeholder={t("artworks.storesPlaceholder")}
                disabled={pending}
              />
            )}
          </Field>
        )}
      </Section>
    </EditorLayout>
  );
}

/**
 * Banner or tile, as two cards side by side — two answers that both fit, and
 * seeing the other one is what says there was a choice.
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
      className="grid grid-cols-2 gap-2"
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
              "flex items-center gap-3 rounded-md border px-3 py-2.5 text-start transition-colors disabled:opacity-60",
              selected
                ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--color-accent)]"
                : "border-line-strong bg-surface hover:bg-hover",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "shrink-0 rounded-[3px] border-2",
                selected ? "border-accent" : "border-ink-4",
                option === "banner" ? "h-4 w-9" : "h-6 w-5",
              )}
            />
            <span className="flex min-w-0 flex-col">
              <span
                className={cx(
                  "text-[14px] font-medium",
                  selected ? "text-accent-ink" : "text-ink",
                )}
              >
                {t(`artworks.formats.${option}`)}
              </span>
              <span className="text-[12px] text-ink-3">
                {t(`artworks.formatNotes.${option}`)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
