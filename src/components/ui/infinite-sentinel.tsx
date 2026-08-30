"use client";

import { useEffect, useRef } from "react";

import { t } from "@/i18n/translations";

/**
 * Asks for the next page when the end of the list comes into view.
 *
 * ## Why scroll rather than Next and Prev
 *
 * Page numbers over a live list are a fiction. "Page 4" changes meaning every
 * time an order arrives, and a reader who pressed Next would see rows they had
 * already read and miss rows they had not — the same reason the query underneath
 * is keyset rather than offset. Scrolling asks the only question that stays true:
 * "what comes after the last thing I have seen".
 *
 * ## `rootMargin`, and why it is generous
 *
 * The next page is requested 400px *before* the sentinel is visible, so the rows
 * usually arrive before the operator reaches the bottom. Waiting for the
 * sentinel to actually appear produces a visible stall at the end of every page,
 * which reads as the list ending.
 *
 * ## Why there is still a button
 *
 * An `IntersectionObserver` never fires if the list is short enough not to
 * scroll, if the scroll container is the wrong one, or if the observer is not
 * supported. The button is what the sentinel *is* — the observer just presses it
 * — so the failure mode is one extra click rather than a list that silently
 * stops halfway.
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

  // Held in a ref so the observer is not rebuilt on every render — reattaching
  // it mid-scroll can drop the intersection that was about to fire.
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
    // `loading` is a dependency on purpose: the observer is torn down while a
    // page is in flight, so a fast scroll cannot ask for the same page twice.
  }, [hasMore, loading]);

  if (!hasMore && !loading) return null;

  return (
    <div ref={ref} className="flex justify-center py-lg">
      {loading ? (
        <span
          // Announced, because rows appearing below the fold are otherwise
          // invisible to anyone not watching the scrollbar.
          role="status"
          className="flex items-center gap-sm text-[13px] text-text-faint"
        >
          <span
            aria-hidden
            className="size-[14px] animate-spin rounded-full border-2 border-border border-t-text-faint"
          />
          {t("common.loading")}
        </span>
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="rounded-md px-lg py-sm text-[13px] font-semibold text-primary hover:bg-primary-wash"
        >
          {t("orders.loadMore")}
        </button>
      )}
    </div>
  );
}
