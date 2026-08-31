"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Field } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { MultiSelect } from "@/components/ui/select";
import { ImageUploader } from "@/components/ui/image-uploader";

import { ItemOptions } from "./item-options";
import { TagChip } from "./tag-chip";
import { useTagVocabulary } from "./use-tags";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import type { Localized } from "@/lib/validation";
import {
  validateLocalizedText,
  validatePrice,
  type Valid,
} from "@/lib/validation";

export type ItemDraft = {
  name: Localized;
  description: Localized;
  /** Minor units, as an integer. Never a float — see `lib/money.ts`. */
  price: number;
  isActive: boolean;
  /** A Storage URL, or null for no picture. */
  imageUrl: string | null;
  /**
   * The chips this dish carries, as ids into the shared vocabulary.
   *
   * The vocabulary is edited on the catalogue's Tags tab, not here — a tag is a
   * property of the whole app, and a form that could invent one would be four
   * spellings of "Spicy" waiting to happen. This form only says which of the
   * existing ones apply.
   */
  tagIds: string[];
};

/**
 * The form that adds or edits an item, in the side panel.
 *
 * ## Why a panel rather than the row itself
 *
 * The flow study called for editing in place, and this replaces that. An item
 * carries more than a row can hold without pushing the list around: two
 * languages of name, two of description, a price, a slug, a switch — and
 * eventually an image. Growing a row to fit all of that reflows every row below
 * it, so the list the operator was reading moves under them each time they open
 * one.
 *
 * The panel keeps what mattered about the inline idea and drops what did not:
 * **the section stays on screen beside the form**, which is the context that
 * says whether the thing being added belongs there, and "save and add another"
 * still leaves the operator exactly where they are. What is lost is editing
 * literally within the row, which was never the point — not losing your place
 * was.
 *
 * It also means one shell pattern: detail opens beside the list here exactly as
 * an order's receipt does.
 *
 * ## There is no slug field
 *
 * A slug is a key, not content — nobody using the app ever sees one. It exists
 * so an import file has something stable to join on, and the database fills it
 * from the English name (migration 0070).
 *
 * Generating it here was the first attempt and could not do the part that
 * matters: make it **unique without racing**. Checking whether a slug is taken
 * and then inserting is two round trips with a gap in the middle, and the gap is
 * where two tabs both decide `kibbeh-plate` is free. A trigger runs inside the
 * insert's own transaction.
 */
