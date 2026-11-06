"use client";

import type { InputHTMLAttributes, Ref } from "react";

import { cx } from "./cx";

/**
 * A number field.
 *
 * `type="number"` gives the phone keyboard the digits, the browser its own
 * validation, and arrow keys that step the value. Two things it gets wrong are
 * handled here:
 *
 * - **The scroll wheel changes the value.** A field scrolled past should not
 *   silently become a different price, so it gives up focus on `wheel` — the
 *   browser applies the change only to the focused element, and the page still
 *   scrolls.
 * - **Spinners crowd the figure.** They are hidden; the arrow keys still step.
 *
 * Left-aligned like every other single field (right-alignment is for a column
 * of numbers); `tabular-nums` keeps digit widths even.
 *
 * Inside a `Field`, spread the render props onto it — `id`, `aria-describedby`
 * and `aria-invalid` are ordinary input attributes. `invalid` still works.
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
  const isInvalid = invalid ?? Boolean(rest["aria-invalid"]);
  return (
    <input
      {...rest}
      ref={ref}
      type="number"
      // `decimal` by default: a price can carry a separator. A caller that
      // takes whole numbers only says so and gets the plainer keyboard.
      inputMode={rest.inputMode ?? "decimal"}
      onWheel={(event) => {
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      aria-invalid={isInvalid || undefined}
      className={cx(
        "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink tabular-nums shadow-xs transition-[border-color,box-shadow]",
        "placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:shadow-focus focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 disabled:hover:border-line-strong",
        "aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_rgb(217_45_32/0.15)]",
        // Chrome and Safari draw spinners; Firefox uses `appearance`.
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
    />
  );
}
