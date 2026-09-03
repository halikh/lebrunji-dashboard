"use client";

import { useState } from "react";

import { NumberInput } from "./number-input";

/**
 * A price, typed the way people say it.
 *
 * ## The problem it fixes
 *
 * Every amount in this product is stored as `bigint` **minor units** — cents,
 * lira — because integers cannot drift the way floats do, and because LBP has
 * no fractional unit at all while USD has two. That is the right storage and it
 * is a terrible thing to type: the delivery ladder asked an operator to enter
 * `150` and told them underneath that it meant $1.50, which is the database's
 * arithmetic done by hand, every time, on the screen where getting it wrong
 * multiplies every delivery charge by a hundred.
 *
 * So the field takes `1.50` and stores `150`. The conversion happens here and
 * nowhere else — the plan's rule, and the reason this is a primitive rather
 * than four screens each dividing by a power of ten.
 *
 * ## How many decimals is the currency's business
 *
 * `decimalDigits` comes from the `currencies` row, so a USD field steps by 0.01
 * and an LBP field steps by 1 and refuses a fraction — because a tenth of a
 * lira is not a thing, and offering to type one is offering a precision the
 * column cannot keep.
 *
 * ## Why there is a draft string
 *
 * Deriving the text from the number on every keystroke makes the field
 * unusable: type `1.` and it re-renders as `1`, so the decimal point can never
 * be entered. Halfway-typed input is a *string*, and only a string — it becomes
 * a number when it parses, and the canonical rendering comes back on blur.
 *
 * `null` means "not being edited", so an amount changed elsewhere — a discard, a
 * refetch — shows immediately rather than waiting for a focus it may never get.
 * No effect is involved, which is what keeps it from fighting its own value.
 *
 * ## An unknown scale disables the field
 *
 * `decimalDigits` is `null` while the currency is still being fetched, or when
 * the shop the amount belongs to has not loaded. The field goes disabled and
 * empty rather than picking a number to multiply by, because every wrong answer
 * here is wrong by a factor of a hundred and looks exactly like a right one —
 * `3` banked as `0.03`, `50000` banked as five million. There is no safe
 * default, so there is no default.
 */
export function MoneyInput({
  value,
  onChange,
  decimalDigits,
  disabled,
  placeholder,
  min = 0,
  "aria-label": ariaLabel,
}: {
  /** Minor units. The stored figure, always an integer. */
  value: number | null;
  /** Minor units, or null when the field is empty and empty is allowed. */
  onChange: (minorUnits: number | null) => void;
  /**
   * From the currency: 2 for USD, 0 for LBP. `null` while it is unknown, which
   * disables the field — see above.
   */
  decimalDigits: number | null;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const known = decimalDigits !== null;
  const factor = known ? 10 ** decimalDigits : 1;
  const shown = known ? (draft ?? toMajor(value, decimalDigits)) : "";

  return (
    <NumberInput
      value={shown}
      disabled={disabled || !known}
      placeholder={placeholder}
      aria-label={ariaLabel}
      min={min}
      // A cent at a time on a currency that has cents, a whole unit on one that
      // does not. The browser's own validation then refuses `0.5` lira rather
      // than rounding it somewhere the operator cannot see.
      step={known && decimalDigits > 0 ? 1 / factor : 1}
      // A currency with no subunit has no decimal point to offer, and a phone
      // keyboard that offers one is offering a precision the column cannot
      // keep. `numeric` drops it; `decimal` is right for the currencies that
      // do have cents.
      inputMode={known && decimalDigits > 0 ? "decimal" : "numeric"}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);

        if (raw.trim() === "") {
          onChange(null);
          return;
        }

        const parsed = Number(raw);
        // A half-typed `1.` is `1` to `Number`, which is fine — it is a real
        // reading of what is there so far. `NaN` is not, and emitting it would
        // write garbage the moment somebody typed a stray character.
        if (Number.isFinite(parsed)) onChange(Math.round(parsed * factor));
      }}
      // The canonical rendering returns: `1.5` becomes `1.50`, `01` becomes
      // `1`, and a value rounded on the way in is shown as what was actually
      // stored rather than as what was typed.
      onBlur={() => setDraft(null)}
    />
  );
}

/** Minor units as the number a person would say. `null` renders as empty. */
function toMajor(value: number | null, decimalDigits: number): string {
  if (value === null) return "";
  if (decimalDigits === 0) return String(value);
  return (value / 10 ** decimalDigits).toFixed(decimalDigits);
}
