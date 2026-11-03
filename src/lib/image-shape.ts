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
  const src = typeof source === "string" ? source : URL.createObjectURL(source);
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

/**
 * Whether a picture is a cut-out — drawn on nothing, so the app's own colour
 * shows around it.
 *
 * ## What counts
 *
 * The border, not the whole picture. A photograph with one stray see-through
 * pixel is still a photograph on a background; a dish cut out and laid on a
 * transparent square is see-through all round its edge, apart from wherever
 * it touches the frame. So: enough of the outermost ring of pixels has to be
 * (nearly) fully transparent.
 *
 * A tenth of it, because a round dish that fills a square touches the frame at
 * four points and leaves the corners clear — well over a tenth — while a photo
 * on a background has none at all. A JPEG cannot hold transparency, so every
 * JPEG fails, which is right.
 *
 * `pixels` is RGBA, four bytes a pixel, as `getImageData` returns it.
 */
const CLEAR_ALPHA = 16;
const CLEAR_BORDER_SHARE = 0.1;

export function hasClearBorder(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false;

  let border = 0;
  let clear = 0;
  for (let y = 0; y < height; y++) {
    const edgeRow = y === 0 || y === height - 1;
    for (let x = 0; x < width; x++) {
      if (!edgeRow && x !== 0 && x !== width - 1) continue;
      border++;
      if (pixels[(y * width + x) * 4 + 3] < CLEAR_ALPHA) clear++;
    }
  }
  return clear / border >= CLEAR_BORDER_SHARE;
}

/**
 * Whether a chosen file is a cut-out — see `hasClearBorder`.
 *
 * Null when the browser cannot decode it, which callers treat as unknown, for
 * the same reason as `measureImage`. Drawn no larger than 512 pixels across
 * first: the edge of a scaled-down cut-out is as clear as the original's, and
 * a phone photo at full size is twelve million pixels to read for nothing.
 */
const CUTOUT_SAMPLE = 512;

export async function isCutout(file: File): Promise<boolean | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(
    1,
    CUTOUT_SAMPLE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return hasClearBorder(
    context.getImageData(0, 0, width, height).data,
    width,
    height,
  );
}
