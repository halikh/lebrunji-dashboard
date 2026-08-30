"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

/**
 * Every control in a form sits in a `Field`, and every `Field` has somewhere to
 * put a sentence.
 *
 * ## Why the wiring is context rather than props
 *
 * A control needs three things tied to it: an `id` its label points at, an
 * `aria-describedby` naming its hint and its error, and `aria-invalid` when it
 * is wrong. Passing those down by hand means every call site can forget one,
 * and the one that gets forgotten is `aria-describedby` — because nothing looks
 * wrong on screen when it is missing. The error is drawn, it is simply never
 * read out.
 *
 * So `Field` provides them and the controls take them. A field's label, its
 * hint and its error are connected by construction, and a new control gets it
 * for free by reading the same context.
 *
 * ## Hint and error are one slot, not two
 *
 * They occupy the same line, and the error wins while there is one. Showing
 * both means the operator reads advice about a value they have already been
 * told is wrong; showing them in separate rows makes the form jump every time a
 * message appears.
 *
 * The slot is only rendered when there is something in it — a permanently
 * reserved empty line under every field is a lot of grey space to buy against
 * a shift that only happens while somebody is being corrected.
 *
 * ## Why the words are indented
 *
 * An input in this project has a large radius and horizontal padding, so the
 * text a person types starts some way inside its left edge. A label or a hint
 * set flush at zero therefore lines up with the *border* and with nothing they
 * can read — and against a pill-shaped field, whose edge curves away, it reads
 * as slightly misaligned rather than as deliberately outdented.
 *
 * So they are inset by the control's own padding, and the column of text runs
 * straight down: label, value, hint.
 */

export type FieldWiring = {
  id: string;
  /** Ids of the hint and the error, space-separated, or undefined. */
  describedBy: string | undefined;
  invalid: boolean;
};

const FieldContext = createContext<FieldWiring | null>(null);

/**
 * What a control reads.
 *
 * Returns `null` outside a `Field`, which is legitimate: a search box labelled
 * by `aria-label` is not a form field and has nothing to describe it.
 */
export function useFieldWiring(): FieldWiring | null {
  return useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  id: providedId,
  children,
}: {
  label: string;
  /** Standing advice — what this is for, or what a valid answer looks like. */
  hint?: string;
  /** Replaces the hint while present. */
  error?: string | null;
  /** Only when something outside needs to point at the control. */
  id?: string;
  children: ReactNode;
}) {
  const generated = useId();
  const id = providedId ?? generated;

  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;

  const describedBy =
    [error ? errorId : hintId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className="flex flex-col gap-xs">
        <label
          htmlFor={id}
          className="ps-md text-[13px] font-semibold text-text-soft"
        >
          {label}
        </label>

        {children}

        {error ? (
          // `alert`, because it appears in response to something the operator
          // just did and needs to reach them without their going looking.
          <p
            id={errorId ?? undefined}
            role="alert"
            className="ps-md text-[13px] font-medium text-danger"
          >
            {error}
          </p>
        ) : (
          hint && (
            <p
              id={hintId ?? undefined}
              className="ps-md text-[13px] text-text-faint"
            >
              {hint}
            </p>
          )
        )}
      </div>
    </FieldContext.Provider>
  );
}
