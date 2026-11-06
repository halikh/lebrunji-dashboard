"use client";

import { useState } from "react";

import { cx } from "./cx";

/**
 * Charts, drawn here rather than pulled from a library: a few known shapes,
 * in the kit's own tokens, so a colour in a chart is the colour everywhere.
 *
 * ## Calm by default
 *
 * Every chart here is one series, so it is one hue: the accent for the data,
 * neutral greys for everything that is not data (the previous period, empty
 * cells, tracks). Status colours appear only where a row *is* a status (the
 * order funnel, via `fill`). Text is always ink, never the series colour.
 *
 * ## Figures, not pictures
 *
 * Each chart carries its numbers as text a screen reader can reach (a visually
 * hidden list), and every mark shows its exact value on hover or focus.
 */

/**
 * The colours a chart may be drawn in. The old names are all accepted; they
 * map onto the calm palette — the accent for the data, `info` kept for the
 * one chart that wants to read apart from money, `neutral` for context.
 */
export type ChartTone =
  "accent" | "sun" | "info" | "active" | "primary" | "neutral";

const TONE: Record<ChartTone, string> = {
  accent: "var(--color-accent)",
  active: "var(--color-accent)",
  primary: "var(--color-accent)",
  sun: "var(--color-accent)",
  info: "var(--color-info)",
  neutral: "var(--color-ink-3)",
};

function describeCell(cell: { label: string; value: number }): string {
  return `${cell.label}: ${cell.value}`;
}

/** A sequential shade of one hue: faint for little, full for the most. */
function shade(colour: string, value: number, max: number): string {
  if (value <= 0) return "var(--color-hover)";
  const strength = Math.round(14 + (value / max) * 76);
  return `color-mix(in srgb, ${colour} ${strength}%, var(--color-surface))`;
}

export type Bar = {
  /** Sorts and identifies. */
  key: string;
  /** Drawn under the bar. Keep it two or three characters. */
  label: string;
  value: number;
  /** The same bucket in the period before, drawn as a grey ghost behind. */
  ghost?: number;
  /** What a screen reader is told, and the tooltip. Say the units. */
  title: string;
};

/** A small dark tooltip anchored above a mark. */
function Tip({
  text,
  align,
}: {
  text: string;
  align: "start" | "center" | "end";
}) {
  return (
    <span
      role="presentation"
      className={cx(
        "pointer-events-none absolute bottom-full z-20 mb-1.5 w-max max-w-56 rounded-md bg-ink px-2 py-1 text-[12px] leading-snug text-white tabular-nums shadow-md animate-fade-in",
        align === "start" && "start-0",
        align === "end" && "end-0",
        align === "center" && "start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
      )}
    >
      {text}
    </span>
  );
}

function alignAt(index: number, count: number): "start" | "center" | "end" {
  if (count <= 2) return "center";
  if (index < count * 0.15) return "start";
  if (index >= count * 0.85) return "end";
  return "center";
}

/**
 * A row of bars over a shared baseline.
 *
 * Empty buckets are drawn as a hairline, not skipped — the gap is usually the
 * finding. The scale always starts at zero, and the ghosts are in the scale
 * too, so the comparison is drawn to one ruler. The best bucket is full
 * strength; the rest a shade back.
 */
