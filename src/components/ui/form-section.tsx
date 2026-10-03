import type { ReactNode } from "react";

/**
 * A card around a run of related fields, with a heading over it.
 *
 * For an editor long enough that one run of controls reads as a settings
 * dump: the cards are what turn it back into the handful of decisions it is.
 * The heading is optional — a card holding the record itself (its name, its
 * switch) is not a question about it, and a label on it would only repeat the
 * page title.
 *
 * Each card is a size container, for `FieldPair` and anything else inside that
 * wants to lay itself out by the card's width rather than the window's.
 */
export function FormSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="@container flex min-w-0 flex-col gap-lg rounded-md border border-border bg-surface p-lg">
      {title && (
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/**
 * Two fields side by side, when the card has room for them.
 *
 * A container query, not a viewport one: a card's width depends on whatever
 * column it sits in as much as on the window, so the viewport says nothing
 * about whether two 240px controls fit. 32rem is the pair plus the gap.
 * `items-start` so an error or a long hint under one does not stretch the
 * other to match it.
 *
 * A single child — a field hidden by another's answer, say — keeps half the
 * row rather than stretching, so fields do not change width as the form is
 * filled in.
 */
export function FieldPair({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-lg @[32rem]:grid-cols-2">
      {children}
    </div>
  );
}
