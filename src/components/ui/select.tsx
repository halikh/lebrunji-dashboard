"use client";

import type { ReactNode } from "react";
import ReactSelect, { type StylesConfig } from "react-select";
import AsyncSelect from "react-select/async";

import { useFieldWiring } from "./field";

/**
 * A choice from a set the database supplies.
 *
 * ## One wrapper, so the library is configured once
 *
 * `react-select` is here because a select over database rows needs things the
 * native control cannot do — type-to-filter, a rendered option that is more
 * than a string, and later an async variant for lists with no ceiling. What it
 * arrives with is a blue-and-grey look of its own, which is the fastest way to
 * make a carefully transcribed design system look borrowed.
 *
 * So it is wrapped exactly once and styled from the palette's tokens. No screen
 * imports `react-select` directly, and swapping it later is one file.
 *
 * ## The `note` is why this is a component and not a `<select>`
 *
 * An option can carry a short remark rendered beside its label — "no options
 * yet" against a dish that has none. A native `<option>` holds no markup, so
 * the remark could only be more text in the same string; here it can be its own
 * colour and weight, and the eye can skim the column for it. That marking is
 * the whole reason this screen has a picker rather than a link from each row.
 *
 * ## Styling through `styles`, not classes
 *
 * The library renders into elements this code never sees, so its own `styles`
 * API is the seam it offers. Every value below is a palette token read from CSS
 * — nothing is a literal — which is what keeps this in step with the rest of
 * the dashboard when a colour changes.
 *
 * ## One styling block, two components
 *
 * {@link MultiSelect} is the same control accepting several answers, and its
 * styling is *this* styling — one function, called by both. Written twice, the
 * second copy is where the focus ring stops matching, and it would stop
 * matching on whichever of the two screens nobody happened to open that week.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** A short remark shown beside the label — "no options yet". */
  note?: string;
  /**
   * Drawn in place of the label text, where the option *is* something to look
   * at rather than to read — a tag's colour, shown as the chip it produces.
   *
   * `label` is still required and is still the truth: it is what the control
   * filters on as the operator types, and what a screen reader announces. This
   * only changes what the eye gets. An option that can only be recognised by
   * sight is one nobody can find by typing.
   */
  render?: ReactNode;
};

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  invalid,
  isClearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  isClearable?: boolean;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <ReactSelect<SelectOption, false>
      inputId={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid || undefined}
      value={selected}
      onChange={(option) => onChange(option?.value ?? "")}
      options={options}
      placeholder={placeholder ?? ""}
      isDisabled={disabled}
      isClearable={isClearable}
      // The library's own class names are not used; everything is `styles`
      // below. This only removes them from the DOM so nothing can accidentally
      // depend on one.
      classNamePrefix=""
      formatOptionLabel={renderOption}
      styles={paletteStyles(isInvalid)}
    />
  );
}

/**
 * One option's contents, for both controls.
 *
 * `render` wins over the label text where an option has one; the note sits
 * beside either.
 */
function renderOption(option: SelectOption) {
  return (
    <span className="flex items-baseline gap-sm">
      <span className="min-w-0 truncate">{option.render ?? option.label}</span>
      {option.note && (
        <span className="shrink-0 text-[12px] text-text-faint">
          {option.note}
        </span>
      )}
    </span>
  );
}

/**
 * The palette, as react-select's `styles` object.
 *
 * Generic over `IsMulti` so the same function serves both controls: everything
 * here is about colour and spacing, and none of it differs between picking one
 * thing and picking several.
 */
function paletteStyles<M extends boolean>(
  isInvalid: boolean,
): StylesConfig<SelectOption, M> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: "auto",
      // No vertical padding here: it all lives on `valueContainer` below, so
      // the control's height is `md` above and below the text — exactly what
      // `Input` gets from `py-md`. Split across both, a select came out
      // shorter than the field beside it, which is visible the moment the two
      // sit in one bar and invisible everywhere else.
      padding: "0 var(--spacing-xs)",
      borderRadius: "var(--radius-md)",
      backgroundColor: "var(--color-surface)",
      borderColor: isInvalid ? "var(--color-danger)" : "var(--color-border)",
      // The focus ring is the app's — a box-shadow that follows the radius,
      // the same one `globals.css` puts on every other control.
      boxShadow: state.isFocused
        ? "0 0 0 1px var(--color-active), 0 0 0 4px var(--color-active-wash)"
        : "none",
      "&:hover": { borderColor: "var(--color-border)" },
      fontSize: 15,
    }),
    valueContainer: (base) => ({
      ...base,
      // The same insets an `Input` gives its text — `py-md px-md` — so a select
      // matches the height of a field beside it, and its label lines up with
      // the value rather than with the border.
      padding: "var(--spacing-md) var(--spacing-md)",
    }),
    singleValue: (base) => ({ ...base, color: "var(--color-text)" }),
    placeholder: (base) => ({
      ...base,
      color: "var(--color-text-faint)",
      // One line, always. A placeholder is a hint about what to type, and a
      // hint that wraps to two lines makes the control taller than every field
      // beside it — so a control the operator has not touched yet is the one
      // thing breaking the row. Narrower than its text, it clips with an
      // ellipsis rather than reflowing the layout around it.
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "calc(100% - var(--spacing-sm))",
    }),
    input: (base) => ({
      ...base,
      color: "var(--color-text)",
      margin: 0,
      padding: 0,
      // The search field inside the control must not draw a ring of its
      // own.
      //
      // `globals.css` puts a focus ring on every `input` in the dashboard,
      // deliberately and globally. react-select's search box is an `input`
      // — a two-pixel-wide one — so it collected that ring and drew a tiny
      // bordered box beside the value the moment the select took focus. The
      // ring belongs to the control around it, which already has one.
      "input:focus": { boxShadow: "none", outline: "none" },
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({
      ...base,
      color: "var(--color-text-faint)",
      padding: "var(--spacing-xs)",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)",
      backgroundColor: "var(--color-surface)",
      boxShadow: "var(--shadow-overlay)",
      overflow: "hidden",
      zIndex: 20,
    }),
    option: (base, state) => ({
      ...base,
      fontSize: 14,
      color: "var(--color-text)",
      backgroundColor: state.isSelected
        ? "var(--color-active-wash)"
        : state.isFocused
          ? "var(--color-neutral-fill)"
          : "transparent",
      ":active": { backgroundColor: "var(--color-active-wash)" },
      cursor: "pointer",
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: 14,
      color: "var(--color-text-faint)",
    }),

    // Only ever rendered by `MultiSelect`. Defined here anyway, because the
    // point of one styles function is that there is nowhere else for these to
    // live where they could disagree with the control they sit inside.
    multiValue: (base) => ({
      ...base,
      backgroundColor: "var(--color-neutral-fill)",
      borderRadius: "var(--radius-sm)",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "var(--color-text)",
      fontSize: 13,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "var(--color-text-soft)",
      borderRadius: "var(--radius-sm)",
      cursor: "pointer",
      ":hover": {
        backgroundColor: "var(--color-danger-wash)",
        color: "var(--color-danger)",
      },
    }),
  };
}

