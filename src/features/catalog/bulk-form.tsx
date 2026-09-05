"use client";

import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { useRevealOnMount } from "@/components/ui/reveal";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { t, type TranslationKey } from "@/i18n/translations";

import {
  bulkPlaceholder,
  parseBulkRows,
  type ParsedRow,
  type PriceRule,
} from "./bulk-entry";

/**
 * Pasting a list, whatever the list is of.
 *
 * ## Why this is a textarea and not a repeating row of fields
 *
 * Five blank rows of three inputs is fifteen boxes and fourteen tab stops, and
 * it still has to guess how many rows to offer. The list an operator is copying
 * from — a message from the kitchen, a column of a spreadsheet, the printed
 * menu — is already text, so the shortest path from what they have to what the
 * database needs is a paste. Typed by hand it is no worse either: a line is one
 * line rather than three focus changes.
 *
 * ## One component for sections, items and choices
 *
 * They differ in one thing — whether a row carries a price, and whether it must
 * — and `price` is that thing. Everything else is identical, and three copies
 * of a textarea, a problem list and a count would be three places for the
 * separator, the scaling or the all-or-nothing rule to drift apart.
 *
 * ## Nothing is written until every line reads
 *
 * The parse is all-or-nothing and this is where that shows: problems are listed
 * by line, the button is disabled while any remain, and the caller does one
 * insert. A bulk add that wrote the first four lines and stopped would leave
 * the operator working out which four landed, and re-pasting would duplicate
 * them.
 *
 * ## The count on the button is the preview
 *
 * "Add 6" is a parse result rendered as a label. It answers, before anything is
 * written, the question somebody pasting nine lines actually has: was this read
 * the way I meant it?
 */
export function BulkForm({
  kind,
  price,
  decimals,
  pending,
  onSubmit,
  onCancel,
}: {
  /** Which list this is — decides the heading and the worked example. */
  kind: "sections" | "items" | "choices";
  price: PriceRule;
  /**
   * The shop currency's decimals, or `null` while it is unknown.
   *
   * Passed straight through to the parser, which refuses every priced line
   * rather than guessing — a scale guessed wrong is wrong by a hundred.
   */
  decimals: number | null;
  pending: boolean;
  onSubmit: (rows: ParsedRow[]) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const form = useRevealOnMount<HTMLDivElement>({ focus: true });

  const [text, setText] = useState("");

  // A pasted block is the most expensive thing in this dashboard to lose: it is
  // typically a whole menu assembled somewhere else.
  useUnsavedChanges(text.trim() !== "");

  // Parsed on every keystroke rather than on submit. The problems are the point
  // of the screen — somebody fixing line 7 wants to watch line 7 stop being a
  // problem, not press a button to find out.
  const parsed = parseBulkRows(text, codes, decimals, price);
  const ready = parsed.ok ? parsed.rows.length : 0;
  const blank = text.trim() === "";

  const TITLES: Record<typeof kind, TranslationKey> = {
    sections: "bulk.sectionsTitle",
    items: "bulk.itemsTitle",
    choices: "bulk.choicesTitle",
  };

  const hint: TranslationKey =
    price === "none"
      ? "bulk.hint"
      : price === "optional"
        ? "bulk.hintPriceOptional"
        : "bulk.hintPriceRequired";

  return (
    <div
      ref={form}
      className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg"
    >
      <div className="flex flex-col gap-xxs">
        <h3 className="text-[15px] font-semibold">{t(TITLES[kind])}</h3>
        <p className="text-[13px] text-text-soft">{t(hint)}</p>
      </div>

      <Field label={t("bulk.label")}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          spellCheck={false}
          // Built from the same `codes` the parser reads, so a third language
          // adds a column to the example and to the parse at once. A hint that
          // fell behind the format would be an instruction to type something
          // that fails.
          placeholder={bulkPlaceholder(codes, price, kind)}
          aria-invalid={(!parsed.ok && !blank) || undefined}
          className={cx(
            "w-full rounded-md border bg-surface p-md text-[14px] text-text",
            // Monospace so the columns line up: a missing bar shows as a ragged
            // line rather than having to be counted.
            "font-mono placeholder:text-text-faint focus:bg-field-focus",
            !parsed.ok && !blank ? "border-danger" : "border-border",
          )}
        />
      </Field>

      {!parsed.ok && (
        <div className="flex flex-col gap-xs rounded-md bg-danger-wash/40 p-md">
          <p className="text-[13px] font-semibold">{t("bulk.problems")}</p>
          <ul className="flex flex-col gap-xxs">
            {parsed.problems.map((problem) => (
              <li
                key={`${problem.line}-${problem.key}`}
                className="text-[13px] text-text-soft"
              >
                <span className="font-semibold tabular-nums">
                  {t("bulk.line", { line: problem.line })}
                </span>
                {" — "}
                {t(problem.key, problem.params)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-sm">
        <span className="min-w-0 flex-grow text-[13px] text-text-faint">
          {blank
            ? t("bulk.nothing")
            : parsed.ok
              ? t("bulk.ready", { count: ready })
              : ""}
        </span>

        {/* Cancel then save, the same order as every other form here: the
            button in a given position should always do the same thing. */}
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={!parsed.ok || ready === 0}
          pending={pending}
          onClick={() => {
            if (!parsed.ok) return;
            onSubmit(parsed.rows);
          }}
        >
          {ready === 1
            ? t("bulk.submitOne")
            : t("bulk.submit", { count: ready })}
        </Button>
      </div>
    </div>
  );
}
