import type { ReactNode } from "react";

import { Lebrunji, type Pose } from "@/components/brand/lebrunji";
import { t, type Params, type TranslationKey } from "@/i18n/translations";

import { cx } from "./index";

/**
 * What a screen shows when it has nothing to show.
 *
 * An empty screen is a state, not an absence, and the difference matters here:
 * "no orders right now" and "orders failed to load" look identical if neither
 * is drawn. Every list in this dashboard renders one of four things — idle,
 * loading, empty, failed — and this is the third.
 *
 * `mood` is which face the mascot pulls. It is a small thing and it is the
 * reason an empty queue reads as *quiet* rather than as *broken*, which is the
 * single most common misreading of a blank screen.
 *
 * ## It is the only empty state now
 *
 * There was a second one, and it was written out eleven times: a dashed box
 * with one muted line in it. Two idioms for one state, so a customer's empty
 * order list and an empty archive looked like different kinds of nothing — and
 * the dashed box in particular read as a *drop target*, a place something was
 * supposed to go, rather than as a report that there is nothing to show.
 *
 * So `bodyKey` is optional and `params` exists: those eleven had a single line
 * and some of them name a search term, and both had to be expressible here or
 * the copies would have stayed.
 */
export function EmptyState({
  titleKey,
  bodyKey,
  params,
  mood = "waiting",
  action,
  className,
}: {
  titleKey: TranslationKey;
  /**
   * A second line, where there is one worth writing.
   *
   * Optional because plenty of these are complete in one sentence — "No
   * categories match 'pizz'" says the finding and the reason together — and a
   * body invented to fill the slot is the kind of line that gets read once and
   * then never again.
   */
  bodyKey?: TranslationKey;
  /** Filled into both lines. Usually the search term that found nothing. */
  params?: Params;
  mood?: "waiting" | "done" | "lost";
  /**
   * The way out, where there is one — a link or a button under the words.
   * The app's empty states always carry one; here most do not, because the
   * screen's own toolbar already holds the action.
   */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex h-full flex-col items-center justify-center gap-lg px-xxl py-huge text-center",
        className,
      )}
    >
      <Lebrunji pose={POSE[mood]} size={MASCOT} />
      <div className="flex max-w-[380px] flex-col gap-xs">
        <h2 className="text-[18px]">{t(titleKey, params)}</h2>
        {bodyKey && (
          <p className="text-[14px] text-text-soft">{t(bodyKey, params)}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * The mascot's slot, in pixels square. Smaller than the app's ~180pt: there
 * the pose is most of a phone screen, and here it often sits inside one tab of
 * a panel.
 */
const MASCOT = 140;

/**
 * The dashboard's three moods, as the illustrator's poses — chosen the way the
 * app chose them.
 *
 * - **waiting** — sitting down. Nothing is on its way; the app's empty orders
 *   list uses the same pose.
 * - **lost** — the empty bag. A search that found nothing; the app's empty
 *   cart is this pose.
 * - **done** — verified. The queue is clear, or there is nothing left to
 *   restore: work finished, not work missing.
 */
const POSE: Record<"waiting" | "done" | "lost", Pose> = {
  waiting: "sit-down",
  lost: "empty bag",
  done: "verified",
};
