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

import { cx } from "./cx";
import { Skeleton } from "./display";

/**
 * A field with one input per language.
 *
 * ## English is required; the rest are optional
 *
 * Each translated column is one `jsonb` object whose `<table>_<col>_locales`
 * CHECK (`0128`) requires English and nothing else; every reader falls back to
 * English where a language is blank. So the English box is the one that gets
 * flagged — a value typed in Arabic only would otherwise come back as a
 * constraint name instead of "Still needed in: en".
 *
 * ## The list comes from the database
 *
 * `languages` is a table, so a third language is a row rather than a release:
 * every content form grows a box without being touched. Until it loads the
 * field is a skeleton — not an English-only field that changes shape under
 * somebody already typing.
 *
 * ## `filter` holds a name to its characters, live (QA-025)
 *
 * Opt-in per call site; names, not prose.
 *
 * - `"name"` drops the machine punctuation `lib/text-format.ts` lists.
 * - `"title"` does the same and puts the name in Title Case ("MILK BASED" →
 *   "Milk Based") — shop, category, section and dish names.
 * - `"letters"` keeps letters and single spaces — a tag's name, the set
 *   `menu_item_tags_name_letters` checks.
 *
 * It applies as the operator types, so the box always shows what will be
 * stored, and the characters a keystroke lost are named under the field — a
 * key that silently does nothing gets pressed harder.
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
   * An example per language code, never the label. A language with no
   * example gets no placeholder rather than the English one.
   */
  placeholder?: Record<string, string>;
  /** Standing advice for the whole field, not per language. */
  hint?: string;
  error?: string | null;
  optional?: boolean;
  /** Which characters this field keeps. Unset keeps the value as typed. */
  filter?: "name" | "title" | "letters";
}) {
  const id = useId();
  const languages = useLanguages();

  /** What the last keystroke lost; cleared by the next change that loses nothing. */
  const [dropped, setDropped] = useState<string[]>([]);

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
      // Re-casing replaces the input's value, which sends the caret to the
      // end. Put it back, so a space typed mid-word does not lose the cursor.
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

  const labelId = `${id}-label`;
  const messageId = `${id}-message`;

  const heading = (
    <div className="flex items-baseline justify-between gap-2">
      <span id={labelId} className="text-[13px] font-medium text-ink">
        {label}
      </span>
      {optional && (
        <span className="text-[12px] text-ink-4">{t("form.optional")}</span>
      )}
    </div>
  );

  if (!languages.data) {
    return (
      <div className="flex flex-col gap-1.5">
        {heading}
        <Skeleton className={multiline ? "h-24" : "h-9"} />
      </div>
    );
  }

  const isBlank = (code: string) => (value[code] ?? "").trim().length === 0;

  // Empty is fine for an optional column, and a blank Arabic is fine for any.
  // What the constraint refuses is something written with English left out.
  const partial =
    isBlank(FALLBACK_LANGUAGE) &&
    languages.data.some((language) => !isBlank(language.code));

  // One message slot, in priority order: a value that will not save, then
  // what was just refused, then the missing English, then standing advice.
  const message: { text: string; alert: boolean } | null = error
    ? { text: error, alert: true }
    : dropped.length > 0
      ? {
          text: t("form.rejectedChars", { chars: dropped.join(" ") }),
          alert: true,
        }
      : partial
        ? {
            text: t("form.stillNeeded", { languages: FALLBACK_LANGUAGE }),
            alert: true,
          }
        : hint
          ? { text: hint, alert: false }
          : null;

  const control =
    "w-full rounded-md border border-line-strong bg-surface text-[14px] text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:shadow-focus focus:outline-none aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_rgb(217_45_32/0.15)]";

  return (
    // A group, so the field's name is announced once on the way in.
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-1.5"
    >
      {heading}

      <div className="flex flex-col gap-2">
        {languages.data.map((language) => {
          const inputId = `${id}-${language.code}`;
          const text = value[language.code] ?? "";
          const isMissing = partial && language.code === FALLBACK_LANGUAGE;
          const invalid = isMissing || Boolean(error);

          return (
            // `dir` on the wrapper so the code sits at the *start* of the
            // reading direction — the right edge for Arabic.
            <div
              key={language.code}
              dir={language.rtl ? "rtl" : "ltr"}
              className="relative"
            >
              {/* Seen: the code. Heard: "Name, English". */}
              <label
                htmlFor={inputId}
                title={language.name}
                className="pointer-events-none absolute start-2 top-2 z-10 flex h-5 min-w-7 items-center justify-center rounded bg-subtle px-1 text-[10.5px] font-semibold tracking-wide text-ink-3 uppercase"
              >
                <span aria-hidden>{language.code}</span>
                <span className="sr-only">
                  {label}, <span lang={language.code}>{language.name}</span>
                </span>
              </label>

              {multiline ? (
                <textarea
                  id={inputId}
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  rows={4}
                  maxLength={maxLength}
                  placeholder={placeholder?.[language.code]}
                  value={text}
                  onChange={(event) =>
                    change(language.code, event.target.value, event.target)
                  }
                  aria-invalid={invalid || undefined}
                  aria-describedby={message ? messageId : undefined}
                  className={cx(
                    control,
                    "min-h-24 py-2 pe-3 ps-11 leading-relaxed",
                  )}
                />
              ) : (
                <input
                  id={inputId}
                  type="text"
                  lang={language.code}
                  dir={language.rtl ? "rtl" : "ltr"}
                  maxLength={maxLength}
                  placeholder={placeholder?.[language.code]}
                  value={text}
                  onChange={(event) =>
                    change(language.code, event.target.value, event.target)
                  }
                  aria-invalid={invalid || undefined}
                  aria-describedby={message ? messageId : undefined}
                  className={cx(control, "h-9 pe-3 ps-11")}
                />
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <p
          id={messageId}
          role={message.alert ? "alert" : undefined}
          className={cx(
            "text-[12.5px] leading-snug",
            message.alert ? "text-danger-ink" : "text-ink-3",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