/**
 * The same control, accepting several answers.
 *
 * Where a plain {@link Select} answers "which one", this answers "which of
 * these" — a dish's tags, and anything later with the same shape. It is a
 * separate export rather than an `isMulti` prop because the two have different
 * value types: one is a string and the other is a list, and a component whose
 * `value` and `onChange` change type with a boolean is one every call site has
 * to cast around.
 *
 * ## Order is the *vocabulary's*, not the order they were picked in
 *
 * The chips inside the control read in the order the operator clicked them,
 * which is unavoidable and does not matter: nothing downstream uses it. A tag's
 * position on a dish comes from `menu_item_tags.sort_order`, decided once for
 * the whole app on the Tags tab, so "Popular" precedes "Spicy" on every dish
 * rather than on the ones where somebody happened to click it first.
 */
export function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  invalid,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  // Mapped through `options` rather than held as objects, so a label edited on
  // another screen is the label this shows after a refetch — the value is the
  // id, and everything else about a tag is read from the vocabulary.
  const selected = value
    .map((id) => options.find((option) => option.value === id))
    .filter((option): option is SelectOption => option !== undefined);

  return (
    <ReactSelect<SelectOption, true>
      isMulti
      inputId={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid || undefined}
      value={selected}
      onChange={(chosen) => onChange(chosen.map((option) => option.value))}
      options={options}
      placeholder={placeholder ?? ""}
      isDisabled={disabled}
      // Clearable and searchable, per the rule every select here follows. The
      // cross clears the lot; each chip has its own.
      isClearable
      closeMenuOnSelect={false}
      // Picked options leave the list. A menu that still offers what is already
      // chosen makes selecting it a no-op, which reads as the click not having
      // registered.
      hideSelectedOptions
      classNamePrefix=""
      formatOptionLabel={renderOption}
      styles={paletteStyles(isInvalid)}
    />
  );
}

/**
 * Several answers from a set with **no ceiling** — the async half of the pair.
 *
 * The plan's rule: a plain select for a set already in hand, an async one for
 * anything unbounded. The dividing line is not taste, it is whether the list
 * can be loaded at all. Every dish in every shop is the case that breaks a
 * plain select: it is unusable at three hundred entries and slow at three
 * thousand, and it gets worse as the business grows, which is the wrong
 * direction for a control to move in.
 *
 * ## Why `value` is options here and ids in {@link MultiSelect}
 *
 * A plain select is handed the whole list, so an id is enough — the label is
 * looked up, and it stays correct when the row is renamed elsewhere. Here there
 * is no list: the options are whatever the last search returned, and an id
 * alone would render as a blank chip. So the chosen options are carried whole,
 * and the caller is responsible for resolving stored ids into labels when the
 * form opens.
 *
 * That is a real cost and it is the reason this is the exception rather than
 * the default.
 */
export function AsyncMultiSelect({
  value,
  onChange,
  loadOptions,
  placeholder,
  disabled = false,
  invalid,
  noOptionsMessage,
}: {
  value: readonly SelectOption[];
  onChange: (value: SelectOption[]) => void;
  /** Asked on every keystroke, debounced by the library. */
  loadOptions: (input: string) => Promise<SelectOption[]>;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** What an empty result says. Should name the term the operator typed. */
  noOptionsMessage?: (input: string) => string;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <AsyncSelect<SelectOption, true>
      isMulti
      inputId={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid || undefined}
      value={value as SelectOption[]}
      onChange={(chosen) => onChange([...chosen])}
      loadOptions={loadOptions}
      // The first page before a single keystroke. Without it the control opens
      // on "type to search", which is a dead end for somebody who does not yet
      // know what is in there — and the most common answer is usually near the
      // top of an unfiltered list anyway.
      defaultOptions
      placeholder={placeholder ?? ""}
      isDisabled={disabled}
      isClearable
      closeMenuOnSelect={false}
      hideSelectedOptions
      noOptionsMessage={({ inputValue }) =>
        noOptionsMessage ? noOptionsMessage(inputValue) : null
      }
      classNamePrefix=""
      formatOptionLabel={renderOption}
      styles={paletteStyles(isInvalid)}
    />
  );
}
