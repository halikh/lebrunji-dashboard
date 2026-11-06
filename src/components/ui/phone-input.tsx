"use client";

import type { Ref } from "react";

import { t } from "@/i18n/translations";
import {
  CALLING_CODE,
  digitsOf,
  internationalFrom,
  nationalPart,
} from "@/lib/phone";

import { cx } from "./cx";

/** A Lebanese national number is seven digits or eight. Eight is the ceiling. */
const NATIONAL_DIGITS = 8;

/** The code as drawn — the same three digits in every language, so not a key. */
const PREFIX = `+${CALLING_CODE}`;

/**
 * A Lebanese phone number, typed as the part that varies.
 *
 * Every number here is Lebanese, so the country code is something to read,
 * not to type: a fixed `+961` with the flag, and a box for the digits that
 * differ. `value`/`onChange` still speak the **stored** form (`96170123456`,
 * no `+`) — only the display is split; `lib/phone.ts` owns both halves.
 *
 * A paste goes through the same strip-and-cap as typing, so `96170123456`
 * pasted into the eight-digit box keeps `70123456` rather than `96170123` —
 * a real number, belonging to somebody else.
 *
 * The flag is SVG, not the emoji: Windows renders regional indicators as the
 * letters "LB".
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
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  className,
}: {
  /** The stored international form, digits only: `96170123456`. */
  value: string;
  /** Receives the same form. Empty string when the field is cleared. */
  onChange: (next: string) => void;
  /** The national part only. */
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
  "aria-label"?: string;
  /** `Field`'s render props. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
}) {
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");

  function take(raw: string): void {
    onChange(internationalFrom(nationalPart(raw).slice(0, NATIONAL_DIGITS)));
  }

  return (
    <div
      dir="ltr"
      className={cx(
        // The border and ring belong around both parts, so the group draws them.
        "flex h-9 w-full items-stretch overflow-hidden rounded-md border bg-surface shadow-xs transition-[border-color,box-shadow]",
        "focus-within:border-accent focus-within:shadow-focus",
        isInvalid
          ? "border-danger focus-within:border-danger focus-within:shadow-[0_0_0_3px_rgb(217_45_32/0.15)]"
          : "border-line-strong hover:border-ink-4",
        disabled && "cursor-not-allowed bg-subtle opacity-70",
        className,
      )}
    >
      {/* Not a control: there is nothing to choose. Hidden from assistive
          technology because the input's own name says the country. */}
      <span
        aria-hidden
        className="flex shrink-0 items-center gap-2 border-e border-line bg-subtle px-3 text-[14px] text-ink-2 tabular-nums select-none"
      >
        <LebaneseFlag />
        {PREFIX}
      </span>

      <input
        ref={ref}
        id={id}
        value={nationalPart(value)}
        aria-label={
          ariaLabel ?? t("controls.phoneLabel", { code: CALLING_CODE })
        }
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={NATIONAL_DIGITS}
        onChange={(event) => take(event.target.value)}
        onPaste={(event) => {
          event.preventDefault();
          take(digitsOf(event.clipboardData.getData("text")));
        }}
        className="w-full min-w-0 border-0 bg-transparent px-3 text-[14px] text-ink tabular-nums outline-none placeholder:text-ink-4 focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

/** The flag of Lebanon, at text size. Its colours are the flag's, not the theme's. */
function LebaneseFlag() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 16"
      className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-line"
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
