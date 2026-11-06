"use client";

import { useEffect, useRef } from "react";

import { t } from "@/i18n/translations";

import { Button } from "./button";
import { Spinner } from "./spinner";

/**
 * Asks for the next page when the end of the list comes into view.
 *
 * Scroll rather than page numbers: "page 4" of a live list changes meaning
 * every time a row arrives (the query underneath is keyset for the same
 * reason). The next page is requested 400px before the sentinel shows, so
 * rows usually arrive before the operator reaches the bottom.
 *
 * The button is what the sentinel *is* — the observer only presses it. An
 * observer never fires on a list too short to scroll, inside the wrong
 * scroll container, or where it is unsupported; then the failure is one
 * extra click rather than a list that silently stops halfway.
 */
export function InfiniteSentinel({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // In a ref so the observer is not rebuilt each render — reattaching it
  // mid-scroll can drop the intersection that was about to fire.
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !hasMore || loading) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          loadMoreRef.current();
      },
      { rootMargin: "400px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
    // `loading` on purpose: torn down while a page is in flight, so a fast
    // scroll cannot ask for the same page twice.
  }, [hasMore, loading]);

  if (!hasMore && !loading) return null;

  return (
    <div ref={ref} className="flex justify-center py-4">
      {loading ? (
        // Announced: rows appearing below the fold are otherwise invisible.
        <span
          role="status"
          className="flex h-8 items-center gap-2 text-[13px] text-ink-3"
        >
          <Spinner className="size-3.5" />
          {t("common.loading")}
        </span>
      ) : (
        <Button variant="ghost" size="sm" onClick={onLoadMore}>
          {t("controls.loadMore")}
        </Button>
      )}
    </div>
  );
}
