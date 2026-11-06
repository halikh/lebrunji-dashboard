"use client";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";

import { useTagVocabulary } from "../use-tags";

/**
 * How a tag looks in the app: its icon, then its name, and nothing else — no
 * pill, no colour. The icon is drawn bare and `object-contain`, so a picture
 * with transparent edges sits on the page the way it sits in the app. A legacy
 * tag with no icon is just its name.
 *
 * `sm` is the tag beside a dish's name; `lg` is the Tags list, where the tag is
 * the row's whole subject.
 */
export function TagChip({
  label,
  iconUrl,
  size = "sm",
  className,
}: {
  label: string;
  iconUrl: string | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-w-0 items-center font-medium text-ink",
        size === "sm"
          ? "max-w-[180px] gap-1 text-[13px]"
          : "max-w-[280px] gap-2.5 text-[14px]",
        className,
      )}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          className={cx(
            "shrink-0 object-contain",
            size === "sm" ? "size-4" : "size-7",
          )}
        />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * A dish's chips, resolved from its ids against the live vocabulary — so a
 * retired tag simply shows one chip fewer, exactly as the app does. Every row
 * calling this shares one query.
 */
export function ItemTags({ ids }: { ids: readonly string[] }) {
  const tags = useTagVocabulary();
  if (ids.length === 0 || !tags.data) return null;
  const mine = tags.data.filter((tag) => ids.includes(tag.id));
  if (mine.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
