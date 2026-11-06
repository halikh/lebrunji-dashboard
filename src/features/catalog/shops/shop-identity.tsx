"use client";

import { MapPin, PhoneOff } from "lucide-react";

import { Badge, Copyable, Thumb, Tooltip, cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Store } from "../api/stores";

/**
 * How a shop says who it is — the same picture and facts on the list, the
 * shop's page and the pages under it, so they read as one object.
 */

export function ShopThumb({
  store,
  size = 40,
  className,
}: {
  store: Pick<Store, "imageUrl" | "name">;
  size?: number;
  className?: string;
}) {
  return (
    <Thumb
      src={store.imageUrl}
      size={size}
      alt={pickLocalized(store.name)}
      className={className}
    />
  );
}

/**
 * The line that says a place has no pin, and what that costs.
 *
 * One component for the shops list and the branch rows, because they are the
 * same warning about the same money: `delivery_fee_for_km` charges an unknown
 * distance at the **top band**, so an unpinned place silently overcharges every
 * customer it serves. The wording is the consequence, not the fact — "no
 * location" would read as cosmetic — and the glyph is a pin, so the eye knows
 * what is missing before the words are read.
 */
export function NoPinWarning({
  count,
  className,
}: {
  /** On a chain's shop row: how many branches it is about. */
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-[12px] font-medium text-warning-ink",
        className,
      )}
    >
      <MapPin aria-hidden className="size-3.5 shrink-0" />
      {count && count > 1
        ? t("catalogue.noPinCount", { count })
        : t("catalogue.noPin")}
    </span>
  );
}

/** A place with no WhatsApp number — an order placed there reaches no kitchen. */
export function NoWhatsappWarning({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-[12px] font-medium text-warning-ink",
        className,
      )}
    >
      <PhoneOff aria-hidden className="size-3.5 shrink-0" />
      {t("store.noWhatsapp")}
    </span>
  );
}

/** Categories and the prep window — the meta line under a shop's name. */
export function shopMeta(store: Store): string {
  return [
    store.categoryNames.filter(Boolean).join(", "),
    t("catalogue.prep", {
      min: store.prepMinMinutes,
      max: store.prepMaxMinutes,
    }),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * What the shops list says under a name, plus the number orders go to.
 *
 * The number is the one fact here somebody acts on — ringing a kitchen that has
 * not acknowledged an order — so it is copyable. Its absence is a real state
 * and says so: `orderPhone` is resolved from the branches in the store query,
 * because since `0101` the branch carries it.
 */
export function ShopFacts({ store }: { store: Store }) {
  const number = store.orderPhone;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-3">
      <span className="truncate">{shopMeta(store)}</span>
      {number ? (
        <Tooltip content={t("store.orderPhoneHint")}>
          <span className="tabular-nums">
            <Copyable value={`+${number}`} label={t("store.copyWhatsapp")} />
          </span>
        </Tooltip>
      ) : (
        <NoWhatsappWarning />
      )}
      {store.isFeatured && <Badge tone="info">{t("catalogue.featured")}</Badge>}
    </div>
  );
}
