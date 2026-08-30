/**
 * What colour a status is.
 *
 * ## Why this is a lookup and not Tailwind classes
 *
 * `order_statuses` is a lookup table rather than an enum — deliberately, so a
 * merchant can insert a step without an app release (migration 0032 says so).
 * The set of slugs is therefore **not known at build time**, and Tailwind can
 * only emit classes it can see in the source. A `bg-status-${slug}` would be
 * purged and render as nothing.
 *
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

/**
 * Slugs are `order_statuses.slug` as seeded by migration 0003.
 *
 * A slug that is not here is not an error — it is a step somebody added — so it
 * falls back to `unknown` rather than rendering colourless.
 */
const KNOWN = [
  "ordered",
  "confirmed",
  "driverSent",
  "delivered",
  "cancelled",
] as const;

/** `driverSent` in the database, `driver-sent` in CSS. */
function tokenName(slug: string): string {
  return slug.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function statusTone(slug: string): StatusTone {
  const name = (KNOWN as readonly string[]).includes(slug)
    ? tokenName(slug)
    : "unknown";

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
