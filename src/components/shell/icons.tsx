import type { IconName } from './nav';

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
 */

const COMMON = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  // Decorative: every icon in the rail sits beside a real label, so announcing
  // it would read the name twice.
  'aria-hidden': true,
};

const PATHS: Record<IconName, React.ReactNode> = {
  // A receipt — the order queue.
  orders: (
    <>
      <path d="M6 3v18l2-1.5L10 21l2-1.5L14 21l2-1.5L18 21V3l-2 1.5L14 3l-2 1.5L10 3 8 4.5Z" />
      <path d="M9.5 8.5h5M9.5 12h5" />
    </>
  ),
  // A shopfront with an awning — stores and their menus.
  catalogue: (
    <>
      <path d="M4 9h16v11H4z" />
      <path d="M3 9l1.5-4h15L21 9" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  // A price tag — the delivery ladder and the rate.
  pricing: (
    <>
      <path d="M3.5 11.5 11 4h8.5V12.5L12 20z" />
      <circle cx="15.5" cy="8.5" r="1.25" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </>
  ),
  // Bars, matching the charts they lead to.
  reports: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V6M17 20v-9" />
    </>
  ),
  // A door with an arrow leaving it. The arrow points out, which is the half
  // that carries the meaning — a door alone reads as "enter" just as easily.
  'sign-out': (
    <>
      <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
      <path d="M17 15l3-3-3-3" />
      <path d="M20 12H10" />
    </>
  ),
  // Sliders, not a cog.
  //
  // The first attempt was a circle with eight radiating spokes, which at 22px
  // is a sun — and a sun beside a coral-and-cream palette reads as a theme
  // toggle, which is the one thing it must not be mistaken for. A cog is the
  // conventional answer but needs a lot of small geometry to look like a cog
  // rather than a flower at this size. Sliders survive the size, and say
  // "things you adjust" without any of that.
  settings: (
    <>
      <path d="M4 8h8M16 8h4" />
      <circle cx="14" cy="8" r="2" />
      <path d="M4 16h4M12 16h8" />
      <circle cx="10" cy="16" r="2" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg {...COMMON} width={size} height={size}>
      {PATHS[name]}
    </svg>
  );
}
