"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import { t } from "@/i18n/translations";

import { cx } from "./cx";

/*
 * A width the person sets by dragging an edge, remembered per browser.
 *
 * Read through `useSyncExternalStore` so the server render (the default) and
 * the first client render agree, and the stored width takes over straight
 * after — no flash of the wrong width, no hydration warning.
 */

const listeners = new Set<() => void>();

function read(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    // Storage unavailable: the default width.
    return fallback;
  }
}

function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Not remembered; it still applies for this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `[width, setWidth]` for a panel, persisted under `key`. */
export function useStoredWidth(
  key: string,
  fallback: number,
): [number, (value: number) => void] {
  const width = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback((value: number) => write(key, value), [key]);
  return [width, set];
}

/**
 * The strip on a panel's edge that resizes it. Drag with a pointer, or focus
 * it and use the arrow keys; double-click puts the default width back.
 *
 * `edge` is which side of the panel the handle sits on. A panel on the left of
 * the screen (the sidebar) has it on its end edge and grows as the pointer
 * moves toward the end; a panel on the right (the order receipt) has it on its
 * start edge and grows the other way. Both are flipped for right-to-left.
 */
export function ResizeHandle({
  edge,
  width,
  min,
  max,
  onResize,
  onReset,
  label,
  className,
}: {
  edge: "start" | "end";
  width: number;
  min: number;
  max: number;
  /** Called with the raw dragged width; the caller decides what it means. */
  onResize: (width: number) => void;
  onReset?: () => void;
  label?: string;
  className?: string;
}) {
  const start = useRef<{ x: number; width: number; dir: number } | null>(null);

  function direction(element: HTMLElement) {
    const rtl = getComputedStyle(element).direction === "rtl";
    // Moving right grows an end-edge handle in LTR.
    const sign = edge === "end" ? 1 : -1;
    return rtl ? -sign : sign;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label ?? t("common.resize")}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = {
          x: event.clientX,
          width,
          dir: direction(event.currentTarget),
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(event) => {
        const from = start.current;
        if (!from) return;
        onResize(from.width + (event.clientX - from.x) * from.dir);
      }}
      onPointerUp={(event) => {
        start.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16;
        const dir = direction(event.currentTarget);
        if (event.key === "ArrowRight") onResize(width + step * dir);
        else if (event.key === "ArrowLeft") onResize(width - step * dir);
        else if (event.key === "Home") onResize(min);
        else if (event.key === "End") onResize(max);
        else return;
        event.preventDefault();
      }}
      className={cx(
        "group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none",
        edge === "end" ? "-end-1" : "-start-1",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 start-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent/50 group-focus-visible:bg-accent group-active:bg-accent"
      />
    </div>
  );
}