export function BarChart({
  bars,
  title,
  tone = "accent",
  height = 120,
  className,
}: {
  bars: readonly Bar[];
  /** Names the whole chart, for assistive technology. */
  title: string;
  tone?: ChartTone;
  height?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const colour = TONE[tone];
  const max = Math.max(
    1,
    ...bars.map((bar) => bar.value),
    ...bars.map((bar) => bar.ghost ?? 0),
  );
  // The gutter shrinks as bars multiply: ninety bars at 4px is a phone of gaps.
  const gap =
    bars.length > 48 ? "gap-0" : bars.length > 16 ? "gap-px" : "gap-1";

  return (
    <figure className={cx("flex flex-col gap-1.5", className)}>
      <ul className="sr-only" aria-label={title}>
        {bars.map((bar) => (
          <li key={bar.key}>{bar.title}</li>
        ))}
      </ul>
      <div
        aria-hidden
        className={cx(
          "relative flex items-end border-b border-line-strong",
          gap,
        )}
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Recessive guides at a half and the top, so heights can be read. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        {bars.map((bar, index) => {
          const share = bar.value / max;
          const active = hover === index;
          return (
            <div
              key={bar.key}
              onMouseEnter={() => setHover(index)}
              className="relative flex h-full min-w-0 flex-1 items-end"
            >
              <div className="relative h-full w-full">
                {active && (
                  <span className="absolute inset-0 rounded-sm bg-hover" />
                )}
                {bar.ghost !== undefined && (
                  <div
                    className="absolute inset-x-[8%] bottom-0 rounded-t-[4px] bg-line"
                    style={{ height: `${(bar.ghost / max) * 100}%` }}
                  />
                )}
                <div
                  className="absolute inset-x-[24%] bottom-0 rounded-t-[4px] transition-[height]"
                  style={{
                    height: `${Math.max(share * 100, 1.5)}%`,
                    minWidth: 2,
                    background:
                      bar.value === 0
                        ? "var(--color-line-strong)"
                        : bar.value === max || active
                          ? colour
                          : `color-mix(in srgb, ${colour} 70%, var(--color-surface))`,
                  }}
                />
              </div>
              {active && (
                <Tip text={bar.title} align={alignAt(index, bars.length)} />
              )}
            </div>
          );
        })}
      </div>

      <div aria-hidden className={cx("flex", gap)}>
        {bars.map((bar) => (
          <span
            key={bar.key}
            // Centred on its bar and allowed to spill; callers keep labels sparse.
            className="flex min-w-0 flex-1 justify-center overflow-visible text-[11px] whitespace-nowrap text-ink-3 tabular-nums"
          >
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * A strip of cells shaded by value — "when do they order". The count is
 * printed in every cell: shade is a summary, not the data.
 */
export function HeatStrip({
  cells,
  title,
  tone = "accent",
  className,
}: {
  cells: readonly { key: string; label: string; value: number }[];
  title: string;
  tone?: ChartTone;
  className?: string;
}) {
  const max = Math.max(1, ...cells.map((cell) => cell.value));
  const colour = TONE[tone];

  return (
    <figure className={cx("flex flex-col gap-1", className)}>
      <ul className="sr-only" aria-label={title}>
        {cells.map((cell) => (
          <li key={cell.key}>{describeCell(cell)}</li>
        ))}
      </ul>
      <div aria-hidden className="flex gap-1">
        {cells.map((cell) => {
          const strong = cell.value / max > 0.55;
          return (
            <div
              key={cell.key}
              title={describeCell(cell)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <div
                className={cx(
                  "flex h-9 w-full items-center justify-center rounded-md text-[12px] font-medium tabular-nums",
                  strong ? "text-white" : "text-ink-2",
                )}
                style={{ background: shade(colour, cell.value, max) }}
              >
                {cell.value > 0 ? cell.value : ""}
              </div>
              <span className="text-[11px] text-ink-3">{cell.label}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/**
 * Horizontal bars — "what actually sells". Horizontal because the labels are
 * words; the value is printed beside the label, not only drawn.
 */
export function HBarList({
  rows,
  title,
  tone = "accent",
  className,
}: {
  rows: readonly {
    key: string;
    label: string;
    value: number;
    note: string;
    /**
     * A colour for this row alone, as a CSS value — only where a row *is* a
     * status (the order funnel), so it wears the colour it wears in the queue.
     */
    fill?: string;
  }[];
  title: string;
  tone?: ChartTone;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const colour = TONE[tone];

  return (
    <ul aria-label={title} className={cx("flex flex-col gap-3", className)}>
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-ink-2">
              {row.label}
            </span>
            <span className="shrink-0 text-[13px] font-medium text-ink tabular-nums">
              {row.note}
            </span>
          </div>
          <div
            aria-hidden
            className="h-2 w-full overflow-hidden rounded-full bg-hover"
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max((row.value / max) * 100, 1)}%`,
                background: row.fill ?? colour,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The week against the hours of the day, shaded by volume.
 *
 * The empty grid is drawn — when nothing happens is half the answer. Rows
 * read Monday-first; the data is Sunday-indexed (`[dayOfWeek 0-6][hour 0-23]`)
 * and the rotation happens here only.
 */
export function HeatGrid({
  values,
  dayLabels,
  title,
  tone = "accent",
  className,
}: {
  values: readonly (readonly number[])[];
  dayLabels: readonly string[];
  title: string;
  tone?: ChartTone;
  className?: string;
}) {
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(
    null,
  );
  const max = Math.max(1, ...values.flatMap((row) => [...row]));
  const colour = TONE[tone];
  const rows = [1, 2, 3, 4, 5, 6, 0];
  const at = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  const describeDay = (day: number) =>
    `${dayLabels[day]}: ${(values[day] ?? [])
      .map((value, hour) => (value > 0 ? `${at(hour)} ${value}` : null))
      .filter(Boolean)
      .join(", ")}`;

  return (
    <figure className={cx("flex flex-col gap-1.5", className)}>
      <ul className="sr-only" aria-label={title}>
        {rows.map((day) => (
          <li key={day}>{describeDay(day)}</li>
        ))}
      </ul>
      <div
        aria-hidden
        className="flex flex-col gap-[3px]"
        onMouseLeave={() => setHover(null)}
      >
        {rows.map((day) => (
          <div key={day} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[11px] text-ink-3">
              {dayLabels[day]}
            </span>
            <div className="flex flex-1 gap-[2px]">
              {Array.from({ length: 24 }, (_, hour) => {
                const value = values[day]?.[hour] ?? 0;
                const active = hover?.day === day && hover.hour === hour;
                return (
                  <div
                    key={hour}
                    onMouseEnter={() => setHover({ day, hour })}
                    className={cx(
                      "relative h-4 min-w-0 flex-1 rounded-[3px]",
                      active && "ring-2 ring-ink/70",
                    )}
                    style={{ background: shade(colour, value, max) }}
                  >
                    {active && (
                      <Tip
                        text={`${dayLabels[day]} ${at(hour)} — ${value}`}
                        align={alignAt(hour, 24)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quarter marks: an axis labelling every hour is unreadable here. */}
      <div
        aria-hidden
        className="flex gap-2 ps-10 text-[11px] text-ink-3 tabular-nums"
      >
        {["00", "06", "12", "18"].map((mark) => (
          <span key={mark} className="flex-1">
            {mark}
          </span>
        ))}
      </div>
    </figure>
  );
}
