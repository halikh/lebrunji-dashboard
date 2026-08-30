"use client";

import { useCallback, useState } from "react";

/**
 * Whether an element is currently in view.
 *
 * For the pattern where a control lives at the end of a list *and* is pinned to
 * the bottom while that end is out of sight — so a short list gets one button in
 * its natural place, and a long one gets it within reach without ever showing
 * two.
 *
 * ## Why this is a callback ref and not a ref plus an effect
 *
 * The obvious version — a `useRef`, and a mount effect that observes
 * `ref.current` — is subtly broken for exactly the elements this is used on,
 * and it was: **the watched element is conditionally rendered.**
 *
 * The effect runs once, on mount, when the list is still loading and the button
 * does not exist yet, so there is nothing to observe and it never runs again.
 * And every time the element is removed and put back — the add form opening and
 * being cancelled — React creates a *new* node while the observer, if it ever
 * attached, is still watching the old detached one. The answer then never
 * changes again, and what that looks like is two buttons on screen at once.
 *
 * A callback ref is called with the node every time it appears and with the
 * cleanup when it goes, which is precisely the lifecycle being asked about.
 *
 * ## Defaults to visible, deliberately
 *
 * With no observer, no node, or no support, the answer is "yes, it is on
 * screen". That resolves to *no pinned bar*, leaving the ordinary in-list
 * button doing its job. Guessing the other way would pin a bar that might
 * duplicate a button already visible — an extra copy of a control is a worse
 * failure than the absence of a convenience.
 */
export function useOnScreen<T extends HTMLElement>() {
  const [onScreen, setOnScreen] = useState(true);

  const attach = useCallback((node: T | null) => {
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting);
      },
      // No margin: the question is literally whether it can be seen. A margin
      // here would hand over to the pinned copy while the real one was still
      // in view, which is the two-buttons state this exists to avoid.
      { threshold: 0 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      // Back to the safe answer. The element has gone, so "is it on screen" has
      // no meaning — and leaving the last `false` behind would keep a pinned
      // bar up for a button that no longer exists.
      setOnScreen(true);
    };
  }, []);

  // A tuple, not an object with a `ref` on it. Reading a property named `ref`
  // during render is the shape React's lint rule warns about, and destructuring
  // by position says the same thing without tripping it.
  return [attach, onScreen] as const;
}
