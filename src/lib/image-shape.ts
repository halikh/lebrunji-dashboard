/**
 * The shape a picture has to be, and whether one is.
 *
 * ## Why this is checked at all
 *
 * The app draws artwork into a fixed frame and crops whatever does not fit.
 * A banner's words are inside the picture, so a picture of the wrong shape is
 * not a picture shown a little smaller — it is a headline with its ends cut
 * off, discovered by a customer. Checking here is the only place it can be
 * caught before that.
 *
 * ## The frames are the app's, not a preference
 *
 * `offer-card.tsx` draws a banner at 21:9 and `promo-tiles.tsx` a tile at 4:5.
 * Change one there and it has to change here, or the dashboard refuses the
 * picture the app wants and accepts the one it crops.
 */
export type ImageShape = {
  /** Width over height, as the two whole numbers people say: 21 and 9. */
  width: number;
  height: number;
};

export const ARTWORK_SHAPES = {
  banner: { width: 21, height: 9 },
  tile: { width: 4, height: 5 },
} as const satisfies Record<string, ImageShape>;

/**
 * How far off a picture may be and still count.
 *
 * One percent: enough for an export that rounded 2100 × 900 to 2100 × 901,
 * nowhere near enough for a square passed off as a 4:5 (that is 25% out).
 * Beyond this the crop starts eating pixels somebody will notice.
 */
const TOLERANCE = 0.01;

export function fitsShape(
  size: { width: number; height: number },
  shape: ImageShape,
): boolean {
  if (size.width <= 0 || size.height <= 0) return false;
  const actual = size.width / size.height;
  const wanted = shape.width / shape.height;
  return Math.abs(actual - wanted) / wanted <= TOLERANCE;
}

/**
 * A picture's real size in pixels — a chosen file, or one already uploaded.
 *
 * Null when it cannot be read (a broken link, the network gone). Callers treat
 * that as "unknown", never as "wrong": refusing to save a form because a
 * picture did not load right now would be a check failing for a reason that
 * has nothing to do with the picture.
 */
export function measureImage(
  source: File | string,
): Promise<{ width: number; height: number } | null> {
  const src =
    typeof source === "string" ? source : URL.createObjectURL(source);
  return new Promise((resolve) => {
    const image = new Image();
    const done = (size: { width: number; height: number } | null) => {
      if (typeof source !== "string") URL.revokeObjectURL(src);
      resolve(size);
    };
    image.onload = () =>
      done({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => done(null);
    image.src = src;
  });
}
