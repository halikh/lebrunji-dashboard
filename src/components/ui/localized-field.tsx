"use client";

import { useId, useState } from "react";

import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import {
  lettersOnly,
  rejectedIn,
  titleCase,
  withoutRejected,
} from "@/lib/text-format";
import { FALLBACK_LANGUAGE, type Localized } from "@/lib/validation";

import { cx, Input } from "./index";

/**
 * A field with one input per language.
 *
 * ## English is required; the rest are optional
 *
 * Each translated column is one `jsonb` object, and since `0128` its
 * `<table>_<col>_locales` CHECK constraint requires English and nothing else.
 * Every reader — the app, this dashboard, the menu RPC — shows English where a
 * language is blank, so an empty Arabic box is a translation still to do rather
 * than a blank line on a phone.
 *
 * English is the one box that is flagged: a value typed in Arabic only would
 * submit and come back with a constraint name, and naming the box here is the
 * difference between that and "still needed in: en".
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
 * ## `filter` holds a name to its characters, live — and a title to its case
 *
 * Opt-in per call site, and the line it draws is catalogue **names** against
 * long-form **content**. A help answer or a privacy section is prose, and the
 * characters a name may not hold are ones prose legitimately contains.
 *
 * - `"name"` drops the machine punctuation `lib/text-format.ts` lists.
 * - `"title"` does the same and also puts the name in Title Case — "MILK
 *   BASED" becomes "Milk Based". Shop, category, section and dish names.
 * - `"letters"` keeps letters and single spaces only — a tag's name, held to
 *   the same set `menu_item_tags_name_letters` checks.
 *
 * It applies as the operator types, not on save, so the box always shows what
 * will be stored. Only `"title"` changes case; the api applies the same rule
 * again on save (`titleLocalized`).
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
  filter,
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
   * Which characters this field keeps. See the note on the component.
   *
   * Unset means the value is kept exactly as typed, which is what every
   * long-form field wants.
   */
  filter?: "name" | "title" | "letters";
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
   * Filtered here rather than in `onChange` at each call site: there are
   * seven of those and there will be more, and the one that forgot would be a
   * field that quietly kept its own rules.
   */
  function change(
    code: string,
    next: string,
    input: HTMLInputElement | HTMLTextAreaElement,
  ) {
    if (filter === "letters") {
      const { kept, dropped: lost } = lettersOnly(next);
      setDropped(lost);
      onChange({ ...value, [code]: kept });
      return;
    }
    if (filter === "name") {
      setDropped(rejectedIn(next));
      onChange({ ...value, [code]: withoutRejected(next) });
      return;
    }
    if (filter === "title") {
      setDropped(rejectedIn(next));
      const kept = withoutRejected(next);
      const cased = titleCase(kept);
      onChange({ ...value, [code]: cased });
      // Re-casing keeps the length but still replaces the input's value, which
      // sends the caret to the end. Put it back where it was, so typing a space
      // in the middle of a word does not throw the cursor away.
      if (cased !== kept) {
        const { selectionStart, selectionEnd } = input;
        requestAnimationFrame(() => {
          if (document.activeElement === input)
            input.setSelectionRange(selectionStart, selectionEnd);
        });
      }
      return;
    }
    onChange({ ...value, [code]: next });
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

  const isBlank = (code: string) => (value[code] ?? "").trim().length === 0;

  // Empty is a legitimate state for an optional column, and a blank Arabic is
  // a legitimate state for any column. What the constraint refuses is something
  // written with the English left out.
  const partial =
    isBlank(FALLBACK_LANGUAGE) &&
    languages.data.some((language) => !isBlank(language.code));

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
          const isMissing = partial && language.code === FALLBACK_LANGUAGE;

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
                    change(language.code, event.target.value, event.target)
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
                    change(language.code, event.target.value, event.target)
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
          {t("form.stillNeeded", { languages: FALLBACK_LANGUAGE })}
        </p>
      ) : (
        // The same slot as the error, never a second line: showing both means
        // reading advice about a value already reported as wrong.
        hint && <p className="ps-md text-[13px] text-text-faint">{hint}</p>
      )}
    </div>
  );
}
