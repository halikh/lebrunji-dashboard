"use client";

import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import type { Localized } from "@/lib/validation";
import {
  firstFailure,
  validateLocalizedText,
  validatePrice,
  validateSlug,
} from "@/lib/validation";

export type ItemDraft = {
  slug: string;
  name: Localized;
  description: Localized;
  /** Minor units, as an integer. Never a float — see `lib/money.ts`. */
  price: number;
  isActive: boolean;
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
 * ## The slug follows the name, until it does not
 *
 * Nobody wants to type a slug, and it is only ever seen by an import file — but
 * it is the key that file joins on, so it cannot be generated silently and then
 * change when a name is corrected. So it is derived while untouched, and stops
 * the moment somebody edits it. The hint says which it is doing.
 */
export function MenuItemEditor({
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
  onCancel: () => void;
}) {
  const languages = useLanguages();

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [description, setDescription] = useState<Localized>(
    initial?.description ?? {},
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [shown, setShown] = useState<string | null>(null);

  const codes = languages.data?.map((language) => language.code) ?? [];
  const effectiveSlug = slugEdited
    ? slug
    : slugify(name.en ?? firstValue(name));

  function build(): ItemDraft | null {
    const parsed = Number(price);
    const problem = firstFailure([
      validateSlug(effectiveSlug),
      validateLocalizedText(name, codes, TEXT.name),
      validateLocalizedText(description, codes, TEXT.description, {
        optional: true,
      }),
      validatePrice(Number.isFinite(parsed) ? parsed : NaN),
    ]);

    if (!problem.ok) {
      setShown(problem.message);
      return null;
    }

    setShown(null);
    return { slug: effectiveSlug, name, description, price: parsed, isActive };
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <div className="flex flex-col gap-lg">
          <LocalizedField
            label={t("menu.name")}
            value={name}
            onChange={setName}
            maxLength={TEXT.name}
          />
          <LocalizedField
            label={t("menu.description")}
            value={description}
            onChange={setDescription}
            multiline
            optional
            maxLength={TEXT.description}
          />
        </div>

        <div className="flex w-full flex-col gap-lg">
          <Field id="price" label={t("menu.price")}>
            <Input
              id="price"
              // `inputMode` rather than `type="number"`: a number input adds
              // spinners nobody wants on a price and, on some browsers, lets a
              // scroll wheel change the value of a field somebody is only
              // passing over.
              inputMode="numeric"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value.replace(/[^\d-]/g, ""))
              }
              className="text-right tabular-nums"
            />
          </Field>

          <Field id="slug" label={t("menu.slug")} hint={t("menu.slugHint")}>
            <Input
              id="slug"
              value={effectiveSlug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
            />
          </Field>

          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("menu.live")}
            labelOff={t("menu.hidden")}
          />
        </div>

        {(shown || error) && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {shown ?? error}
          </p>
        )}
      </div>

      {/* Pinned, not scrolled with the fields. On a long form the operator
          should never have to scroll to find Save. */}
      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="quiet" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        {onSaveAndAnother && (
          <Button
            variant="secondary"
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
 * A slug from a name.
 *
 * Latin letters and digits only, which means an Arabic-only name produces
 * nothing and the operator has to type one. That is the honest outcome:
 * transliterating Arabic is a guess, and a wrong guess becomes the key an
 * import file joins on.
 */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      // Strip the accents `NFD` just separated, so "café" becomes "cafe" rather
      // than losing the letter entirely.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      // Cut to length *before* trimming, not after. Trimming first and slicing
      // second can leave the cut landing on a separator — `some-long-name-` —
      // which `validateSlug` then refuses, so the form would reject a slug it
      // generated itself.
      .slice(0, 64)
      .replace(/^-+|-+$/g, "")
  );
}

function firstValue(value: Localized): string {
  for (const candidate of Object.values(value)) {
    if (candidate?.trim()) return candidate;
  }
  return "";
}
