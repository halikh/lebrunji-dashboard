"use client";

import ReactSelect from "react-select";

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
 */

export type SelectOption = {
  value: string;
  label: string;
  /** A short remark shown beside the label — "no options yet". */
  note?: string;
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
      formatOptionLabel={(option) => (
        <span className="flex items-baseline gap-sm">
          <span className="min-w-0 truncate">{option.label}</span>
          {option.note && (
            <span className="shrink-0 text-[12px] text-text-faint">
              {option.note}
            </span>
          )}
        </span>
      )}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "auto",
          padding: "var(--spacing-xs) var(--spacing-xs)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--color-surface)",
          borderColor: isInvalid
            ? "var(--color-danger)"
            : "var(--color-border)",
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
          // The same inset an `Input` gives its text, so the label above lines
          // up with the value rather than with the border.
          padding: "var(--spacing-xs) var(--spacing-md)",
        }),
        singleValue: (base) => ({ ...base, color: "var(--color-text)" }),
        placeholder: (base) => ({
          ...base,
          color: "var(--color-text-faint)",
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
      }}
    />
  );
}
