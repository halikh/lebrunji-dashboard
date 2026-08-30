"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether an element is currently in view.
 *
 * For the pattern where a control lives at the end of a list *and* is pinned to
 * the bottom while that end is out of sight — so a short list gets one button in
 * its natural place, and a long one gets it within reach without ever showing
 * two.
 *
 * ## Defaults to visible, deliberately
 *
 * If `IntersectionObserver` is missing, or the ref is never attached, the answer
 * is "yes, it is on screen". That resolves to *no pinned bar*, which leaves the
 * ordinary in-list button doing its job. Guessing the other way would pin a bar
 * that might duplicate a button already visible — an extra copy of a control is
 * a worse failure than the absence of a convenience.
 */
export function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting);
      },
      // No margin: the question is literally whether it can be seen. A margin
      // here would hand over to the pinned copy while the real one was still
      // in view, which is the two-buttons state this exists to avoid.
      { threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A tuple, not an object with a `ref` on it. Reading a property named `ref`
  // during render is the shape React's lint rule warns about, and destructuring
  // by position says the same thing without tripping it.
  return [ref, onScreen] as const;
}
