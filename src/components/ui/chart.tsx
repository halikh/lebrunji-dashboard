"use client";

import { cx } from "./index";

/**
 * Charts, drawn here rather than pulled from a library.
 *
 * The plan's reasoning, and it still holds: these are a few known shapes, not
 * an exploration tool. A charting library arrives with its own palette, type
 * scale and tooltip styling, and the work becomes bending it back toward the
 * app's — which is more effort than drawing the shapes. Drawn here they read
 * the palette tokens like everything else, so a colour in a chart is the same
 * colour as in the queue.
 *
 * ## They are figures, not pictures
 *
 * Every chart here carries the numbers as text somewhere a screen reader can
 * reach — a `<title>` on the SVG, and a visible label under each bar where
 * there is room. A chart that only exists as geometry is a chart some of the
 * operators cannot read at all, and the same information in words costs a line.
 */

export type Bar = {
  /** Sorts and identifies. */
  key: string;
  /** Drawn under the bar. Keep it two or three characters. */
  label: string;
  value: number;
  /**
   * The same bucket in the period before, drawn as a ghost behind this one.
   *
   * The comparison is the point of a revenue chart — "are we growing" is not a
   * question a single series can answer, and bars with nothing to measure
   * against are decoration. Absent where there is no previous period to show.
   */
  ghost?: number;
  /** What a screen reader is told, and the hover title. Say the units. */
  title: string;
};

/**
 * A row of bars over a shared baseline.
 *
 * ## Empty buckets are drawn, not skipped
 *
 * A zero renders as a hairline rather than as nothing, because the *gap* is
 * usually the finding: a customer who stopped ordering in March is a run of
 * flat months, and a chart built only from the months that have data would show
 * them as a continuous, healthy-looking series.
 *
 * ## The scale starts at zero
 *
 * Always. A bar chart whose baseline is the smallest value exaggerates every
 * difference on it, and this one is read by somebody deciding whether a
 * customer is drifting away. `max` is the largest value or 1 — never 0, which
 * would divide every height by nothing.
 */
