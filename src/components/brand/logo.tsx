/**
 * The LebRunji logo — the secondary, stacked lockup: the running pin in its
 * tarboush over "leb" set above "Runji", on a white sticker edge.
 *
 * Page 2 of the designer's "LebRunji Logo-final.pdf", exported as vector with
 * the yellow presentation ground removed and the view box cropped to the art,
 * so it stands on any surface. The stacked form rather than the primary
 * one-line lockup because it is taller than wide, and so holds up in the
 * narrow rail and the phone top bar where a wide logo would shrink to nothing.
 *
 * A logo's colours are the logo, so nothing here reads a theme role.
 */
export function Logo({
  width,
  priority = false,
}: {
  /** In pixels; the height follows the art. */
  width: number;
  /** For the sign-in screens, where the logo is the first thing painted. */
  priority?: boolean;
}) {
  return (
    // A static SVG from `public/` — `next/image` has nothing to optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/lebrunji-logo-stacked.svg"
      alt="LebRunji"
      width={width}
      height={Math.round(width / ASPECT)}
      fetchPriority={priority ? "high" : undefined}
      draggable={false}
    />
  );
}

/** The SVG's view box is 429×602. */
const ASPECT = 429 / 602;
