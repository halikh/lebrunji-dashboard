"use client";

import { useFieldWiring } from "./field";
import { cx } from "./index";

/**
 * A switch: on or off, acting the moment it is pressed.
 *
 * ## Why a button and not a checkbox
 *
 * A checkbox announces "checked" and belongs to a form that gets submitted.
 * This is not that — flipping it *is* the action, there is no Save, and
 * `aria-pressed` is the attribute that says exactly that. A styled checkbox
 * here would describe a form that does not exist.
 *
 * ## Why the label is part of it
 *
 * The state has to be readable without colour: "Live" and "Hidden" are two
 * words, and a green pill alone is invisible to anyone who cannot tell it from
 * the grey one. The label is also the larger click target, which matters on a
 * row somebody is working through quickly.
 *
 * `labelOn`/`labelOff` differ where the two states have their own names —
 * Live/Hidden — and are the same string where the switch is one property being
 * turned on and off, like Featured.
 */
export function Toggle({
  on,
  onChange,
  labelOn,
  labelOff,
  disabled = false,
  className,
}: {
  on: boolean;
  onChange: () => void;
  labelOn: string;
  labelOff?: string;
  disabled?: boolean;
  className?: string;
}) {
  const label = on ? labelOn : (labelOff ?? labelOn);

  // A switch inside a `Field` is described by that field's hint or error, the
  // same as any input. Outside one — a switch in a table row — there is nothing
  // to describe it and the label it carries is the whole of its meaning.
  const field = useFieldWiring();

  return (
    <button
      type="button"
      id={field?.id}
      aria-pressed={on}
      aria-describedby={field?.describedBy}
      disabled={disabled}
      onClick={onChange}
      className={cx(
        "flex shrink-0 items-center gap-sm text-[13px] font-semibold",
        // Lined up with the label above it.
        //
        // A `Field` insets its label and hint by the padding an *input* puts
        // before its text, so the three read as one column. A switch has no
        // such padding — its pill starts at the edge — so without this it sits
        // outdented under a label that looks indented, which is the misalignment
        // an operator notices before they notice anything else on the form.
        //
        // Only inside a `Field`: a switch in a table row is its own column and
        // has nothing to line up with.
        field && "ps-md",
        // The label carries the state in colour *as well as* in words — never
        // instead of them.
        on ? "text-text" : "text-text-soft",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "flex h-[22px] w-[38px] items-center rounded-full p-xxs transition-[background-color]",
          on ? "justify-end bg-accent" : "justify-start bg-neutral-fill",
        )}
      >
        <span className="size-[18px] rounded-full bg-surface shadow-[0_1px_2px_rgba(30,27,24,0.18)]" />
      </span>
      <span className="text-left">{label}</span>
    </button>
  );
}
