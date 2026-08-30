"use client";

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

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onChange}
      className={cx(
        "flex shrink-0 items-center gap-sm text-[13px] font-semibold",
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
