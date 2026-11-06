"use client";

import { AlertCircle, SearchX } from "lucide-react";
import type { ReactNode } from "react";

import {
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SaveBar,
  Skeleton,
} from "@/components/ui";
import { t } from "@/i18n/translations";

/*
 * The frame the promotion, bundle and artwork editors share: the record's
 * fields as stacked cards in a wide column, and beside them — pinned while the
 * fields scroll — what the record comes to (the summary, the pictures, where a
 * tap leads). Below `lg` the aside drops under the fields that produce it.
 *
 * Save and Cancel live in the kit's `SaveBar`, stuck to the bottom of the
 * page, so they are in reach at the foot of a long form without scrolling back
 * up — and the bar says "Unsaved changes" while there are some, the way
 * Shopify's contextual save bar does.
 */

export function EditorLayout({
  title,
  description,
  meta,
  headerActions,
  aside,
  footer,
  dirty,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  aside?: ReactNode;
  footer: ReactNode;
  /** Whether the form differs from what is saved — the bar says so. */
  dirty?: boolean;
  children: ReactNode;
}) {
  return (
    <Page className="pb-0 lg:pb-0">
      <PageHeader
        title={title}
        description={description}
        meta={meta}
        actions={headerActions}
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        {aside && (
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0">
            {aside}
          </aside>
        )}
      </div>
      <SaveBar dirty={dirty}>{footer}</SaveBar>
    </Page>
  );
}

/** A side card: a quiet titled box for what is read rather than filled in. */
export function AsideCard({
  title,
  description,
  tone = "plain",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  tone?: "plain" | "accent";
  children?: ReactNode;
}) {
  return (
    <section
      className={
        tone === "accent"
          ? "rounded-lg border border-accent/20 bg-accent-soft px-4 py-3.5"
          : "rounded-lg border border-line bg-surface px-4 py-3.5 shadow-xs"
      }
    >
      <h2
        className={
          tone === "accent"
            ? "text-[12.5px] font-medium text-accent-ink"
            : "text-[14px] font-semibold text-ink"
        }
      >
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-[12.5px] text-ink-3">{description}</p>
      )}
      {children && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

/**
 * The page around an editor that has no form to show yet: loading, a failed
 * read, or a record that has gone (archived since the link was made).
 */
export function EditorPlaceholder({
  state,
  title,
  notFound,
  onRetry,
}: {
  state: "pending" | "error" | "missing";
  title: ReactNode;
  notFound: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Page>
      <PageHeader title={title} />
      {state === "pending" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <Skeleton className="h-28 rounded-lg" />
        </div>
      ) : (
        <Card padded={false}>
          {state === "error" ? (
            <EmptyState
              icon={<AlertCircle />}
              title={t("common.loadFailed")}
              action={
                onRetry && (
                  <Button onClick={onRetry}>{t("common.retry")}</Button>
                )
              }
            />
          ) : (
            <EmptyState icon={<SearchX />} title={notFound} />
          )}
        </Card>
      )}
    </Page>
  );
}
