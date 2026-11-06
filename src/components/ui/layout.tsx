"use client";

import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { t } from "@/i18n/translations";

import { Button } from "./button";
import { cx } from "./cx";
import { EmptyState, ListSkeleton, Skeleton } from "./display";

/*
 * The standard page bodies. Every screen is one of three kinds, and each kind
 * is built from these, so the same thing is always in the same place:
 *
 * - Index (a list of records):   PageHeader + ListCard
 * - Detail (one record to read): PageHeader + TwoColumn(main cards, aside cards)
 * - Form (create / edit):        PageHeader + TwoColumn + SaveBar
 *
 * See AGENTS.md, "The standard".
 */

/* ─────────────────────────── Two-column body ─────────────────────────── */

/**
 * Main content on the left, a narrower column of summary/settings cards on
 * the right — the layout Shopify, Stripe and Linear use for a record. One
 * column below `lg`, with the aside after the main content.
 */
export function TwoColumn({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  if (!aside) {
    return (
      <div className={cx("flex min-w-0 flex-col gap-6", className)}>{main}</div>
    );
  }
  return (
    <div
      className={cx(
        "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <aside className="flex min-w-0 flex-col gap-6">{aside}</aside>
    </div>
  );
}

/* ──────────────────────────────── Save bar ─────────────────────────────── */

/**
 * The one way a form is saved. Pinned to the bottom of the page while it
 * scrolls, so Save is never out of reach on a long form. Left: what is pending
 * ("Unsaved changes" by default when dirty). Right: Discard/Cancel, then the
 * primary action — always in that order, primary rightmost.
 *
 * Give it `onSave` for the standard pair, or `children` for anything else.
 */
export function SaveBar({
  dirty,
  pending,
  disabled,
  saveLabel,
  onSave,
  onDiscard,
  discardLabel,
  status,
  children,
  className,
}: {
  dirty?: boolean;
  pending?: boolean;
  /** Save is off for a reason other than "nothing changed". */
  disabled?: boolean;
  saveLabel?: ReactNode;
  onSave?: () => void;
  /** Shown once there is something to discard (or always, for a new record). */
  onDiscard?: () => void;
  discardLabel?: ReactNode;
  /** Overrides the left-hand text. */
  status?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const note = status ?? (dirty ? t("form.unsaved") : null);
  return (
    <div
      className={cx(
        "sticky bottom-0 z-10 -mx-4 mt-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      {note && (
        <p
          role="status"
          className="me-auto flex min-w-0 items-center gap-2 text-[13px] text-ink-3"
        >
          {dirty && !status && (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-warning"
            />
          )}
          {note}
        </p>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {children ?? (
          <>
            {onDiscard && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={onDiscard}
              >
                {discardLabel ?? t("form.discard")}
              </Button>
            )}
            {onSave && (
              <Button
                variant="primary"
                pending={pending}
                disabled={!dirty || disabled}
                onClick={onSave}
              >
                {saveLabel ?? t("form.save")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────── Notice ──────────────────────────────── */

const NOTICE = {
  info: { box: "border-info/20 bg-info-soft text-info-ink", icon: Info },
  warning: {
    box: "border-warning/25 bg-warning-soft text-warning-ink",
    icon: TriangleAlert,
  },
  danger: {
    box: "border-danger/20 bg-danger-soft text-danger-ink",
    icon: AlertCircle,
  },
} as const;

/**
 * A coloured callout — a consequence the operator should read before acting.
 * Info for context, warning for "this will surprise somebody", danger for
 * "this is broken or irreversible".
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = NOTICE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-[13.5px]",
        box,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────── List card ─────────────────────────────── */

/**
 * The body of every index page: one card holding filter tabs, a toolbar
 * (search on the left, filters and sort on the right), the rows, and a footer
 * (count, load more). Rows go in `children` — a `Table` or a `divide-y` list.
 */
export function ListCard({
  tabs,
  search,
  filters,
  footer,
  children,
  className,
}: {
  /** `Tabs` with counts, flush to the card's top edge. */
  tabs?: ReactNode;
  /** A `SearchInput`. */
  search?: ReactNode;
  /** Filter / sort controls, right of the search. */
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-lg border border-line bg-surface shadow-xs",
        className,
      )}
    >
      {tabs && <div className="px-4 sm:px-5">{tabs}</div>}
      {(search || filters) && (
        <div
          className={cx(
            "flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5",
            tabs ? undefined : "border-b border-line",
          )}
        >
          {search && <div className="min-w-0 flex-1 sm:max-w-sm">{search}</div>}
          {filters && (
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {filters}
            </div>
          )}
        </div>
      )}
      <div
        className={cx(tabs && !(search || filters) && "border-t border-line")}
      >
        {children}
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-4 py-2.5 text-[12.5px] text-ink-3 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * Loading, failed, and empty — the three states every list and record has,
 * drawn the same way everywhere. Returns null once there is data to show.
 */
export function QueryState({
  status,
  onRetry,
  empty,
  rows = 6,
  failedTitle,
}: {
  status: "pending" | "error" | "empty" | "ready";
  onRetry?: () => void;
  /** What to show when there is nothing: an `EmptyState` with its action. */
  empty?: ReactNode;
  rows?: number;
  failedTitle?: ReactNode;
}) {
  if (status === "pending") return <ListSkeleton rows={rows} />;
  if (status === "error") {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={failedTitle ?? t("common.loadFailed")}
        description={t("common.loadFailedBody")}
        action={
          onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>
        }
      />
    );
  }
  if (status === "empty") return <>{empty}</>;
  return null;
}

/** The shape of a record page while it loads: header bar, then two columns. */
export function RecordSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-64" />
      </div>
      <TwoColumn
        main={
          <>
            <Skeleton className="h-56 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </>
        }
        aside={aside ? <Skeleton className="h-48 rounded-lg" /> : undefined}
      />
    </div>
  );
}
