"use client";

import type { Ref } from "react";

import {
  CALLING_CODE,
  digitsOf,
  internationalFrom,
  nationalPart,
} from "@/lib/phone";

import { useFieldWiring } from "./field";
import { cx } from "./index";

/** A Lebanese national number is seven digits or eight. Eight is the ceiling. */
const NATIONAL_DIGITS = 8;

/**
 * The code as it is drawn, built once rather than in the JSX.
 *
 * Not a translation key, which is the other way this could have gone: a calling
 * code is the same three digits in every language, and putting it in the
 * strings file would invite somebody to localise a number that has no
 * localisation. Out here it also satisfies the no-literals-in-JSX rule honestly
 * rather than by exemption.
 */
const PREFIX = `+${CALLING_CODE}`;

/**
 * A Lebanese phone number, typed as the part that varies.
 *
 * ## What it replaces
 *
 * Every number in this dashboard is Lebanese, and every field asked for the
 * country code anyway: the hint said "with the country code and no +", the
 * placeholder was `96170123456`, and the operator retyped `961` for each driver
 * they added. That is three digits of ceremony per number, and three digits of
 * ceremony is where `+961`, `00961` and a leading local `0` all get typed by
 * different people on different days — none of which is the stored form, and
 * only one of which rings.
 *
 * So the code stops being something to type and becomes something to read. The
 * field is in two parts: a fixed `+961` with the flag, and a box holding the
 * digits that actually differ.
 *
 * ## The value is still the whole number
 *
 * `value` and `onChange` speak the **stored** form — `96170123456`, no `+` —
 * the same string the column holds and the same one `formatPhone`, the CHECK
 * constraint and the WhatsApp link already expect. Only the *display* is split.
 *
 * That is deliberate: a component whose value was the national part alone would
 * push the join out to every call site, and the join is the thing being
 * centralised. See `lib/phone.ts`, which owns both halves of it.
 *
 * ## Why the flag is drawn rather than written
 *
 * The obvious flag is the emoji, and on this product's own machines it is not a
 * flag. Windows ships no glyphs for regional-indicator pairs, so the emoji falls
 * back to rendering the two letters — a field captioned "LB +961", which is
 * both wrong-looking and slightly worse than having drawn nothing. This
 * dashboard is operated from Windows, so the emoji was never an option.
 *
 * A dozen lines of SVG render identically everywhere, scale with the type, and
 * cost no font.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  invalid,
  ref,
  "aria-label": ariaLabel,
}: {
  /** The stored international form, digits only: `96170123456`. */
  value: string;
  /** Receives the same form. Empty string when the field is cleared. */
  onChange: (next: string) => void;
  /** The national part only — the country code is not the caller's to suggest. */
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Overrides the field's own verdict. Rarely needed. */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
  "aria-label"?: string;
}) {
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  /** Digits only, capped, and with the country code removed if one was pasted. */
  function take(raw: string): void {
    onChange(internationalFrom(nationalPart(raw).slice(0, NATIONAL_DIGITS)));
  }

  return (
    <div
      className={cx(
        // The box `Input` draws, moved out to the group — because the border and
        // the ring belong around *both* parts. An input drawing its own border
        // inside this one would be a box within a box, and focusing it would
        // ring the digits rather than the field. `field-group` is what hands the
        // group the app's one focus ring; see `globals.css`.
        "field-group flex w-full items-stretch overflow-hidden rounded-md border bg-surface",
        "focus-within:bg-field-focus",
        isInvalid ? "border-danger" : "border-border",
        disabled && "opacity-60",
      )}
    >
      {/*
        A label, not a control. It is +961 for every number this product will
        ever hold, so there is nothing to choose and nothing to tab to: a select
        with one option is a keyboard stop that can only be left where it was.

        `aria-hidden`, because the input's own accessible name carries the
        country in words. Without it a screen reader announces the code, then the
        label, then the code again.
      */}
      <span
        aria-hidden
        className={cx(
          "flex shrink-0 select-none items-center gap-sm border-e border-border",
          "bg-neutral-fill px-md text-[15px] text-text-soft tabular-nums",
        )}
      >
        <LebaneseFlag />
        {PREFIX}
      </span>

      <input
        ref={ref}
        id={field?.id}
        value={nationalPart(value)}
        // Named in full, because what the field shows is a fragment. Without
        // this the label reads "WhatsApp number" over a box of eight digits, and
        // nothing spoken says which country they belong to.
        aria-label={ariaLabel ?? `Phone number, country code +${CALLING_CODE}`}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={NATIONAL_DIGITS}
        onChange={(event) => take(event.target.value)}
        onPaste={(event) => {
          // Pasting is how a whole number arrives — off a message, a spreadsheet,
          // a shopfront photo — and what arrives is usually the international
          // form the field has just stopped asking for. Taking the default here
          // would drop `96170123456` into an eight-character box and keep
          // `96170123`: a real number, belonging to somebody else.
          //
          // So a paste is routed through the same strip-and-cap as typing, which
          // removes the country code before the cap is applied.
          event.preventDefault();
          take(digitsOf(event.clipboardData.getData("text")));
        }}
        className={cx(
          "w-full min-w-0 bg-transparent px-md py-md text-[15px] text-text tabular-nums",
          "placeholder:text-text-faint",
          // No border and no ring of its own: both are the group's, drawn around
          // the pair.
          "border-0 outline-none focus:outline-none",
        )}
      />
    </div>
  );
}

/**
 * The flag of Lebanon, at the size of the text beside it.
 *
 * Red band, white band twice as tall, red band, and the cedar centred in the
 * white. The proportions are the flag's own 1:2:1; the cedar is a simplification
 * — three tiers and a trunk — because at this size the real one is a green
 * smudge, and the tiers are what make it read as a tree rather than a blob.
 *
 * The two colours are the flag's, written as literals rather than taken from the
 * theme. That is the one place in this codebase where naming a colour is right:
 * these are not roles the design system assigns, they are what the flag *is*,
 * and a red that followed the app's palette would be a different country's flag.
 */
function LebaneseFlag() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 16"
      className="h-[12px] w-[18px] shrink-0 rounded-[2px]"
    >
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="4" fill="#ee161f" />
      <rect y="12" width="24" height="4" fill="#ee161f" />
      <g fill="#00a651">
        <path d="M12 4.4 10.1 7.1h3.8z" />
        <path d="M12 5.9 9.2 8.8h5.6z" />
        <path d="M12 7.4 8.3 10.4h7.4z" />
        <rect x="11.4" y="10.2" width="1.2" height="1.4" />
      </g>
    </svg>
  );
}
