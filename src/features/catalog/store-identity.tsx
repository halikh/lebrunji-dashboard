"use client";

import { Copyable } from "@/components/ui/copyable";
import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Store } from "./api/stores";

/**
 * How a shop says who it is, wherever it is being said.
 *
 * The shop page worked this out first: a header that was the name alone left
 * the two facts an operator checks — is this the right shop, and is this the
 * right *branch* of a name that repeats — on the list they had just left and
 * nowhere on the page they had arrived at. The picture and the category line
 * are what the list shows, so the row and the page are recognisably one object.
 *
 * Every page *under* a shop had the same hole and a worse version of it: a
 * branch's page, and its branch-menu page, opened on a back link and a name.
 * Lifting the two pieces here is what stops the shop page's answer being the
 * only one — and stops the next page that needs it inventing a third.
 */

/** The shop's photograph, or the square where one would be. */
export function StoreThumb({
  store,
  className,
}: {
  store: Store;
  /** The size and corner, which differ by where this is standing. */
  className?: string;
}) {
  return store.imageUrl ? (
    <PreviewImage
      src={store.imageUrl}
      name={pickLocalized(store.name)}
      className={cx("shrink-0", className)}
    />
  ) : (
    <ImagePlaceholder className={cx("shrink-0", className)} />
  );
}

/**
 * The shop, small — a thumbnail and its name, for a page whose *title* is
 * something else.
 *
 * The answer to "which shop am I in", which somebody needs once on arriving and
 * never again while typing, so it is set at the size a favicon reads at.
 */
export function ShopLine({ store }: { store: Store }) {
  return (
    <span className="flex min-w-0 items-center gap-xs">
      <StoreThumb store={store} className="size-[18px] rounded-sm" />
      <span className="truncate text-[12px] font-semibold text-text-soft">
        {pickLocalized(store.name)}
      </span>
    </span>
  );
}

/**
 * What the shops list says about a shop, under its name: what kind of place it
 * is, how long it takes, and the number an order is sent to.
 *
 * The phone is the one fact here an operator needs to **act** on — ringing a
 * kitchen that has not acknowledged an order — and it is copyable, because the
 * next thing anybody does with a phone number is put it somewhere else.
 *
 * Its absence is a real state and says so: a shop with no number cannot be sent
 * orders at all, which is worth reading on a header rather than discovering
 * from an order that never arrived.
 *
 * The prep window is the shop's own default. A branch may differ, and the
 * branch's own form is where that shows.
 *
 * ## Why the number is `orderPhone` and not `store.whatsappPhone`
 *
 * Because since `0101` it is the **branch** that carries it, and the branch
 * editor is the only screen that writes one. A shop whose number was entered
 * there has a null on its own row — so reading the store's column said "no
 * WhatsApp number" about a shop with a number on screen two tabs away.
 *
 * That is the same failure the pin had, and the app repo's `AGENTS.md` writes
 * that one up: a fact moved to the branch and a reader kept looking at the old
 * column.
 *
 * `orderPhone` is that resolution, made in the store query itself — branch
 * first, the shop's own column as the fallback for anything created before the
 * move. It was briefly a prop the caller filled in from the Branches tab, which
 * worked and made every tab of the shop page pay for a query only one of them
 * is about. See `api/stores.ts`.
 */
export function StoreFacts({ store }: { store: Store }) {
  const number = store.orderPhone;

  return (
    <span className="flex flex-wrap items-center gap-sm text-[12px] text-text-faint">
      <span className="truncate">
        {store.categoryName} ·{" "}
        {t("catalogue.prep", {
          min: store.prepMinMinutes,
          max: store.prepMaxMinutes,
        })}
      </span>

      {number ? (
        <Copyable
          value={`+${number}`}
          label={t("store.copyWhatsapp")}
          className="text-[12px]"
        />
      ) : (
        <span className="rounded-full bg-danger-wash px-sm font-semibold text-danger">
          {t("store.noWhatsapp")}
        </span>
      )}
    </span>
  );
}