export function MenuItemEditor({
  storeId,
  itemId,
  sectionId,
  initial,
  pending,
  error,
  onSave,
  onSaveAndAnother,
  onCancel,
}: {
  initial?: Partial<ItemDraft>;
  pending: boolean;
  error?: string | null;
  onSave: (draft: ItemDraft) => void;
  /** Absent when editing: "add another" only means something while adding. */
  onSaveAndAnother?: (draft: ItemDraft) => void;
  /** Where this dish lives, so the options link can open on it. */
  storeId: string;
  itemId: string | null;
  sectionId: string;
  onCancel: () => void;
}) {
  const languages = useLanguages();

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [description, setDescription] = useState<Localized>(
    initial?.description ?? {},
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);

  const tags = useTagVocabulary();

  /**
   * One message per field, not one for the form.
   *
   * The first version collected the *first* failure and printed it at the
   * bottom of the panel — so "This is required." sat under the visibility
   * switch while the empty field it was about had scrolled off the top. A
   * message detached from its field is barely a message: the operator is told
   * something is wrong and left to find out what.
   *
   * Every field is checked, not just up to the first failure. Reporting one
   * problem at a time turns a form into a queue of round trips, and the
   * operator fixes a name only to be told about a price.
   */
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    price?: string;
  }>({});

  const codes = languages.data?.map((language) => language.code) ?? [];

  /**
   * After a failed save, take the operator to the first problem.
   *
   * The panel scrolls, so a message can be perfectly well attached to its field
   * and still be invisible — which is what the screenshot showed: the empty
   * name had scrolled off the top while the form reported it at the bottom.
   * Marking the field is not enough if the field is not on screen.
   *
   * Focus as well as scroll, so a screen reader lands on the control and reads
   * the error `aria-describedby` points at — the same journey, by another
   * route.
   */
  const form = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);

  useEffect(() => {
    if (attempt.current === 0) return;
    const first = form.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!first) return;
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    first.focus({ preventScroll: true });
  }, [errors]);

  function build(): ItemDraft | null {
    const parsed = price.trim() === "" ? NaN : Number(price);

    const found = {
      name: messageOf(validateLocalizedText(name, codes, TEXT.name)),
      description: messageOf(
        validateLocalizedText(description, codes, TEXT.description, {
          optional: true,
        }),
      ),
      price: messageOf(validatePrice(Number.isFinite(parsed) ? parsed : NaN)),
    };

    setErrors(found);
    // Bumped every attempt, so two identical failures still scroll — without
    // it, pressing Save twice on the same empty field would change nothing and
    // the effect would not run.
    attempt.current += 1;

    if (found.name || found.description || found.price) return null;
    return { name, description, price: parsed, isActive, imageUrl, tagIds };
  }

  return (
    // `flex-1 min-h-0`, not `h-full`.
    //
    // This sits in a flex column that already has a header above it, so
    // `h-full` asked for the panel's whole height *in addition to* that header
    // — the total overflowed and the button row fell out of the bottom of the
    // panel. `flex-1` claims what is left instead, and `min-h-0` is what lets
    // it shrink below its content so the scrolling happens inside.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={form}
        className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl"
      >
        <div className="flex flex-col gap-lg">
          <LocalizedField
            label={t("menu.name")}
            value={name}
            onChange={setName}
            // One example per language. An English example above an Arabic
            // input shows the wrong script in the wrong direction, and hints
            // that English is what belongs there.
            placeholder={{
              en: t("menu.namePlaceholder"),
              ar: t("menu.namePlaceholderAr"),
            }}
            hint={t("menu.nameHint")}
            error={errors.name}
            maxLength={TEXT.name}
          />
          <LocalizedField
            label={t("menu.description")}
            value={description}
            onChange={setDescription}
            placeholder={{
              en: t("menu.descriptionPlaceholder"),
              ar: t("menu.descriptionPlaceholderAr"),
            }}
            multiline
            optional
            hint={t("menu.descriptionHint")}
            error={errors.description}
            maxLength={TEXT.description}
          />
        </div>

        <div className="flex w-full flex-col gap-lg">
          <Field
            label={t("menu.price")}
            hint={t("menu.priceHint")}
            error={errors.price}
          >
            <NumberInput
              min={0}
              step={1}
              placeholder={t("menu.pricePlaceholder")}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </Field>

          {/* Beside the price rather than down with the options, because a tag
              is part of what the dish *is* — the same kind of fact as its name
              — whereas the options are a set of questions it asks. */}
          <Field
            label={t("tags.itemLabel")}
            hint={
              tags.isSuccess && tags.data.length === 0
                ? t("tags.itemNone")
                : t("tags.itemHint")
            }
          >
            <MultiSelect
              value={tagIds}
              onChange={setTagIds}
              placeholder={t("tags.itemPlaceholder")}
              disabled={pending || !tags.isSuccess}
              options={(tags.data ?? []).map((tag) => ({
                value: tag.id,
                // The label is what typing filters on and what a screen reader
                // reads; the chip is what the eye picks out of a list of five.
                label: pickLocalized(tag.name),
                render: (
                  <TagChip tone={tag.tone} label={pickLocalized(tag.name)} />
                ),
              }))}
            />
          </Field>

          {/* Last, and deliberately.
              The name and the price are what an item *is*; a picture is how it
              is sold. Putting it first makes the form open on the slowest,
              most optional thing in it — and an operator adding forty items in
              an afternoon would meet the upload box forty times before the
              field they came to fill in. */}
          <Field label={t("images.label")} hint={t("images.hint")}>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="menu-items"
              disabled={pending}
            />
          </Field>

          {/* After the fields that say what the dish *is*, and separated,
              because these are a different kind of edit: they change the shop's
              own list of questions, not this row. */}
          <div className="flex flex-col gap-lg border-t border-border pt-lg">
            <Field label={t("options.title")} hint={t("options.hint")}>
              <ItemOptions
                storeId={storeId}
                itemId={itemId}
                sectionId={sectionId}
              />
            </Field>
          </div>

          <Field
            label={t("menu.visibility")}
            hint={isActive ? t("menu.liveHint") : t("menu.hiddenHint")}
          >
            <Toggle
              on={isActive}
              onChange={() => setIsActive((current) => !current)}
              labelOn={t("menu.live")}
              labelOff={t("menu.hidden")}
            />
          </Field>
        </div>

        {/* Only what belongs to no field — a refusal from the server. Anything
            about a value appears beside that value. */}
        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      {/* Pinned, not scrolled with the fields. On a long form the operator
          should never have to scroll to find Save. */}
      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        {onSaveAndAnother && (
          <Button
            variant="primary-quiet"
            pending={pending}
            onClick={() => {
              const draft = build();
              if (draft) onSaveAndAnother(draft);
            }}
          >
            {t("menu.saveAndAnother")}
          </Button>
        )}
        <Button
          pending={pending}
          onClick={() => {
            const draft = build();
            if (draft) onSave(draft);
          }}
        >
          {t("menu.save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * A failure's sentence, or nothing when it passed.
 *
 * The validator hands back a key; the screen turns it into words. That split is
 * what keeps validation messages inside the translation bundle with every other
 * string, rather than being the one class of user-facing text that never went
 * through `t()`.
 */
function messageOf(result: Valid): string | undefined {
  return result.ok ? undefined : t(result.key, result.params);
}
