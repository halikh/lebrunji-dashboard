"use client";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";

import type { TagInk, TagTone } from "./api/tags";
import { useTagVocabulary } from "./use-tags";

/**
 * How a tag looks — the one place a tone becomes a colour in this dashboard.
 *
 * ## Full strength, not a wash
 *
 * These were the `-wash` tints, and at chip size that is barely a colour: five
 * pale rectangles that have to be compared side by side to be told apart, which
 * is the one thing a chip is never seen doing. A tag is read *alone*, on a dish,
 * next to a photograph — so the tone has to carry from across a table or it is
 * not carrying anything.
 *
 * ## Which is only allowed because the ink was re-measured
 *
 * The old note here was right about its own scheme and would have been wrong
 * about this one: ink on every ground failed as soon as the grounds got dark.
 * So the ink is per tone now, and each pairing was measured rather than
 * assumed. Against `#1e1b18` ink and `#ffffff`:
 *
 * | tone    | ground          | ink   | ratio   |
 * | ------- | --------------- | ----- | ------- |
 * | neutral | sand `#f0eae1`  | ink   | 15.0:1  |
 * | accent  | mint `#14b87f`  | ink   | 6.9:1   |
 * | yellow  | sun  `#ffc634`  | ink   | 11.2:1  |
 * | active  | coral `#ff5a3c` | ink   | 5.7:1   |
 * | info    | grape `#6c4bf5` | white | 5.3:1   |
 *
 * Every one clears 4.5:1, which is the bar for text this small. Grape is the
 * one that flips: ink on it is 3.3:1 and fails, white on it passes — which is
 * exactly what `--color-on-info` already says, and why the ink is read from the
 * palette's own `on-*` role rather than picked here.
 *
 * The two that look like exceptions are not. `bg-active` is coral at full
 * strength carrying **ink**, not the white `--color-on-active` names — white on
 * coral is 3.1:1, fine for a ring and under the bar for a label, which the
 * palette says in as many words. And mint takes ink rather than the white
 * `--color-on-accent` for the same reason at 2.6:1. `on-*` is the ink for a
 * *button* in that colour; a chip is smaller and darker type wins.
 *
 * ## Written out, not built from the tone
 *
 * `bg-${tone}` would be shorter and would render nothing. Tailwind reads the
 * source for class names it can see; a name assembled at runtime is not one of
 * them, so the utility is never generated and the chip comes out transparent —
 * with no error anywhere, on a screen that otherwise looks finished. Every
 * class here is a literal for that reason.
 */
const GROUND: Record<TagTone, string> = {
  // The one that stays quiet, and still a ground: a tag with no particular
  // emphasis should read as a chip rather than as loose text beside a name.
  neutral: "bg-neutral-fill",
  accent: "bg-accent",
  yellow: "bg-yellow",
  active: "bg-active",
  info: "bg-info",
};

/**
 * The two inks, written out for the same reason the grounds are: a class name
 * assembled at runtime is one Tailwind never sees in the source, so the utility
 * is never generated and the words come out inheriting whatever is around them.
 */
const INK: Record<TagInk, string> = {
  dark: "text-text",
  light: "text-on-info",
};

/**
 * What each pairing measures, so the screen can say so.
 *
 * Against `#1e1b18` ink and `#ffffff`, and the numbers are the reason the
 * defaults are what they are. A merchant may pick the other one — the point of
 * `0112` is that it is their call — and the editor puts the figure next to the
 * choice rather than refusing it or letting it be made blind.
 *
 * 4.5:1 is the bar for text this small; anything under it is a chip somebody
 * will squint at on a phone in daylight.
 */
export const INK_CONTRAST: Record<TagTone, Record<TagInk, number>> = {
  neutral: { dark: 15.0, light: 1.2 },
  accent: { dark: 6.9, light: 2.6 },
  yellow: { dark: 11.2, light: 1.6 },
  active: { dark: 5.7, light: 3.1 },
  info: { dark: 3.3, light: 5.3 },
};

/** The lowest ratio a 12px label may be drawn at. */
export const INK_FLOOR = 4.5;

/**
 * The tag's own ink, or the one its tone measures well against.
 *
 * Null is what a row carries until somebody has chosen — see `Tag.ink`. Grape
 * is the one tone whose default is white: dark on it is 3.3:1 and fails, which
 * is exactly what `--color-on-info` already says.
 */
export function inkFor(tone: TagTone, ink: TagInk | null): TagInk {
  return ink ?? (tone === "info" ? "light" : "dark");
}

export function TagChip({
  label,
  tone,
  ink = null,
  className,
}: {
  label: string;
  tone: TagTone;
  /** The tag's own ink, or null for the tone's. */
  ink?: TagInk | null;
  className?: string;
}) {
  return (
    <span
      className={cx(
        // No `text-text` here any more — the ink is part of the tone, because
        // one of the five needs a different one. See the table above.
        "inline-flex max-w-[160px] items-center truncate rounded-sm px-sm py-[1px] text-[12px] font-semibold",
        GROUND[tone] ?? GROUND.neutral,
        INK[inkFor(tone, ink)],
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * A dish's chips, resolved from its ids.
 *
 * ## Why the row looks the tags up rather than being handed them
 *
 * A `MenuItem` carries ids, not rows — a tag's name, colour and position belong
 * to the vocabulary and change on the Tags tab, so a copy stored against the
 * dish would show whatever the tag was called when the menu was last fetched.
 *
 * Every row calling the same query is one request, not forty: react-query keys
 * on the query, so the rows share a single fetch and a single cache entry. The
 * alternative — threading a lookup down through the section list — would be the
 * same data with a prop drilled through three components.
 *
 * Retired tags are absent from the vocabulary, so a dish that still carries one
 * simply shows one chip fewer. That matches the app exactly, which is the point:
 * this row should not show something a customer cannot see.
 */
export function ItemTags({ ids }: { ids: readonly string[] }) {
  const tags = useTagVocabulary();

  if (ids.length === 0 || !tags.data) return null;

  const mine = tags.data.filter((tag) => ids.includes(tag.id));
  if (mine.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-xs">
      {mine.map((tag) => (
        <TagChip
          key={tag.id}
          tone={tag.tone}
          ink={tag.ink}
          label={pickLocalized(tag.name)}
        />
      ))}
    </span>
  );
}
