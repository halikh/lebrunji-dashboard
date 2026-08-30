"use client";

import { useEffect, useRef, useState } from "react";

import { t } from "@/i18n/translations";

import { cx } from "./index";

/**
 * A value the operator might act on: ring it, or paste it somewhere.
 *
 * Three shapes, because the two affordances are independent:
 *
 * - **Both** — a phone number. Tap to ring, copy to paste into a courier app.
 * - **Copy only** — an order code, an id. There is nowhere to go, but it gets
 *   pasted into a message constantly, and reading a sixteen-character code back
 *   off a screen by hand is where mistakes come from.
 * - **Link only** — an address that opens a map. Copying a formatted address is
 *   rarely what anybody wants.
 *
 * ## Why copy is its own button
 *
 * Making the value itself copy-on-click sounds tidier and is worse: the same
 * gesture would then either ring somebody or copy, depending on a prop, and a
 * phone number that dials when you meant to copy it is a call to a customer at
 * eleven at night.
 *
 * ## What "copied" says, and to whom
 *
 * The icon changes for two seconds. That is invisible to a screen reader, so
 * the confirmation is also announced — the clipboard is the one interaction
 * with no other feedback at all, and a copy that silently failed looks exactly
 * like one that worked.
 */
export function Copyable({
  value,
  href,
  label,
  copyable = true,
  className,
}: {
  /** What is shown, and what is copied. */
  value: string;
  /** Where it goes. Omit for copy-only. */
  href?: string;
  /** Names the copy button — "Copy phone number", not "Copy". */
  label: string;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleared on unmount: the panel closes while the confirmation is still
  // showing, and a timer that fires into an unmounted component is a warning
  // in development and a leak in a long session.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused, or no clipboard API — an insecure origin has none. Nothing to
      // recover: the value is on screen and can be selected by hand, which is
      // exactly what somebody does next.
    }
  }

  return (
    <span className={cx("inline-flex items-center gap-xs", className)}>
      {href ? (
        <a href={href} className="font-semibold text-primary hover:underline">
          {value}
        </a>
      ) : (
        // `select-all` so one click selects the whole value — the fallback when
        // the clipboard is unavailable, and how people copy part of it anyway.
        <span className="select-all font-semibold tabular-nums">{value}</span>
      )}

      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={label}
          className="rounded-sm p-xxs text-text-faint hover:bg-neutral-fill hover:text-text-soft"
        >
          {copied ? <TickIcon /> : <CopyIcon />}
        </button>
      )}

      {/* Announced, not only drawn. `aria-live` on a container that is always
          present, rather than mounting the message — a live region added at the
          moment it has something to say is often missed. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("common.copied") : ""}
      </span>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}
