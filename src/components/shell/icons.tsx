import type { IconName } from "./nav";

/**
 * The rail's icons, drawn rather than installed.
 *
 * Six shapes at one size is not worth a dependency, and an icon set would
 * arrive with its own stroke weight and grid to reconcile against the app's.
 * These share one geometry: a 24-unit box, 1.75 stroke, round caps, `none`
 * fill — so they read as a set rather than as six drawings.
 *
 * `currentColor` throughout, so an icon takes the colour of the thing it is
 * inside and no caller ever passes one.
 *
 * ## `data-anim`
 *
 * Each icon animates on hover, and **the part that moves is the part that
 * carries the meaning** — the arrow leaves the door, the bars grow, the sliders
 * slide. Scaling the whole icon up would have been one line and would have said
 * nothing: every icon would move identically, so the movement would carry no
 * information about what the thing does.
 *
 * The keyframes live in `globals.css`, keyed on these attributes. Two reasons
 * they are not inline: the animation is driven by hovering the *link*, not the
 * icon, so it needs a descendant selector — and holding them in one place is
 * what keeps six animations reading as one family rather than as six people's
 * separate ideas.
 *
 * Where a path is split into several — the report bars, the receipt's lines —
 * that is so they can be staggered. One path cannot carry two delays.
 */

const COMMON = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  // Decorative: every icon in the rail sits beside a real label, so announcing
  // it would read the name twice.
  "aria-hidden": true,
};

const PATHS: Record<IconName, React.ReactNode> = {
  // A receipt. The printed lines slide in, which is what an order arriving
  // actually looks like on the paper this icon is drawn as.
  orders: (
    <>
      <path d="M6 3v18l2-1.5L10 21l2-1.5L14 21l2-1.5L18 21V3l-2 1.5L14 3l-2 1.5L10 3 8 4.5Z" />
      <path d="M9.5 8.5h5" data-anim="line" data-anim-order="1" />
      <path d="M9.5 12h5" data-anim="line" data-anim-order="2" />
    </>
  ),
  // A shopfront. The shutter lifts — the one motion that means "open for
  // business" without needing a second object in the frame.
  catalogue: (
    <>
      <path d="M4 9h16v11H4z" />
      <path d="M3 9l1.5-4h15L21 9" />
      <path d="M9 20v-5h6v5" data-anim="shutter" />
    </>
  ),
  // A price tag, flicked. A tag that swings reads as one being turned over to
  // have its price read.
  pricing: (
    <g data-anim="swing">
      <path d="M3.5 11.5 11 4h8.5V12.5L12 20z" />
      <circle cx="15.5" cy="8.5" r="1.25" />
    </g>
  ),
  customers: (
    <>
      <circle cx="12" cy="8" r="3.5" data-anim="bob" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </>
  ),
  // Bars that grow, staggered left to right. The only icon whose subject is
  // change over time, so the only one that should move over time.
  reports: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6" data-anim="bar" data-anim-order="1" />
      <path d="M12 20V6" data-anim="bar" data-anim-order="2" />
      <path d="M17 20v-9" data-anim="bar" data-anim-order="3" />
    </>
  ),
  // Sliders, not a cog.
  //
  // The first attempt was a circle with eight radiating spokes, which at 22px
  // is a sun — and a sun beside a coral-and-cream palette reads as a theme
  // toggle, the one thing it must not be mistaken for. A cog is the
  // conventional answer but needs a lot of small geometry to look like a cog
  // rather than a flower at this size.
  //
  // Sliders survive the size, and they have something to animate: the knobs
  // slide. A cog can only spin, and a spinning cog reads as "working" rather
  // than "settings".
  settings: (
    <>
      <path d="M4 8h8M16 8h4" />
      <circle cx="14" cy="8" r="2" data-anim="knob" data-anim-order="1" />
      <path d="M4 16h4M12 16h8" />
      <circle cx="10" cy="16" r="2" data-anim="knob" data-anim-order="2" />
    </>
  ),
  // A door with an arrow leaving it. The arrow points out, which is the half
  // that carries the meaning — a door alone reads as "enter" just as easily —
  // A scooter, because that is the thing that turns up. The wheels are their
  // own group so they can roll on hover — the part that moves is the part that
  // carries the meaning, as everywhere else in this set.
  drivers: (
    <>
      <g data-anim="roll">
        <circle cx="5.5" cy="17.5" r="2.5" />
        <circle cx="18.5" cy="17.5" r="2.5" />
      </g>
      <path d="M8 17.5h8" />
      <path d="M18.5 17.5V11a2 2 0 0 0-2-2H14" />
      <path d="M5.5 17.5 9 8h3" />
      <path d="M13 5h2a1 1 0 0 1 1 1v3" />
    </>
  ),

  // and on hover it goes.
  "sign-out": (
    <>
      <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
      <g data-anim="leave">
        <path d="M17 15l3-3-3-3" />
        <path d="M20 12H10" />
      </g>
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg {...COMMON} width={size} height={size} className={className}>
      {PATHS[name]}
    </svg>
  );
}
