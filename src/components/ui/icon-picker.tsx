"use client";

import { cx } from "@/components/ui";
import {
  CATEGORY_ICON_NAMES,
  categoryIcon,
  type CategoryIconName,
} from "@/lib/category-icons";
import { t } from "@/i18n/translations";

/**
 * Pick the glyph a category's dishes fall back to.
 *
 * ## Why a grid and not an upload
 *
 * This replaces an `ImageUploader`, and the swap is the point of migration
 * `0124`. The mark is drawn at 22pt inside a 52pt well, in one colour, beside
 * type — that is a *glyph*, and asking for a file invited a photograph, which
 * at that size is a smudge and cannot take the category's accent the way a
 * stroked path does. A grid of the app's own icons asks the question the app
 * can actually answer.
 *
 * ## Why the set is short
 *
 * `CATEGORY_ICON_NAMES` is a hand-kept list, not all of Lucide — see the note
 * in `lib/category-icons.ts`. Sixty-odd is a grid somebody scans; fifteen
 * hundred is a search problem, and the app would have to ship every one of
 * them to be able to draw whatever got picked.
 *
 * ## Empty is a real answer
 *
 * The first cell clears the choice, and clearing it is not "no icon" — it is
 * "the app decides", which is what every category did before `0124` and what
 * one with no entry in the app's own table still does. So the cell reads as a
 * choice rather than as a delete.
 */
export function IconPicker({
  value,
  onChange,
  disabled = false,
}: {
  /** The chosen name, or null for "whatever the app's own table says". */
  value: string | null;
  onChange: (name: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-md">
      <div
        role="radiogroup"
        aria-label={t("categories.emptyIcon")}
        className="flex flex-wrap gap-xs"
      >
        {/* "Let the app decide", first, because it is the state every category
            starts in and the one an operator returns to. */}
        <Cell
          selected={value === null}
          disabled={disabled}
          label={t("categories.iconNone")}
          onClick={() => onChange(null)}
        >
          <span className="text-[11px] font-semibold">
            {t("categories.iconNoneShort")}
          </span>
        </Cell>

        {CATEGORY_ICON_NAMES.map((name) => (
          <IconCell
            key={name}
            name={name}
            selected={value === name}
            disabled={disabled}
            onClick={() => onChange(name)}
          />
        ))}
      </div>
    </div>
  );
}

function IconCell({
  name,
  selected,
  disabled,
  onClick,
}: {
  name: CategoryIconName;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Glyph = categoryIcon(name);
  if (!Glyph) return null;

  return (
    <Cell
      selected={selected}
      disabled={disabled}
      // The name itself, which is the only label these have — and the one the
      // database holds, so a tooltip here is also how somebody reads a row.
      label={name}
      onClick={onClick}
    >
      <Glyph size={20} strokeWidth={1.8} aria-hidden />
    </Cell>
  );
}

/** One square in the grid. The selection is a ring, not a fill — see below. */
function Cell({
  selected,
  disabled,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex size-[40px] shrink-0 items-center justify-center rounded-md border",
        "transition-[background-color,border-color]",
        // A ring rather than a filled square: the glyphs are what is being
        // compared, and a coloured ground under one of sixty changes how that
        // one reads against the rest.
        selected
          ? "border-active bg-active-wash text-active-ink"
          : "border-border text-text-soft hover:bg-neutral-fill",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
    </button>
  );
}
