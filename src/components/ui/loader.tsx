import { t } from "@/i18n/translations";

import { cx } from "./index";

/**
 * The spinner, once.
 *
 * ## Why a spinner at all, when this codebase prefers skeletons
 *
 * It usually does, and for a good reason: a card-shaped hole promises a card,
 * a spinner promises only that something is happening. Every *list* in the
 * dashboard therefore draws placeholder rows rather than this.
 *
 * A spinner is right for the one case a skeleton cannot cover — a **navigation**
 * between pages, where the next screen's shape is not known yet. There is
 * nothing to draw the outline of, and the honest thing is to say "coming" and
 * get out of the way.
 *
 * ## Why it is not shown immediately
 *
 * `delay` holds it back. Most navigations in a warm cache land in well under a
 * hundred milliseconds, and a spinner that appears and vanishes inside that
 * reads as a flash of something broken — worse than the brief nothing it
 * replaced. It is drawn only once the wait has become real, which is the same
 * rule `usePending` follows in the app.
 *
 * The animation is CSS rather than a timer, so a held-back spinner costs
 * nothing until it is on screen.
 */
export function Loader({
  label,
  size = 28,
  className,
}: {
  /**
   * What is being waited for, read out but not drawn.
   *
   * A visible "Loading…" under a spinner is a word nobody reads twice; the
   * spinner has already said it. A screen reader gets no spinner at all, so the
   * label is the only thing that reaches it — which is why it is a `status`
   * rather than a decoration.
   */
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx("flex items-center justify-center", className)}
    >
      <span
        aria-hidden
        style={{ width: size, height: size }}
        // `border-current` with one transparent edge is the whole spinner: no
        // SVG, no library, and it takes the colour of whatever it is placed in.
        className="animate-spin rounded-full border-2 border-current border-t-transparent text-text-faint"
      />
      <span className="sr-only">{label ?? t("common.loading")}</span>
    </div>
  );
}

/**
 * The whole pane, waiting.
 *
 * What a route's `loading.tsx` renders while the next page is being fetched.
 * Centred in the space the page will fill, so the spinner appears where the
 * content is about to be rather than jumping there once it arrives.
 *
 * `delay-200` on the fade: see the note above on why this is not shown at once.
 * The element is mounted immediately — Suspense gives no way to defer that —
 * and simply stays invisible until the wait has lasted long enough to be worth
 * reporting.
 */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-huge">
      <Loader label={label} size={32} className="animate-fade-in" />
    </div>
  );
}
