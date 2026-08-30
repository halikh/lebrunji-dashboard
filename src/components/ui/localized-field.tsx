"use client";

import { useId } from "react";

import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import { cx, Input } from "./index";

/**
 * A field with one input per language.
 *
 * ## Every language is required, and that is the database's rule
 *
 * Since migration 0051 each translated column is one `jsonb` object, with a
 * `<table>_<col>_locales` CHECK constraint requiring **all** of them. So a form
 * that let a value through in English only would not be lenient — it would
 * submit, and Postgres would reject it with a constraint name the operator can
 * do nothing with.
 *
 * Naming the missing languages here is the entire difference between that and
 * "still needed in: ar".
 *
 * ## Why the list comes from the database
 *
 * `languages` is a table. Rendering from it is what makes a third language a
 * row rather than a release: every content form in the dashboard grows a field
 * without being touched.
 *
 * ## One layout for now
 *
 * Stacked: every language visible at once. That is right for the short fields
 * this is used on — switching tabs to write the same short thing twice is
 * slower than reading two rows.
 *
 * The flow study settled that long-form content wants the other shape — one
 * language at a time, because two paragraphs side by side halves the width of
 * each until neither is readable. That arrives with the help and legal screens
 * in Phase 7, and is deliberately **not** stubbed here: an unused `variant`
 * prop is a promise the component does not keep.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  error,
  optional = false,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  maxLength?: number;
  error?: string | null;
  optional?: boolean;
}) {
  const id = useId();
  const languages = useLanguages();

  if (!languages.data) {
    // A skeleton, not an English-only field. Rendering one input and adding the
    // rest a moment later would let somebody start typing into a form that is
    // about to change shape under them.
    return (
      <div className="flex flex-col gap-xs">
        <span className="text-[13px] font-semibold text-text-soft">
          {label}
        </span>
        <div aria-hidden className="h-[42px] rounded-md bg-neutral-fill" />
      </div>
    );
  }

  const missing = languages.data
    .filter((language) => (value[language.code] ?? "").trim().length === 0)
    .map((language) => language.code);

  // Empty is a legitimate state for an optional column — it is only *partly*
  // filled that the constraint refuses.
  const partial = missing.length > 0 && missing.length < languages.data.length;

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-baseline gap-sm">
        <span className="text-[13px] font-semibold text-text-soft">
          {label}
        </span>
        {optional && (
          <span className="text-[12px] text-text-faint">
            {t("form.optional")}
          </span>
        )}
      </div>

      <div className={cx("flex flex-col gap-xs")}>
        {languages.data.map((language) => {
          const inputId = `${id}-${language.code}`;
          const text = value[language.code] ?? "";
          const isMissing = partial && text.trim().length === 0;

          return (
            <div key={language.code} className="flex items-stretch gap-sm">
              <label
                htmlFor={inputId}
                // The code, not the name: `EN` and `AR` are two characters and
                // unambiguous, where "English" and "العربية" are different
                // widths and push the inputs out of alignment.
                className="flex w-[34px] shrink-0 items-center justify-center rounded-md bg-neutral-fill text-[10px] font-bold uppercase text-text-soft"
                title={language.name}
              >
                {language.code}
              </label>

              {multiline ? (
                <textarea
                  id={inputId}
                  // `lang` and `dir` on the input itself, so an RTL language is
                  // typed right-to-left even though the page is not — and so a
                  // screen reader switches voice for it.
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  rows={4}
                  maxLength={maxLength}
                  value={text}
                  onChange={(event) =>
                    onChange({ ...value, [language.code]: event.target.value })
                  }
                  aria-invalid={isMissing || undefined}
                  className={cx(
                    "w-full resize-y rounded-md border bg-surface px-md py-md text-[15px] text-text",
                    "focus:bg-field-focus",
                    isMissing || error ? "border-danger" : "border-border",
                  )}
                />
              ) : (
                <Input
                  id={inputId}
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  maxLength={maxLength}
                  value={text}
                  onChange={(event) =>
                    onChange({ ...value, [language.code]: event.target.value })
                  }
                  invalid={isMissing || Boolean(error)}
                />
              )}
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : (
        partial && (
          // Names the languages rather than saying "incomplete". The operator
          // has done most of the work; what they need is which box is empty.
          <p role="alert" className="text-[13px] font-medium text-danger">
            {t("form.stillNeeded", { languages: missing.join(", ") })}
          </p>
        )
      )}
    </div>
  );
}
