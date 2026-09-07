"use client";

import Link from "next/link";

import { t } from "@/i18n/translations";

/**
 * A pointer, not an editor.
 *
 * ## Why there is nothing to edit here
 *
 * Two earlier versions put option management in this panel — first the whole of
 * it, then a reduced version — and both were the same mistake at different
 * sizes. The panel is 420px and already holds two languages of name, two of
 * description, a price, an image and a switch. A question with its choices and
 * their prices does not fit beside that, and squeezing it in made both jobs
 * worse.
 *
 * The deeper reason is that they are not the same job. Editing a dish is about
 * what it *is*; setting up its questions is a sitting at the Options page with
 * a shop's menu in front of you, usually doing several dishes in a row. So this
 * says where that is and takes the operator there with the dish already chosen.
 *
 * The link carries `section` and `item`, so the page opens on this dish rather
 * than on two empty selects and a memory test.
 */
export function ItemOptions({
  storeId,
  itemId,
  sectionId,
}: {
  storeId: string;
  /** Null while the dish is still being added. */
  itemId: string | null;
  sectionId: string;
}) {
  if (itemId === null) {
    return (
      <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
        {t("options.saveFirst")}
      </p>
    );
  }

  return (
    <Link
      href={`/catalogue/${storeId}?tab=options&section=${sectionId}&item=${itemId}`}
      /*
        Full width, like every other control in this column.

        Shrink-wrapped it was a small pill floating in a field's worth of space,
        which read as a chip — something that labels the thing above it — rather
        than as the row that takes you somewhere. It sits among fields that all
        span the column, and a control that does not span it is one the eye
        files as decoration.

        `justify-between` with the chevron on the trailing edge, so it reads as
        a navigation row and not as a stretched button: the arrow marks where the
        row ends, which is what says it leads off this page.
      */
      className="flex w-full items-center justify-between gap-sm rounded-md border border-border bg-surface px-lg py-md text-[14px] font-semibold text-primary hover:border-primary"
    >
      {t("options.openFor")}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
