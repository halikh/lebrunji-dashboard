/**
 * The Lebrunji wordmark — eight letters on a red tile, each at its own angle,
 * the whole thing tilted onto a hard ink shadow.
 *
 * Ported from `src/components/domain/wordmark.tsx` in the app. Every number
 * here is the design's; the only thing that changed is the medium — React
 * Native's `transform` arrays become CSS transforms, and `Text` nodes become
 * spans.
 *
 * ## Why it is drawn rather than an image
 *
 * It is type. An exported PNG would need a set per density, would soften at the
 * sizes it is used at, and would be a second copy of the brand face to keep in
 * step with the one already loaded. Drawn, it is eight spans and it is sharp at
 * any scale — including as a favicon and on a print stylesheet.
 *
 * ## Why every letter is different
 *
 * The rotations and vertical nudges are not random: they alternate, so the
 * baseline reads as bouncing rather than as broken. The two colour groups —
 * three cream letters, then five sun — are the design's, and the split is what
 * stops the word reading as one solid block.
 *
 * The shadow is a hard offset with no blur. A soft shadow under a tilted tile
 * looks like a mistake; a hard one looks like a sticker, which is what this is
 * meant to be.
 *
 * ## Latin only, here
 *
 * The app has an Arabic mark as well, and it is not a translation of this one —
 * Arabic is cursive, so the per-letter bounce that makes the Latin mark would
 * cut every letter into its isolated form and read as a misspelling rather than
 * a logo. The dashboard's chrome is English, so that case does not arise. If a
 * second language is ever added here, port the Arabic mark rather than
 * transliterating this one; the reasoning is in the app's file.
 */

/**
 * The mark's own colours, deliberately **not** theme roles.
 *
 * A logo's colours are the logo. Held here so a palette change cannot recolour
 * the brand — `--color-brand-mark` exists in `theme.css` for documentation, and
 * this component does not read it. They are the same red *by agreement*, not by
 * reference, and that is the seam that stops a future accent change repainting
 * the mark.
 */
const mark = {
  tile: "#e01f28",
  shadow: "#1e1b18",
  cream: "#fff8f0",
  sun: "#ffc634",
} as const;

/**
 * Each letter, with its angle in degrees, its vertical nudge in pixels, and
 * which of the two colour groups it belongs to. Verbatim from the design.
 */
const LETTERS: {
  char: string;
  size: number;
  rotate: number;
  lift: number;
  sun: boolean;
}[] = [
  { char: "L", size: 31, rotate: -3, lift: 1, sun: false },
  { char: "E", size: 28, rotate: 2, lift: 0, sun: false },
  { char: "B", size: 31, rotate: -1, lift: -1, sun: false },
  { char: "R", size: 29, rotate: 3, lift: 0, sun: true },
  { char: "U", size: 32, rotate: -2, lift: -1, sun: true },
  { char: "N", size: 28, rotate: 1, lift: 0, sun: true },
  { char: "J", size: 31, rotate: -3, lift: 1, sun: true },
  { char: "I", size: 29, rotate: 2, lift: 0, sun: true },
];

/** How far the whole tile is tilted, in degrees. */
const TILT = -2.2;

export function Wordmark({
  scale = 1,
  className,
}: {
  scale?: number;
  className?: string;
}) {
  return (
    // Inline-block so the wrap hugs the tile rather than filling its parent —
    // the tilt has to happen around the word, not around a full-width box.
    <span className={className} style={{ display: "inline-block" }}>
      <span
        // `aria-label` on the tile and `aria-hidden` on the letters: eight
        // separate spans would otherwise be read out one glyph at a time.
        role="img"
        aria-label="Lebrunji"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 0,
          background: mark.tile,
          padding: `${8 * scale}px ${15 * scale}px ${10 * scale}px`,
          borderRadius: 16 * scale,
          transform: `rotate(${TILT}deg)`,
          // Hard offset, no blur — see above.
          boxShadow: `${4 * scale}px ${4 * scale}px 0 ${mark.shadow}`,
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          letterSpacing: 0,
        }}
      >
        {LETTERS.map((letter, index) => (
          <span
            // Index-keyed: a fixed run of glyphs with no identity of its own,
            // and letters repeat.
            key={`${letter.char}-${index}`}
            aria-hidden
            style={{
              color: letter.sun ? mark.sun : mark.cream,
              fontSize: letter.size * scale,
              lineHeight: `${letter.size * 0.9 * scale}px`,
              display: "inline-block",
              transform: `rotate(${letter.rotate}deg) translateY(${letter.lift * scale}px)`,
            }}
          >
            {letter.char}
          </span>
        ))}
      </span>
    </span>
  );
}
