"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { toMajor, toMinor } from "@/lib/minor-units";

import { NumberInput } from "./number-input";

/**
 * A price, typed the way people say it.
 *
 * ## Minor units in, major units on screen
 *
 * Every amount is stored as integer **minor units** — cents, lira — because
 * integers cannot drift and LBP has no fractional unit while USD has two. The
 * operator types `1.50`; the field stores `150`. The conversion happens here
 * and nowhere else (`@/lib/minor-units`, tested), because every wrong answer
 * is wrong by a factor of a hundred and looks exactly like a right one.
 *
 * `decimalDigits` comes from the `currencies` row: a USD field steps by 0.01,
 * an LBP field by 1 and refuses a fraction.
 *
 * ## The draft string
 *
 * Deriving the text from the number on every keystroke makes `1.` impossible
 * to type. Half-typed input is a string; it becomes a number when it parses,
 * and the canonical rendering comes back on blur. `null` means "not being
 * edited", so a value changed elsewhere (a discard, a refetch) shows at once.
 *
 * ## An unknown scale disables the field
 *
 * `decimalDigits` is `null` while the currency loads. The field goes disabled
 * and empty rather than guessing a factor — `3` banked as `0.03` is the
 * failure. There is no safe default, so there is no default.
 *
 * ## `min` is enforced, not just flagged (QA-058)
 *
 * The input's `min` attribute only marks a value invalid; it never stopped the
 * value being emitted, so `-5` was written as `-500`. `toMinor` reads a figure
 * under `min` as no number, so it is neither emitted nor committed.
 *
 * ## `onCommit`: writing straight to the database
 *
 * `onChange` reports every keystroke — right for a form with a Save button.
 * A field that writes directly (a branch's price) passes `onCommit` instead:
 * it fires once, on blur or Enter, only when the figure differs from `value`,
 * so a half-typed number is never written and tabbing through writes nothing.
 * Escape leaves without writing. While a returned promise is pending the field
 * keeps showing the committed figure; a rejection is the caller's to report,
 * and the field then falls back to what is stored.
 */
export function MoneyInput({
  value,
  onChange,
  onCommit,
  decimalDigits,
  disabled,
  placeholder,
  min = 0,
  "aria-label": ariaLabel,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  invalid,
  className,
}: {
  /** Minor units. The stored figure, always an integer. */
  value: number | null;
  /** Minor units, or null when the field is empty and empty is allowed. */
  onChange?: (minorUnits: number | null) => void;
  /** The settled figure, once, on blur or Enter, and only if it changed. */
  onCommit?: (minorUnits: number | null) => unknown;
  /** From the currency: 2 for USD, 0 for LBP. `null` while unknown — disables the field. */
  decimalDigits: number | null;
  disabled?: boolean;
  placeholder?: string;
  /** In major units, like the input's own `min`. */
  min?: number;
  "aria-label"?: string;
  /** `Field`'s render props, so label and message are wired to the input. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  invalid?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Set by Escape, so the blur that follows it writes nothing. */
  const discard = useRef(false);

  const known = decimalDigits !== null;
  const factor = known ? 10 ** decimalDigits : 1;
  const shown = known ? (draft ?? toMajor(value, decimalDigits)) : "";

  return (
    <NumberInput
      id={id}
      value={shown}
      disabled={disabled || !known}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      invalid={invalid ?? (ariaInvalid === true || ariaInvalid === "true")}
      className={className}
      min={min}
      // A cent at a time on a currency with cents, a whole unit on one without;
      // the browser then refuses `0.5` lira rather than rounding it unseen.
      step={known && decimalDigits > 0 ? 1 / factor : 1}
      // No decimal point to offer on a currency with no subunit.
      inputMode={known && decimalDigits > 0 ? "decimal" : "numeric"}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (!onChange) return;
        // `NaN` and figures under `min` read as `undefined` and are not emitted.
        const parsed = toMinor(raw, decimalDigits ?? 0, min);
        if (parsed !== undefined) onChange(parsed);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (!onCommit) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          discard.current = true;
          event.currentTarget.blur();
        }
      }}
      // The canonical rendering returns on blur: `1.5` becomes `1.50`.
      onBlur={() => {
        const discarded = discard.current;
        discard.current = false;
        if (!onCommit || discarded || draft === null || !known) {
          setDraft(null);
          return;
        }

        const parsed = toMinor(draft, decimalDigits, min);
        if (parsed === undefined || parsed === value) {
          setDraft(null);
          return;
        }

        const settled = toMajor(parsed, decimalDigits);
        setDraft(settled);
        const done = () =>
          // Only if nobody has started typing again in the meantime.
          setDraft((current) => (current === settled ? null : current));
        Promise.resolve(onCommit(parsed)).then(done, done);
      }}
    />
  );
}
