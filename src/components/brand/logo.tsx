/**
 * The LebRunji logo, in the designer's two Latin lockups.
 *
 * - **`stacked`** — the running pin in its tarboush over "leb" set above
 *   "Runji". Page 2 of "LebRunji Logo-final.pdf". Taller than wide, so it holds
 *   up in the narrow rail and the phone top bar, where a wide logo would shrink
 *   to nothing.
 * - **`wide`** — the pin over "LebRunji" on one line. `lebrunji-1.svg` from the
 *   designer's SVG set. For the sign-in screens, where the logo has the width
 *   to itself and is the first thing anybody sees.
 *
 * Both are exported with the yellow presentation ground removed and the view
 * box cropped to the art, on their white sticker edge, so they stand on any
 * surface.
 *
 * A logo's colours are the logo, so nothing here reads a theme role.
 */
export function Logo({
  width,
  variant = "stacked",
  priority = false,
}: {
  /** In pixels; the height follows the art. */
  width: number;
  variant?: "stacked" | "wide";
  /** For the sign-in screens, where the logo is the first thing painted. */
  priority?: boolean;
}) {
  const art = ART[variant];
  return (
    // A static SVG from `public/` — `next/image` has nothing to optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      alt="LebRunji"
      width={width}
      height={Math.round(width / art.aspect)}
      fetchPriority={priority ? "high" : undefined}
      draggable={false}
    />
  );
}

/** Each file, and its view box's width over its height. */
const ART = {
  stacked: { src: "/brand/lebrunji-logo-stacked.svg", aspect: 429 / 602 },
  wide: { src: "/brand/lebrunji-logo.svg", aspect: 686 / 496 },
} as const;
