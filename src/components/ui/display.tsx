import type { HTMLAttributes, ReactNode } from "react";

import { statusName, statusTone } from "@/lib/order-status";

import { cx } from "./cx";

export function Card({
  className,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-lg border border-line bg-surface shadow-xs",
        padded && "p-5",
        className,
      )}
      {...rest}
    />
  );
}

/** A card with a titled header row, the body below a hairline. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-line bg-surface shadow-xs",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type BadgeTone =
  "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-hover text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-accent/15",
  success: "bg-success-soft text-success-ink border-success/15",
  warning: "bg-warning-soft text-warning-ink border-warning/20",
  danger: "bg-danger-soft text-danger-ink border-danger/15",
  info: "bg-info-soft text-info-ink border-info/15",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2 text-[12px] font-medium whitespace-nowrap",
        BADGE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** An order's status, in its own colour. */
export function StatusBadge({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const tone = statusTone(slug);
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium whitespace-nowrap",
        className,
      )}
      style={{ background: tone.wash, color: tone.ink }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: tone.dot }}
      />
      {statusName(slug)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-subtle px-1 font-sans text-[11px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

/** A `span`, so it is valid anywhere text is — inside a `<p>` included. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("block animate-pulse rounded-md bg-hover", className)}
    />
  );
}

/** Rows of grey bars while a list loads — the shape of what is coming. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 shadow-xs [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && (
          <p className="text-[13.5px] text-ink-3">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Label/value pairs, the way a detail panel reads. */
export function DescriptionList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <dl
      className={cx(
        "grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-2.5 text-[13.5px]",
        className,
      )}
    >
      {items
        .filter((item) => !item.hidden)
        .map((item, i) => (
          <div key={i} className="contents">
            <dt className="text-ink-3">{item.label}</dt>
            <dd className="min-w-0 break-words text-ink">{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-hover font-semibold text-ink-2",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/** A big number with its label — the overview tiles and report headers. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      {/* A div: the value can be any node — a skeleton, a <Price> block. */}
      <div className="text-[24px] font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </div>
      {hint && <p className="text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  );
}
