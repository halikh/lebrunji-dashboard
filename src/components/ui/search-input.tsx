"use client";

import type { Ref } from "react";

import { Input, cx } from "./index";

/**
 * A search box.
 *
 * Every list in the dashboard has one, and each was a bare `Input` — which
 * meant every one of them had the same two problems, in nine places.
 *
 * ## The browser was filling them in
 *
 * Chrome offered a saved email address in the *Settings* search box, filled it
 * in on arrival, and the screen dutifully searched the help topics for
 * `you@example.com` and reported that nothing matched. It looks like a bug in
 * the search.
 *
 * Autofill guesses from the shape of a field, and an unnamed text input in a
 * page that once had a sign-in form is a good enough guess. Three things say no
 * together, and it takes all three: `type="search"`, which is what this is;
 * `autoComplete="off"`; and a `name` that does not read like an identity.
 *
 * ## The icon is what makes it recognisable as one
 *
 * A rounded box with grey placeholder text is the same shape as every other
 * field on the screen. The magnifier is the one mark that says "type here to
 * narrow this" rather than "fill this in" — worth more on this control than on
 * any other, because a search box is the thing people look for *before* they
 * read anything.
 *
 * It is `pointer-events-none` and `aria-hidden`: it is decoration over an
 * input, and a click landing on it rather than in the field would be a box that
 * does not focus where you pressed.
 *
 * ## `padding` rather than a class
 *
 * `Input` takes its horizontal padding as a prop for a stated reason —
 * `className="ps-[42px]"` over a base `px-md` sets `padding-inline-start`
 * against `padding-left`, two properties resolving to one value, and which wins
 * depends on stylesheet order. Replacing the value leaves nothing to conflict.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Also the accessible name — a search box rarely has a visible label. */
  placeholder: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div className={cx("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-md text-text-faint"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>

      <Input
        ref={ref}
        type="search"
        // The three that stop a browser filling this in with somebody's email.
        // Any one of them alone is a suggestion; together they are an answer.
        name="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        padding="ps-[38px] pe-md"
      />
    </div>
  );
}
