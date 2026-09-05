"use client";

import { useId, useState } from "react";

import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import { formatText, rejectedIn, type TextFormat } from "@/lib/text-format";
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
 *
 * ## `format` holds a field to the house style, live
 *
 * Opt-in per call site rather than on by default, and the line it draws is
 * catalogue **names** against long-form **content**. A shop, a category, a tag,
 * a section, a dish and its description are read by scanning a list, and a list
 * where the casing drifts reads as three products — see `lib/text-format.ts`.
 * A help answer or a privacy section is prose: forcing its case would be
 * vandalism, and the characters it bans are ones prose legitimately contains.
 *
 * It applies as the operator types, not on save. A value normalised on the way
 * to the database shows one thing in the box and stores another, and the first
 * time anybody notices is when the list disagrees with the form they just
 * submitted.
 *
 * The same prop turns on the character filter, because the two rules answer one
 * question — what may a name look like — and a field that shouted but still
 * accepted `<b>` would be half a rule.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  placeholder,
  hint,
  error,
  optional = false,
  format,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
  maxLength?: number;
  /**
   * An **example**, never the label — and one per language.
   *
   * A placeholder disappears the moment somebody types, so a field carrying its
   * name only there is a field nobody can check afterwards. The label above says
   * what it is; this shows what a good answer looks like.
   *
   * Keyed by language code, because an English example above an Arabic input is
   * worse than none: it shows the wrong script in the wrong direction, and
   * quietly suggests that English is what belongs in the box.
   *
   * A language with no example gets no placeholder rather than the English one.
   */
  placeholder?: Record<string, string>;
  /**
   * Standing advice for the whole field, not per language.
   *
   * One sentence under a set of inputs that are the same value in different
   * words — repeating it per language would say the same thing twice and push
   * the fields apart.
   */
  hint?: string;
  error?: string | null;
  optional?: boolean;
  /**
   * The house style this field is held to. See the note on the component.
   *
   * Unset means the value is stored exactly as typed, which is what every
   * long-form field wants.
   */
  format?: TextFormat;
}) {
  const id = useId();
  const languages = useLanguages();

  /**
   * The characters the last keystroke lost, if any.
   *
   * A filter that silently eats a character is the worst version of this: the
   * key does nothing, and the operator presses it harder. Naming them — "+ and
   * / cannot be used here" — is what turns a dead key into a rule. It clears
   * itself on the next change that loses nothing, so it reads as feedback on
   * what was just typed rather than as a standing error.
   */
  const [dropped, setDropped] = useState<string[]>([]);

  /**
   * One language's value, on its way in.
   *
   * Formatting here rather than in `onChange` at each call site: there are
   * seven of those and there will be more, and the one that forgot would be a
   * field that quietly kept its own rules.
   */
  function change(code: string, next: string) {
    if (!format) {
      onChange({ ...value, [code]: next });
      return;
    }

    setDropped(rejectedIn(next));
    onChange({ ...value, [code]: formatText(next, format) });
  }

  if (!languages.data) {
    // A skeleton, not an English-only field. Rendering one input and adding the
    // rest a moment later would let somebody start typing into a form that is
    // about to change shape under them.
    return (
      <div className="flex flex-col gap-xs">
        <span className="ps-md text-[13px] font-semibold text-text-soft">
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
      {/* `ps-md`, the same inset `Field` gives its label and hint.
          These inputs have horizontal padding, so their text starts some way
          inside the left edge; a label flush at zero lines up with the border
          and, against a pill-shaped field whose edge curves away, reads as
          misaligned. This file draws its own label rather than using `Field`,
          which is how it came to be the one place in the dashboard where that
          column did not line up. */}
      <div className="flex items-baseline gap-sm ps-md">
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
            // `dir` on the wrapper rather than only on the input, so the
            // logical properties below flip with the language: the code sits at
            // the *start* of the reading direction, which is the right edge for
            // Arabic.
            <div
              key={language.code}
              dir={language.rtl ? "rtl" : "ltr"}
              className="relative"
            >
              {/*
                The code sits inside the field, not in a box beside it.
                A separate tile made every row two objects with a seam down the
                middle, and the inputs no longer lined up with the single-value
                fields above and below them. Inside, each row reads as one
                control that happens to be labelled.

                `pointer-events-none` so a click lands on the input underneath —
                the label still focuses it via `htmlFor`, and text selection is
                not interrupted by a dead patch.
              */}
              <label
                htmlFor={inputId}
                title={language.name}
                className="pointer-events-none absolute start-[13px] top-[14px] z-10 text-[10px] font-bold uppercase tracking-[0.08em] text-text-faint"
              >
                {language.code}
              </label>

              {multiline ? (
                <textarea
                  id={inputId}
                  // `lang` and `dir` so an RTL language is typed right-to-left
                  // even though the page is not — and so a screen reader
                  // switches voice for it.
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  rows={4}
                  maxLength={maxLength}
                  placeholder={placeholder?.[language.code]}
                  value={text}
                  onChange={(event) =>
                    change(language.code, event.target.value)
                  }
                  aria-invalid={isMissing || undefined}
                  className={cx(
                    "w-full rounded-md border bg-surface py-md pe-md ps-[42px] text-[15px] text-text",
                    "placeholder:text-text-faint focus:bg-field-focus",
                    isMissing || error ? "border-danger" : "border-border",
                  )}
                />
              ) : (
                <Input
                  id={inputId}
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  maxLength={maxLength}
                  placeholder={placeholder?.[language.code]}
                  value={text}
                  onChange={(event) =>
                    change(language.code, event.target.value)
                  }
                  invalid={isMissing || Boolean(error)}
                  padding="ps-[42px] pe-md"
                />
              )}
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="ps-md text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : dropped.length > 0 ? (
        // Above the hint and below the error, in the one slot this field has
        // for a message: what was just refused matters more than standing
        // advice and less than a value that will not save.
        <p role="alert" className="ps-md text-[13px] font-medium text-danger">
          {t("form.rejectedChars", { chars: dropped.join(" ") })}
        </p>
      ) : partial ? (
        // Names the languages rather than saying "incomplete". The operator has
        // done most of the work; what they need is which box is empty.
        <p role="alert" className="ps-md text-[13px] font-medium text-danger">
          {t("form.stillNeeded", { languages: missing.join(", ") })}
        </p>
      ) : (
        // The same slot as the error, never a second line: showing both means
        // reading advice about a value already reported as wrong.
        hint && <p className="ps-md text-[13px] text-text-faint">{hint}</p>
      )}
    </div>
  );
}
