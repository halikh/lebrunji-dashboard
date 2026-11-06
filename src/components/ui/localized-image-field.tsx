"use client";

import { useId } from "react";

import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import type { ImageShape } from "@/lib/image-shape";
import { FALLBACK_LANGUAGE, type Localized } from "@/lib/validation";

import { cx } from "./cx";
import { Skeleton } from "./display";
import { ImageUploader } from "./image-uploader";

/**
 * One picture per language.
 *
 * Almost no picture is translated — a dish photo is the dish in every
 * language. A promotion's card is the exception: since `0013` the words are
 * *inside* the artwork, so an Arabic customer shown an English card is shown
 * an advert they cannot read.
 *
 * Same rules as `LocalizedField`: the languages come from the `languages`
 * table; English is required whenever there is any card (`0128`), the rest
 * fall back to it. Clearing every language collapses the value to `null` — the
 * column's "no card" state — never `{}`, which the constraint refuses.
 */
export function LocalizedImageField({
  label,
  value,
  onChange,
  folder,
  hint,
  error,
  shape,
  disabled = false,
}: {
  label: string;
  /** English and any others, or null for no picture at all. */
  value: Localized | null;
  onChange: (value: Localized | null) => void;
  folder: "menu-items" | "stores" | "promotions" | "artwork";
  hint?: string;
  error?: string | null;
  /** Every language's picture is drawn in the same frame. See `ImageUploader`. */
  shape?: ImageShape;
  disabled?: boolean;
}) {
  const id = useId();
  const languages = useLanguages();
  const labelId = `${id}-label`;

  const heading = (
    <span id={labelId} className="text-[13px] font-medium text-ink">
      {label}
    </span>
  );

  if (!languages.data) {
    return (
      <div className="flex flex-col gap-1.5">
        {heading}
        <Skeleton className="h-32" />
      </div>
    );
  }

  const isBlank = (code: string) => (value?.[code] ?? "").trim().length === 0;

  // Only a card with the English one left out is a problem.
  const partial =
    isBlank(FALLBACK_LANGUAGE) &&
    languages.data.some((language) => !isBlank(language.code));

  function set(code: string, url: string | null) {
    const next: Localized = { ...(value ?? {}) };
    if (url) next[code] = url;
    else delete next[code];
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  const message = error
    ? error
    : partial
      ? t("form.stillNeeded", { languages: FALLBACK_LANGUAGE })
      : null;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-1.5"
    >
      {heading}

      <div
        className={cx(
          "grid gap-3",
          languages.data.length > 1 && "sm:grid-cols-2",
        )}
      >
        {languages.data.map((language) => (
          <div
            key={language.code}
            className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3"
          >
            <span
              id={`${id}-${language.code}`}
              className="flex items-center gap-2 text-[12.5px] text-ink-2"
            >
              <span
                aria-hidden
                className="flex h-5 min-w-7 items-center justify-center rounded bg-subtle px-1 text-[10.5px] font-semibold tracking-wide text-ink-3 uppercase"
              >
                {language.code}
              </span>
              <span lang={language.code}>{language.name}</span>
            </span>

            <ImageUploader
              value={value?.[language.code] ?? null}
              onChange={(url) => set(language.code, url)}
              folder={folder}
              shape={shape}
              disabled={disabled}
              aria-describedby={`${id}-${language.code}`}
              aria-invalid={
                (language.code === FALLBACK_LANGUAGE && partial) || undefined
              }
            />
          </div>
        ))}
      </div>

      {message ? (
        <p role="alert" className="text-[12.5px] leading-snug text-danger-ink">
          {message}
        </p>
      ) : (
        hint && <p className="text-[12.5px] leading-snug text-ink-3">{hint}</p>
      )}
    </div>
  );
}
