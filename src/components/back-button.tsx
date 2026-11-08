"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
 * ## The first page goes up instead (user, 2026-11-08: "it should always
 * be shown")
 *
 * A page opened straight — a pasted link, a new tab, a reload — has nothing
 * in this dashboard before it, and `history.back()` there would leave the
 * dashboard. It used to hide there, which read as a page with no way out. Now
 * it goes up to the page this one belongs to (`parentOf`): a dish to its
 * shop's menu, a branch to the shop's branches, a record to its list.
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

/** The home screen: the one page with nothing above it. */
const HOME = "/orders";

/**
 * Where a page opened with no history goes up to: the page it belongs to.
 *
 * Mostly the path with its last part dropped. The exceptions are the paths
 * whose parent has no page of its own — a shop's dishes and branches live on
 * tabs of the shop, help and legal pages on Settings. Null on the home screen.
 */
export function parentOf(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0 || pathname === HOME) return null;
  if (parts[0] === "shops" && parts.length >= 4) {
    const tab = parts[2] === "branches" ? "branches" : "menu";
    return `/shops/${parts[1]}?tab=${tab}`;
  }
  if (parts[0] === "settings" && parts.length >= 2) return "/settings";
  if (parts.length === 1) return HOME;
  return `/${parts.slice(0, -1).join("/")}`;
}

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const confirmLeave = useConfirmLeave();
  const canGoBack = useCanGoBack();
  const parent = parentOf(pathname);
  if (!canGoBack && parent === null) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // History pops cannot be cancelled once they start, so ask first.
        void confirmLeave().then((leave) => {
          if (!leave) return;
          if (canGoBack) router.back();
          else if (parent) router.push(parent);
        });
      }}
      className="inline-flex w-fit items-center gap-1 rounded-md text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      {t("common.back")}
    </button>
  );
}
