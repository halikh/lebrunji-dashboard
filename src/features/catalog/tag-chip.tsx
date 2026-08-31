"use client";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";

import type { TagTone } from "./api/tags";
import { useTagVocabulary } from "./use-tags";

/**
 * How a tag looks — the one place a tone becomes a colour in this dashboard.
 *
 * ## Ink on the wash, on every tone
 *
 * The ground carries the identity; the label is always `text`. That is measured
 * rather than assumed: the app's palette records **coral on `coralTint` at
 * 2.4:1**, below the floor for text this small. Tinting the label as well as
 * the ground would fail contrast on at least one tone, and it would fail
 * quietly — a chip stays legible enough to the person who picked the colour, on
 * a bright screen, at their desk.
 *
 * ## Written out, not built from the tone
 *
 * `bg-${tone}-wash` would be shorter and would render nothing. Tailwind reads
 * the source for class names it can see; a name assembled at runtime is not one
 * of them, so the utility is never generated and the chip comes out
 * transparent — with no error anywhere, on a screen that otherwise looks
 * finished. Every class here is a literal for that reason.
 */
const GROUND: Record<TagTone, string> = {
  // Not "no background": a tag with no particular emphasis should still read as
  // a chip rather than as loose text beside a name.
  neutral: "bg-neutral-fill",
  accent: "bg-accent-wash",
  yellow: "bg-yellow-wash",
  active: "bg-active-wash",
  info: "bg-info-wash",
};

export function TagChip({
  label,
  tone,
  className,
}: {
  label: string;
  tone: TagTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-[160px] items-center truncate rounded-sm px-sm py-[1px] text-[12px] font-semibold text-text",
        GROUND[tone] ?? GROUND.neutral,
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
        <TagChip key={tag.id} tone={tag.tone} label={pickLocalized(tag.name)} />
      ))}
    </span>
  );
}
