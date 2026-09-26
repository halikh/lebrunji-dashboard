/**
 * The order statuses, and what colour each one is.
 *
 * ## Hardcoded, on purpose
 *
 * The path is fixed: `order_stores.status` is a `text` column constrained to
 * exactly the five slugs below, and there is no `order_statuses` table any
 * more for a step to be added to. So the list, its order and each step's
 * position on the path live here, once, and every screen reads them from this
 * module rather than from the database. The names are chrome, not content —
 * they go through `t()` like every other string the dashboard ships.
 *
 * Changing the path is therefore a migration in the app repo *and* an edit
 * here, in the same change. A slug the database accepts and this list does not
 * know would render colourless and fall outside every tab.
 *
 * ## Why the colours are custom properties and not Tailwind classes
 *
 * Tailwind can only emit classes it can see in the source, and a
 * `bg-status-${slug}` built at runtime would be purged and render as nothing.
 * So the values here are CSS custom properties, applied inline. That is the one
 * legitimate exception to "components never name a colour": these are still
 * roles from `theme.css`, chosen by data rather than by a component.
 *
 * ## Why four values and not one
 *
 * A single hue is enough for a dot and useless for everything else. The value
 * that reads well as a 7px marker is unreadable as 13px text and illegible
 * under a white label — mint is the clearest case: fine as a fill, too light to
 * set type in, which is why the app pairs it with `mint-deep`.
 *
 * ## The tension with the palette, and how it is resolved
 *
 * The app's rule is that **coral is what you press next**. Colouring the advance
 * button by status appears to break it, and would if colour were the only thing
 * marking the primary action.
 *
 * It is not: the advance button is still the only filled, full-weight control in
 * the row. What the status colour adds is *which* step you are about to take —
 * so "Confirm" is blue, "Send driver" is grape, "Delivered" is mint, and an
 * operator working quickly learns the colour of the action rather than reading
 * every button. Coral stays what it always was on every other screen.
 */

import { t } from "@/i18n/translations";

/** Every status, in path order — cancelled last, because it is off the path. */
export const ORDER_STATUS_SLUGS = [
  "ordered",
  "confirmed",
  "driverSent",
  "delivered",
  "cancelled",
] as const;

export type OrderStatusSlug = (typeof ORDER_STATUS_SLUGS)[number];

export type OrderStatus = {
  slug: OrderStatusSlug;
  /** In the dashboard's language, from `t()`. */
  name: string;
  /** Position on the path. `null` is terminal and off it — cancelled. */
  progress: number | null;
};

/**
 * Position on the delivery path. Mirrors the database's own map, which
 * `api_v1_advance_order` and `api_v1_admin_stats` read.
 */
const PROGRESS: Record<OrderStatusSlug, number | null> = {
  ordered: 1,
  confirmed: 2,
  driverSent: 3,
  delivered: 4,
  cancelled: null,
};

export function isOrderStatusSlug(slug: string): slug is OrderStatusSlug {
  return (ORDER_STATUS_SLUGS as readonly string[]).includes(slug);
}

/** Where a slug sits on the path; `null` for cancelled or an unknown slug. */
export function statusProgress(slug: string): number | null {
  return isOrderStatusSlug(slug) ? PROGRESS[slug] : null;
}

/** A status's display name. An unknown slug shows as itself, not as nothing. */
export function statusName(slug: string): string {
  return isOrderStatusSlug(slug) ? t(`orderStatus.${slug}`) : slug;
}

/** Delivered or cancelled — nothing further can happen to it. */
export function isFinishedSlug(slug: string): boolean {
  return slug === "delivered" || slug === "cancelled";
}

/** Every status with its name and progress, in path order. */
export function orderStatuses(): OrderStatus[] {
  return ORDER_STATUS_SLUGS.map((slug) => ({
    slug,
    name: statusName(slug),
    progress: PROGRESS[slug],
  }));
}

export type StatusTone = {
  /** A graphic: the dot beside a status. Never type. */
  dot: string;
  /** Type on a light ground. Clears 4.5:1 on cream. */
  ink: string;
  /** A button or pill ground. */
  fill: string;
  /** The label on that ground — stated, never assumed to be white. */
  onFill: string;
  /** A tinted ground for a pill or an active tab. */
  wash: string;
};

/** `driverSent` in the database, `driver-sent` in CSS. */
function tokenName(slug: string): string {
  return slug.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function statusTone(slug: string): StatusTone {
  // A slug outside the list falls back to `unknown` rather than rendering
  // colourless — the database constraint should make that impossible, but a
  // blank dot would hide it if it ever were not.
  const name = isOrderStatusSlug(slug) ? tokenName(slug) : "unknown";

  return {
    dot: `var(--color-status-${name})`,
    ink: `var(--color-status-${name}-ink)`,
    fill: `var(--color-status-${name}-fill)`,
    onFill: `var(--color-status-${name}-on-fill)`,
    wash: `var(--color-status-${name}-wash)`,
  };
}

/**
 * Whether a status can still be moved off.
 *
 * `progress: null` is off the path — cancelled. The furthest step on the path is
 * the end of it. `api_v1_set_order_status` refuses both, so this is the UI
 * agreeing with the database rather than a second opinion: it decides whether
 * an undo is offered, and an undo that the server would refuse is worse than
 * none.
 */
export function isTerminal(progress: number | null): boolean {
  return progress === null;
}
