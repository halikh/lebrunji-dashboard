"use client";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";

import { useTagVocabulary } from "./use-tags";

/**
 * How a tag looks: its icon, then its name, and nothing else.
 *
 * ## Words and a picture, not a chip
 *
 * A tag used to be a coloured pill — a palette role, then any colour a merchant
 * picked, then a choice of ink to go with it, each measured for contrast. That
 * was three decisions per tag and a contrast readout to police them, all in
 * service of a rectangle a few millimetres tall. The columns behind it (`tone`,
 * `ink`, `color`) are gone from `menu_item_tags`, and with them every way to
 * make a tag that cannot be read.
 *
 * What replaced it is an uploaded icon (`icon_url`) drawn small, and the name
 * beside it as plain text — no ground, no padding, no corner — in the heading
 * face at 600, in the ordinary text colour. The icon is drawn bare and
 * `object-contain`, so a picture with its own transparent edges sits on the
 * page the way it sits in the app. A legacy tag with no icon is just its name.
 *
 * A plain `<img>`, as `PreviewImage` uses for the same uploaded URLs.
 */
export function TagChip({
  label,
  iconUrl,
  className,
}: {
  label: string;
  /** The tag's icon, or null for a legacy tag that has none. */
  iconUrl: string | null;
  className?: string;
}) {
  return (
    <span
      className={cx(
        // `max-w` + `truncate` because a name is merchant-written and a row of
        // them still has to fit beside a dish's own name.
        "inline-flex max-w-[180px] items-center gap-xs font-heading text-[13px] font-semibold text-text",
        className,
      )}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- see above.
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          className="size-[16px] shrink-0 object-contain"
        />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * A dish's chips, resolved from its ids.
 *
 * ## Why the row looks the tags up rather than being handed them
 *
 * A `MenuItem` carries ids, not rows — a tag's name and position belong
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
    <span className="flex flex-wrap items-center gap-x-sm gap-y-xs">
      {mine.map((tag) => (
        <TagChip
          key={tag.id}
          label={pickLocalized(tag.name)}
          iconUrl={tag.iconUrl}
        />
      ))}
    </span>
  );
}
