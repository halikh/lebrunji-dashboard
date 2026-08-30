'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cx } from './index';

/**
 * A modal dialog, built on the native `<dialog>` element.
 *
 * ## Why native rather than a div
 *
 * `showModal()` gives four things that are otherwise a few hundred lines of
 * fiddly code, and each one is a real accessibility failure when it is missing:
 *
 * - **Focus is trapped** inside the dialog, so Tab cannot wander into the page
 *   behind it — which for a sighted keyboard user means the focus ring simply
 *   disappears.
 * - **Escape closes it**, without a key handler to remember.
 * - **Focus returns** to whatever opened it when it closes. Losing that means
 *   the next Tab starts from the top of the document.
 * - **The rest of the page becomes inert** — not merely visually covered, but
 *   unreachable by a screen reader, which is the part `aria-hidden` juggling
 *   usually gets wrong.
 *
 * ## The one thing native does not do
 *
 * Escape fires `cancel`, and by default that closes the dialog without telling
 * React. So the `cancel` event is intercepted below and routed through the same
 * `onClose` as everything else — otherwise the component's state and the DOM
 * disagree, and the dialog cannot be reopened.
 *
 * Backdrop clicks also close, because a modal you cannot dismiss by clicking
 * away is a modal people feel trapped by — and the click target is computed
 * from the dialog's own box, since a click on the backdrop reports the dialog
 * as its target.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // `open` is a prop, and the dialog's openness is DOM state. Driving it from
    // an effect is what keeps the two in step — setting the `open` *attribute*
    // instead would show the dialog without any of the behaviour above.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        // Escape. Prevented so the close goes through React rather than around
        // it, leaving `open` true and the dialog shut.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom;
        if (outside) onClose();
      }}
      className={cx(
        // The open/close transition and the backdrop's colour are in
        // `globals.css`, on `dialog` — so every overlay added later gets them
        // without having to remember, and there is one place they are tuned.
        'm-auto w-[min(420px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-xxl',
        'text-text',
        className,
      )}
    >
      {children}
    </dialog>
  );
}
