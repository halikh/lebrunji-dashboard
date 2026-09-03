"use client";

import type { InputHTMLAttributes, Ref } from "react";

import { useFieldWiring } from "./field";
import { cx } from "./index";

/**
 * A number field.
 *
 * `type="number"` gives the phone keyboard the digits, the browser its own
 * validation, and up/down arrow keys that step the value — all of which are
 * right for a price.
 *
 * ## The two things `type="number"` gets wrong, handled here
 *
 * **The scroll wheel changes the value.** A field that is merely being scrolled
 * past should not silently become a different price, and this is a real way to
 * mis-price a menu without noticing. So the field gives up focus on `wheel`,
 * which stops the browser applying it.
 *
 * **Spinners crowd the figure.** They are hidden: the arrow keys still step,
 * which is the useful half, and the field stays a number rather than a number
 * with furniture beside it.
 *
 * ## Left-aligned, deliberately
 *
 * Right-alignment is for a *column* of numbers, where lining up the units digit
 * is what lets the eye compare magnitudes down a table. A single field is not
 * that: a right-aligned input starts the text at the far edge and grows
 * leftwards as you type, which reads as right-to-left even in an English form.
 * `tabular-nums` stays, so digits keep an even width.
 */
export function NumberInput({
  invalid,
  className,
  ref,
  onWheel,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <input
      {...rest}
      ref={ref}
      id={rest.id ?? field?.id}
      type="number"
      // `decimal` rather than `numeric` by default: a price can carry a
      // separator in a currency that has minor units, and a keyboard with no
      // decimal point is one the operator has to fight. A caller that knows
      // its field takes whole numbers only — a lira amount, a count of
      // minutes — says so and gets the plainer keyboard.
      inputMode={rest.inputMode ?? "decimal"}
      onWheel={(event) => {
        // Blur rather than `preventDefault`: the browser applies the change on
        // the focused element, so removing focus is what actually stops it —
        // and the page still scrolls, which cancelling the event would break.
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      aria-invalid={isInvalid || undefined}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      className={cx(
        "w-full rounded-md border bg-surface px-md py-md text-[15px] text-text tabular-nums",
        "placeholder:text-text-faint",
        "focus:bg-field-focus",
        // Chrome and Safari draw spinners; Firefox uses `appearance`.
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        isInvalid ? "border-danger" : "border-border",
        className,
      )}
    />
  );
}
