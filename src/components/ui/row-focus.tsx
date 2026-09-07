"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

/**
 * Bringing the row you just edited back into view.
 *
 * ## What this replaces
 *
 * Every editor in the dashboard used to open in a panel beside its list, and
 * several of those files say why in as many words: *it was never editing within
 * the row — it was not losing your place in the list.* Moving the editors onto
 * pages of their own gives that up, and on a menu of two hundred dishes
 * returning to the top is not a small loss.
 *
 * So the editor hands the list back the id it was working on — `?focus=<id>` —
 * and the list puts that row under the operator's eye. It is the panel's one
 * real advantage, kept.
 *
 * ## Why the URL and not a stored scroll offset
 *
 * A remembered offset is the wrong answer to a subtly different question. Rows
 * move: renaming a category can re-sort the list, archiving one removes it,
 * saving can drop a row out of the current filter entirely. An offset restores
 * a *position* and the thing that was there is somewhere else. An id restores
 * the **row**, and if it is gone the list simply stays where it opened, which
 * is the honest outcome.
 *
 * It also survives what a component's state does not — a refresh, a link
 * pasted to a colleague, or arriving from anywhere at all.
 *
 * ## It fires once
 *
 * `seen` guards against re-scrolling on every render while `?focus=` is still
 * in the URL. Without it, a list that refetches — which it does the moment the
 * save lands — would drag itself back down while the operator was already
 * scrolling somewhere else.
 */
export function useRowFocus() {
  const focused = useSearchParams().get("focus");
  const seen = useRef<string | null>(null);

  /**
   * Put on the row whose id might be the focused one.
   *
   * A ref callback rather than an effect, because the node is the thing being
   * waited for: React calls this the moment the row is attached, which on a
   * list that has just finished loading is exactly when it can be scrolled to.
   * An effect would have to guess at that with a timeout.
   */
  const attach = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (!node || !focused || id !== focused || seen.current === focused) {
        return;
      }
      seen.current = focused;
      // `center`, not `nearest`: a row an inch below the fold is technically
      // scrolled-to by `nearest` and still reads as "it did nothing".
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    [focused],
  );

  /**
   * Whether this row is the one just returned from.
   *
   * Drawn as the ring an open panel used to put on its row — the same signal,
   * for the same "this is the one you were working on", so nothing new has to
   * be learned.
   */
  const isFocused = useCallback((id: string) => id === focused, [focused]);

  return { attach, isFocused };
}

/** The ring a returned-to row wears. The one an open panel used to draw. */
export const FOCUS_RING =
  "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)] border-active";
