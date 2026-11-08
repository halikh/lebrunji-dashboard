"use client";

import Link from "next/link";
import { ChevronRight, MoreHorizontal, Search, X } from "lucide-react";
import { forwardRef, type ReactNode } from "react";

import { BackButton } from "@/components/back-button";
import { t } from "@/i18n/translations";

import { Button } from "./button";
import { cx } from "./cx";
import { Menu, type MenuItem } from "./overlay";

/* ──────────────────────────── Tabs ──────────────────────────── */

export type TabItem<K extends string> = {
  key: K;
  label: ReactNode;
  count?: number | null;
  /** Makes the tab a link instead of a button — for tabs that are routes. */
  href?: string;
};

/** Underlined tabs across the top of a page or panel. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<K>[];
  value: K;
  onChange?: (key: K) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "flex gap-5 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)] scrollbar-thin",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        const classes = cx(
          "relative flex h-10 shrink-0 items-center gap-2 border-b-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
          active
            ? "border-accent text-ink"
            : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
        );
        const content = (
          <>
            {item.label}
            {item.count != null && (
              <span
                className={cx(
                  "min-w-5 rounded-full px-1.5 py-px text-center text-[11.5px] tabular-nums",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "bg-hover text-ink-3",
                )}
              >
                {item.count}
              </span>
            )}
          </>
        );
        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={classes}
          >
            {content}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={classes}
            onClick={() => onChange?.(item.key)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

/** A compact either/or switch: Today | All, List | Grid. */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: { key: K; label: ReactNode }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className={cx(
        "inline-flex rounded-md border border-line bg-hover p-0.5",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="radio"
          aria-checked={item.key === value}
          onClick={() => onChange(item.key)}
          className={cx(
            "rounded-[5px] px-2.5 font-medium whitespace-nowrap transition-colors",
            // md lands at 36px overall, the height of every other control.
            size === "sm" ? "h-6 text-[12.5px]" : "h-[30px] text-[13px]",
            item.key === value
              ? "bg-surface text-ink shadow-xs"
              : "text-ink-3 hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────── Page structure ─────────────────────── */

/**
 * Title, one line saying what the page is for, and the page's actions on the
 * right. Every page opens with one, so the eye always finds them in the same
 * place — and Back above the title, whenever there is somewhere to go back to.
 */
export function PageHeader({
  title,
  description,
  actions,
  more,
  meta,
  eyebrow,
  className,
}: {
  title: ReactNode;
  /** A small line above the title naming where the page sits ("Settings"). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Buttons, secondary first and the one primary last (rightmost). */
  actions?: ReactNode;
  /** Rarer actions, in a ⋯ menu after the buttons. Destructive ones last. */
  more?: MenuItem[];
  meta?: ReactNode;
  className?: string;
}) {
  const hasMore = more && more.length > 0;
  return (
    <header className={cx("flex flex-col gap-3", className)}>
      {/* The one Back: to the page before this one, hidden on the first. */}
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && (
            <p className="text-[12.5px] font-medium text-ink-4">{eyebrow}</p>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="max-w-2xl text-[14px] text-ink-3">{description}</p>
          )}
        </div>
        {(actions || hasMore) && (
          <div className="flex flex-wrap items-center gap-2">
            {hasMore && (
              <Menu
                items={more}
                trigger={
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={t("common.more")}
                  >
                    <MoreHorizontal />
                  </Button>
                }
              />
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/** The scrollable body of a page, with the standard gutters and max width. */
export function Page({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: "default" | "narrow" | "full";
  className?: string;
}) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div
        className={cx(
          "mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          width === "default" && "max-w-none",
          width === "narrow" && "max-w-none",
          width === "full" && "max-w-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export const SearchInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  }
>(function SearchInput(
  { value, onChange, placeholder, className, autoFocus, onKeyDown },
  ref,
) {
  return (
    <div className={cx("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute start-3 size-4 text-ink-4" />
      <input
        ref={ref}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
          onKeyDown?.(event);
        }}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t("common.search")}
        className="h-9 w-full rounded-md border border-line-strong bg-surface ps-9 pe-8 text-[14px] text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:shadow-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("common.clear")}
          className="absolute end-2 flex size-5 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
});

/** A clickable row that goes somewhere. Chevron on the end says so. */
export function LinkRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle focus-visible:bg-subtle",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <ChevronRight className="size-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
    </Link>
  );
}
