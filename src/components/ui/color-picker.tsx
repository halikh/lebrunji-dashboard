"use client";

import type { ReactNode } from "react";

import { Input, cx } from "@/components/ui";
import { t } from "@/i18n/translations";

/**
 * A colour, picked or typed — and optionally chosen off a row of presets.
 *
 * ## Why the native picker
 *
 * It is the right tool: it is the one every operating system already taught
 * this person to use, it carries an eyedropper on the desktops that have one,
 * and a hand-rolled wheel would be a worse version of it that also has to be
 * reachable from a keyboard.
 *
 * The label *wraps* the input rather than sitting beside it, so the swatch **is**
 * the control and the two cannot drift apart.
 *
 * ## And why a text box as well
 *
 * A brand colour arrives as six characters in an email, and hunting for it on a
 * wheel is worse than pasting it. Anything that is not a colour yet is simply
 * not applied — a half-typed `#1e` is somebody mid-word, not a mistake to
 * report.
 *
 * ## Null is a real value here
 *
 * `null` means *not set* — follow whatever the client's palette says. It is not
 * the same as white, and clearing the box returns to it rather than to `#ffffff`.
 * `fallback` is what null resolves to, so the swatch shows the colour that will
 * actually be used rather than an empty hole.
 *
 * ## Presets are the caller's
 *
 * The tag editor's five are the app's own tones and picking one writes null
 * rather than a hex, so a tag left on a preset still follows the palette if the
 * palette moves. A category's are a starting point and write a value. Both are
 * true and neither belongs in here, so a preset is a swatch plus what pressing
 * it does.
 */
export type ColorPreset = {
  /** What the swatch is painted. */
  hex: string;
  label: string;
  /** Whether this preset is the current answer. */
  on: boolean;
  onSelect: () => void;
};

export function ColorPicker({
  value,
  onChange,
  fallback,
  presets = [],
  customLabel = t("color.custom"),
  hexLabel = t("color.hex"),
  trailing,
}: {
  /** The chosen colour, or null for "whatever the palette says". */
  value: string | null;
  onChange: (hex: string | null) => void;
  /** What null resolves to — the colour the swatch shows while nothing is set. */
  fallback: string;
  presets?: ColorPreset[];
  customLabel?: string;
  hexLabel?: string;
  /** Anything that belongs on the same row — a contrast reading, a note. */
  trailing?: ReactNode;
}) {
  const shown = value ?? fallback;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-sm">
        {presets.map((preset) => (
          <button
            key={preset.hex + preset.label}
            type="button"
            title={preset.label}
            aria-label={preset.label}
            aria-pressed={preset.on}
            onClick={preset.onSelect}
            className={cx(
              "size-[34px] rounded-full border-2",
              preset.on ? "border-active" : "border-border hover:border-active",
            )}
            style={{ background: preset.hex }}
          />
        ))}

        <label
          className={cx(
            "relative flex size-[34px] cursor-pointer items-center justify-center rounded-full border-2",
            value ? "border-active" : "border-border hover:border-active",
          )}
          style={{ background: shown }}
          title={customLabel}
        >
          <input
            type="color"
            value={shown}
            onChange={(event) => onChange(event.target.value)}
            aria-label={customLabel}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {/* A plus while nothing is set, so an unset swatch reads as "add a
              colour" rather than as one that happens to be the fallback. */}
          {!value && (
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text)"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </label>

        {trailing}
      </div>

      <span className="w-[140px]">
        <Input
          value={value ?? ""}
          onChange={(event) => {
            const typed = event.target.value.trim();
            if (typed === "") {
              onChange(null);
              return;
            }
            onChange(typed.startsWith("#") ? typed : `#${typed}`);
          }}
          placeholder={fallback}
          aria-label={hexLabel}
          className="font-mono text-[13px] tabular-nums"
        />
      </span>
    </div>
  );
}

/** Whether a string is a colour this app will store — `0114`'s shape, exactly. */
export function isHex(value: string | null): value is string {
  return value !== null && /^#[0-9a-fA-F]{6}$/.test(value);
}
