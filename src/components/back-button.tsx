"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { useConfirmLeave } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";

/**
 * The one Back in the dashboard: it goes where the browser's Back would, so
 * it always means "the page I was just on", whatever page that was.
 *
 * ## Why not a link to the parent
 *
 * Each page used to carry its own "← Shops", "← All drivers", "← Back to the
 * order", each a guess at where the operator had come from. A driver reached
 * from an order went back to the drivers list; a dish reached from search went
 * back to the menu. History knows; a page does not.
 *
 * ## Why it hides on the first page
 *
 * A page opened straight — a pasted link, a new tab, the first screen after
 * signing in — has nothing in this dashboard before it, and `history.back()`
 * there would leave the dashboard. So it shows only once there is a page of
 * ours to go back to.
 *
 * The browser does not say how deep its history is (`history.length` counts
 * pages of other sites too, and forward entries), so we count ourselves: every
 * `pushState` stamps the new entry with one more than the current one, every
 * `replaceState` keeps the current number, and a pop reads the number of the
 * entry it landed on. The stamp lives in `history.state`, so a reload in the
 * middle of a session still knows where it is.
 */
const KEY = "__lebrunjiDepth";

let depth = 0;
const listeners = new Set<() => void>();

function set(next: number) {
  if (next === depth) return;
  depth = next;
  for (const listener of listeners) listener();
}

function read(state: unknown): number {
  const value = (state as Record<string, unknown> | null)?.[KEY];
  return typeof value === "number" ? value : 0;
}

function install() {
  const w = window as Window & { [KEY]?: true };
  if (w[KEY]) return; // Fast refresh runs this module again.
  w[KEY] = true;

  depth = read(history.state);
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);

  history.pushState = (state, unused, url) => {
    const next = depth + 1;
    push({ ...(state as object | null), [KEY]: next }, unused, url);
    set(next);
  };
  history.replaceState = (state, unused, url) => {
    replace({ ...(state as object | null), [KEY]: depth }, unused, url);
  };
  window.addEventListener("popstate", (event) => set(read(event.state)));
}

if (typeof window !== "undefined") install();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether there is a page of ours to go back to. */
export function useCanGoBack(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => depth > 0,
    () => false,
  );
}

export function BackButton() {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const canGoBack = useCanGoBack();
  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // History pops cannot be cancelled once they start, so ask first.
        void confirmLeave().then((leave) => {
          if (leave) router.back();
        });
      }}
      className="inline-flex w-fit items-center gap-1 rounded-md text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t("common.back")}
    </button>
  );
}
