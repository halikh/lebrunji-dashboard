"use client";

import { useId } from "react";

import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import { ImageUploader } from "./image-uploader";
import { cx } from "./index";

/**
 * One picture per language.
 *
 * ## Why a picture is ever translated
 *
 * Almost none are. A photograph of a dish is the dish in every language, which
 * is why `menu_items.image_url` is a plain column and always will be.
 *
 * A promotion's card is the exception, and `0013` is the reason: it dropped
 * every text column a discount had, on the grounds that the card **is** the
 * artwork — the words are inside the picture. So one file cannot serve two
 * languages, and an Arabic customer looking at an English card is not a
 * translation gap, it is an advert they cannot read.
 *
 * ## The same shape `LocalizedField` has, for the same reasons
 *
 * The list comes from the `languages` table rather than a constant, so a third
 * language is a row rather than a release. Both are required or neither is:
 * `discounts_image_url_locales` refuses a half-filled object, so a form that
 * let one through would submit and come back with a constraint name the
 * operator can do nothing with. Naming the missing language here is the whole
 * difference between that and "still needed in: ar".
 *
 * ## Null means "no card", `{}` means nothing
 *
 * Clearing every language collapses the value to null rather than to an empty
 * object, because null is the state the column actually has for a promotion
 * with no artwork — and `{}` is the one shape the constraint refuses outright.
 */
export function LocalizedImageField({
  label,
  value,
  onChange,
  folder,
  hint,
  error,
  disabled = false,
}: {
  label: string;
  /** Both languages, or null for no picture at all. */
  value: Localized | null;
  onChange: (value: Localized | null) => void;
  folder: "menu-items" | "stores" | "promotions";
  hint?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const id = useId();
  const languages = useLanguages();

  if (!languages.data) {
    // A skeleton, not one uploader with the rest arriving later: somebody
    // should not start choosing a file into a form that is about to change
    // shape under them.
    return (
      <div className="flex flex-col gap-xs">
        <span className="ps-md text-[13px] font-semibold text-text-soft">
          {label}
        </span>
        <div aria-hidden className="h-[120px] rounded-md bg-neutral-fill" />
      </div>
    );
  }

  const filled = languages.data.filter(
    (language) => (value?.[language.code] ?? "").trim().length > 0,
  );
  const missing = languages.data
    .filter((language) => (value?.[language.code] ?? "").trim().length === 0)
    .map((language) => language.code);

  // Only *partly* filled is a problem. None at all is a promotion with no card,
  // which is a legitimate thing to be.
  const partial = filled.length > 0 && missing.length > 0;

  function set(code: string, url: string | null) {
    const next: Localized = { ...(value ?? {}) };
    if (url) next[code] = url;
    else delete next[code];

    onChange(Object.keys(next).length > 0 ? next : null);
  }

  return (
    <div className="flex flex-col gap-xs">
      {/* `ps-md`, the inset `Field` gives its own label — see the note in
          `LocalizedField`, which is where this column first failed to line up. */}
      <span className="ps-md text-[13px] font-semibold text-text-soft">
        {label}
      </span>

      <div className="flex flex-col gap-md">
        {languages.data.map((language) => (
          <div key={language.code} className="flex flex-col gap-xs">
            {/* The code above the box rather than inside it: an uploader is a
                96pt square or a drop zone, and neither has a corner to put a
                badge in without covering the picture it is labelling. */}
            <span
              id={`${id}-${language.code}`}
              title={language.name}
              className="ps-md text-[10px] font-bold uppercase tracking-[0.08em] text-text-faint"
            >
              {language.code}
            </span>

            <ImageUploader
              value={value?.[language.code] ?? null}
              onChange={(url) => set(language.code, url)}
              folder={folder}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="ps-md text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : partial ? (
        // Names the language rather than saying "incomplete" — the operator has
        // done most of the work and what they need is which box is empty.
        <p role="alert" className="ps-md text-[13px] font-medium text-danger">
          {t("form.stillNeeded", { languages: missing.join(", ") })}
        </p>
      ) : (
        hint && (
          <p className={cx("ps-md text-[13px] text-text-faint")}>{hint}</p>
        )
      )}
    </div>
  );
}
