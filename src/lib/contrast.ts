/**
 * How legible one colour is on another, measured rather than guessed.
 *
 * ## Why this had to become arithmetic
 *
 * It was a table. A tag could take one of five palette roles, so the five
 * pairings were measured once and written down beside them — which was honest
 * and is exactly what `0114` broke: a merchant can now pick any colour, and a
 * lookup table has nothing to say about `#7b1f3a`.
 *
 * So the dashboard computes it, and the number it shows is a real measurement
 * of the pair actually chosen.
 *
 * ## What the numbers mean
 *
 * WCAG 2 contrast ratio: 1 is invisible, 21 is black on white. The bar for
 * small text is **4.5**, which a 12px chip label is squarely under the size
 * threshold for. 3 is the bar for a graphic — a ring, an icon — and is why the
 * palette records white-on-coral at 3.1 as fine for one and not for a label.
 *
 * Nothing here refuses anything. `0114` says why: a merchant is allowed the
 * quieter pairing on their own brand, and the honest way to offer it is with
 * the figure beside it rather than a control that says no.
 */

/**
 * The two inks a tag can take, as this palette draws them.
 *
 * Transcribed from `theme.css` rather than read at runtime: `getComputedStyle`
 * would tie a pure function to a live DOM, and these two are the values a chip
 * is drawn in — if they move, this file is one of the places that has to know.
 */
export const INK_HEX = {
  dark: "#1e1b18",
  light: "#ffffff",
} as const;

/** The lowest ratio a 12px label should be drawn at. */
export const CONTRAST_FLOOR = 4.5;

/**
 * WCAG relative luminance, 0 (black) to 1 (white).
 *
 * The channel curve is the specification's, not a `/255` average: the eye is
 * far more sensitive to green than to blue, and a naive mean calls `#0000ff`
 * and `#00ff00` similarly bright when one is nearly black and the other nearly
 * white to read against.
 */
export function luminance(hex: string): number {
  const value = normalise(hex);
  const channel = (at: number) => {
    const raw = parseInt(value.slice(at, at + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * The ratio between two colours, 1 to 21.
 *
 * Symmetric — contrast is a property of a pair and has no direction — so the
 * caller never has to remember which argument is the ground.
 */
export function contrastRatio(a: string, b: string): number {
  const one = luminance(a);
  const two = luminance(b);
  const hi = Math.max(one, two);
  const lo = Math.min(one, two);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whether a pairing clears the bar for text this small. */
export function isLegible(background: string, ink: keyof typeof INK_HEX) {
  return contrastRatio(background, INK_HEX[ink]) >= CONTRAST_FLOOR;
}

/**
 * Which of the two inks reads better on a colour.
 *
 * A comparison rather than a lightness threshold, because the two inks are
 * fixed and only the ground moves: whichever measures higher *is* the better
 * answer, and a hand-picked cutoff would disagree with the ratio shown beside
 * it somewhere in the middle of the range.
 */
export function bestInk(background: string): keyof typeof INK_HEX {
  return contrastRatio(background, INK_HEX.dark) >=
    contrastRatio(background, INK_HEX.light)
    ? "dark"
    : "light";
}

/**
 * Six hex digits, lowercased, with no `#`.
 *
 * Three-digit shorthand is expanded rather than refused: it is what somebody
 * pastes out of half the design tools in existence, and `#fa0` meaning
 * `#ffaa00` is not ambiguous. The database stores six (`0114`), so this is the
 * one place the two spellings are reconciled.
 *
 * Anything else returns black, which is the safe wrong answer: a ratio computed
 * against black is pessimistic, so a malformed colour reads as *worse* than it
 * is rather than as fine.
 */
function normalise(hex: string): string {
  const value = hex.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(value)) {
    return value
      .split("")
      .map((digit) => digit + digit)
      .join("");
  }
  return /^[0-9a-f]{6}$/.test(value) ? value : "000000";
}