export function BarChart({
  bars,
  title,
  height = 120,
  className,
}: {
  bars: readonly Bar[];
  /** Names the whole chart, for assistive technology. */
  title: string;
  height?: number;
  className?: string;
}) {
  // The ghosts are in the scale too. Scaling to the current period alone would
  // make a bad month look like a good one whenever the previous period was
  // taller — the comparison would then be drawn to two different rulers.
  const max = Math.max(
    1,
    ...bars.map((bar) => bar.value),
    ...bars.map((bar) => bar.ghost ?? 0),
  );

  return (
    <figure className={cx("flex flex-col gap-xs", className)}>
      <div
        role="img"
        aria-label={title}
        className="flex items-end gap-xs"
        style={{ height }}
      >
        {bars.map((bar) => {
          const share = bar.value / max;
          return (
            <div
              key={bar.key}
              title={bar.title}
              className="flex h-full flex-1 items-end"
            >
              {/* The ghost sits behind, not beside. Two bars per bucket
                  doubles the width and halves how many buckets fit, and the
                  question being asked is "taller or shorter than last time"
                  rather than "how do these two compare as objects". */}
              <div className="relative h-full w-full">
                {bar.ghost !== undefined && (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 rounded-t-sm bg-border"
                    style={{ height: `${(bar.ghost / max) * 100}%` }}
                  />
                )}
                <div
                  className={cx(
                    "absolute inset-x-[22%] bottom-0 rounded-t-sm",
                    bar.value > 0 ? "bg-active" : "bg-transparent",
                  )}
                  // A zero still draws a hairline: absent bars and zero bars
                  // look identical otherwise, and only one of them is a fact.
                  style={{ height: `${Math.max(share * 100, 1.5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-xs">
        {bars.map((bar) => (
          <span
            key={bar.key}
            aria-hidden
            className="flex-1 truncate text-center text-[10px] text-text-faint"
          >
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * A strip of cells shaded by value — "when do they order".
 *
 * ## Shade rather than height
 *
 * Seven bars of a week is a bar chart; seven *cells* is a pattern, and a
 * pattern is what the eye reads at a glance for "Fridays and Saturdays". It
 * also stays legible at a fraction of the height a bar chart needs, which is
 * what lets it sit under the tiles rather than pushing the orders off screen.
 *
 * ## Never shade alone
 *
 * The count is printed in every cell. Shade is a summary, not the data: a
 * colour-blind operator, a dim screen and a printed page all lose it, and the
 * number costs nothing.
 */
export function HeatStrip({
  cells,
  title,
  className,
}: {
  cells: readonly { key: string; label: string; value: number }[];
  title: string;
  className?: string;
}) {
  const max = Math.max(1, ...cells.map((cell) => cell.value));

  return (
    <figure className={cx("flex flex-col gap-xs", className)}>
      <div role="img" aria-label={title} className="flex gap-xs">
        {cells.map((cell) => (
          <div
            key={cell.key}
            title={`${cell.label}: ${cell.value}`}
            className="flex flex-1 flex-col items-center gap-xxs"
          >
            <div
              className="flex h-[34px] w-full items-center justify-center rounded-sm text-[11px] font-semibold tabular-nums"
              style={{
                // The wash at full strength for the busiest cell, fading to
                // nothing — one token, so the strip is in the palette rather
                // than beside it.
                background:
                  cell.value === 0
                    ? "var(--color-neutral-fill)"
                    : `color-mix(in srgb, var(--color-active) ${Math.round(
                        15 + (cell.value / max) * 55,
                      )}%, var(--color-surface))`,
              }}
            >
              {cell.value > 0 ? cell.value : ""}
            </div>
            <span aria-hidden className="text-[10px] text-text-faint">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/**
 * A list of horizontal bars — "what actually sells".
 *
 * ## Horizontal because the labels are words
 *
 * A dish is called "Kibbeh plate with garlic sauce", and vertical bars give a
 * label the width of a bar: two characters, or the text turned on its side.
 * Horizontal bars give it the width of the row, which is the whole reason to
 * draw this shape rather than print a table — the names stay readable *and* the
 * lengths stay comparable.
 *
 * ## The value is printed, not only drawn
 *
 * The bar answers "which is biggest" at a glance; the number answers "by how
 * much", which is the next question every single time.
 */
export function HBarList({
  rows,
  title,
  className,
}: {
  rows: readonly { key: string; label: string; value: number; note: string }[];
  title: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul aria-label={title} className={cx("flex flex-col gap-sm", className)}>
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-xxs">
          <div className="flex items-baseline justify-between gap-md">
            <span className="min-w-0 truncate text-[13px]">{row.label}</span>
            <span className="shrink-0 tabular-nums text-[13px] font-semibold">
              {row.note}
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-sm bg-neutral-fill">
            <div
              className="h-full rounded-sm bg-active"
              // A hairline for a real zero, so an empty row still reads as a
              // row rather than as a rendering fault.
              style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }}
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
 * ## The empty grid is drawn
 *
 * The server sends only the buckets that have something in them, and this fills
 * the rest with zeroes. Deliberate: the shape of *when nothing happens* is half
 * the answer to "when do we need staff", and a chart with holes cannot show it.
 *
 * ## Rows read Monday-first; the data is Sunday-indexed
 *
 * `store_hours.day_of_week` and `Date#getDay` both count from Sunday, so that
 * is what arrives. A week a person reads starts on Monday. The rotation happens
 * here, in the presentation layer, and nowhere else — so nothing reaching the
 * database has passed through a display position.
 */
export function HeatGrid({
  /** `[dayOfWeek 0-6][hour 0-23]`, Sunday-indexed as the data is. */
  values,
  dayLabels,
  title,
  className,
}: {
  values: readonly (readonly number[])[];
  dayLabels: readonly string[];
  title: string;
  className?: string;
}) {
  const max = Math.max(1, ...values.flatMap((row) => [...row]));
  const rows = [1, 2, 3, 4, 5, 6, 0];

  return (
    <figure className={cx("flex flex-col gap-xs", className)}>
      <div role="img" aria-label={title} className="flex flex-col gap-xxs">
        {rows.map((day) => (
          <div key={day} className="flex items-center gap-xs">
            <span
              aria-hidden
              className="w-[22px] shrink-0 text-[10px] text-text-faint"
            >
              {dayLabels[day]}
            </span>
            <div className="flex flex-1 gap-[2px]">
              {Array.from({ length: 24 }, (_, hour) => {
                const value = values[day]?.[hour] ?? 0;
                const at = String(hour).padStart(2, "0");
                return (
                  <div
                    key={hour}
                    title={`${dayLabels[day]} ${at}:00 — ${value}`}
                    className="h-[14px] flex-1 rounded-[2px]"
                    style={{
                      background:
                        value === 0
                          ? "var(--color-neutral-fill)"
                          : `color-mix(in srgb, var(--color-active) ${Math.round(
                              18 + (value / max) * 62,
                            )}%, var(--color-surface))`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Four marks rather than twenty-four: an axis labelling every hour is
          unreadable at this width, and the quarters are enough to place a band
          by eye. */}
      <div
        aria-hidden
        className="flex gap-xs ps-[26px] text-[10px] text-text-faint"
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
