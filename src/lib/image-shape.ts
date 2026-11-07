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
 *
 * The square ones are drawn `contain` rather than cropped — a category in
 * `category-tiles.tsx` and `category-card.tsx`, an aisle or sub-aisle in
 * `aisle-tile.tsx` — so a picture of another shape loses nothing, but comes
 * out smaller than its neighbours with grey down two sides of it, which in a
 * row of them reads as the odd one out.
 */
export type ImageShape = {
  /** Width over height, as the two whole numbers people say: 21 and 9. */
  width: number;
  height: number;
};

export const ARTWORK_SHAPES = {
  banner: { width: 21, height: 9 },
  tile: { width: 4, height: 5 },
  categoryIcon: { width: 1, height: 1 },
  aisle: { width: 1, height: 1 },
  // Every live tag icon is a transparent square (500 × 500); until
  // 2026-11-07 nothing said so, and nothing stopped a photo going in.
  tagIcon: { width: 1, height: 1 },
} as const satisfies Record<string, ImageShape>;

/**
 * The shape in a word — what the team calls it, for the uploader's line.
 * Anything wider than 2:1 is "wide" (a banner), so 4:3 stays "landscape".
 */
export function shapeName(
  shape: ImageShape,
): "square" | "portrait" | "landscape" | "wide" {
  const ratio = shape.width / shape.height;
  if (ratio === 1) return "square";
  if (ratio < 1) return "portrait";
  return ratio > 2 ? "wide" : "landscape";
}

/**
 * A size in pixels to quote for `shape`.
 *
 * For the shapes the art is made in, the size ChatGPT returns for that shape
 * — which is the size of every such picture in production on 2026-11-07, and
 * so a file generated from `lib/image-prompts.ts` passes {@link fitsShape} as
 * it comes. Anything else is worked out at 1200 pixels across.
 */
export function exampleSize(shape: ImageShape): {
  width: number;
  height: number;
} {
  const key = `${shape.width}:${shape.height}`;
  if (key === "1:1") return { width: 1254, height: 1254 };
  if (key === "4:5") return { width: 1122, height: 1402 };
  if (key === "21:9") return { width: 1915, height: 821 };
  return {
    width: 1200,
    height: Math.round((1200 * shape.height) / shape.width),
  };
}

/**
 * ## Photographs: one master shape, cropped again by the app
 *
 * A shop's or a dish's photograph is not drawn in one frame but in many, so no
 * single shape fits them all. Each is cut to a master shape on upload — the
 * framing step, `ImageFramer` — with a point saying where the subject is
 * (`lib/image-focus.ts`), and the app crops each frame around that point.
 *
 * - **Dish 1:1.** Nearly every frame a dish is in is square: the menu's
 *   cards and rows, the basket, the order. Bundles are dishes here.
 * - **Shop 4:3.** Shops run from 2.4:1 cards on Home to near-square posters
 *   and square thumbnails; 4:3 sits between them, and it is the shape a phone
 *   camera takes, so a shop's own photo loses least.
 *
 * `previews` are the app's frames, approximately, from its constants
 * (`store-cards.tsx`'s `RAIL_ART_RATIO`, `RAIL_FEATURED`, `RAIL_DISH`; the
 * shop and dish pages' covers). They are shown in the framing step so the
 * team sees what the customer will. Not exact to the point — the app's
 * frames scale with the phone — and they do not need to be.
 *
 * ## Big enough for the cover
 *
 * `cover` is the largest frame: the shop or dish page's own photo, the width
 * of the phone (440 points on the widest) and about three quarters as tall.
 * On a 3× phone that is about 1320 real pixels across, and a photo with fewer
 * is stretched there — sharp on every card, soft as the cover (user,
 * 2026-11-05; on dev, eight shops' photos were banners or about 590 pixels
 * wide). The framing step says so when a crop has too few pixels for it,
 * {@link coverPixelsNeeded}; it warns rather than refuses, because a soft
 * photo of the right shop is better than none.
 */
export type PhotoKind = "dish" | "shop";

export type PhotoPreview = {
  /** `images.frame.<key>` in the strings. */
  key:
    | "card"
    | "rail"
    | "dishPage"
    | "homeCard"
    | "featured"
    | "thumb"
    | "shopPage";
  ratio: number;
};

export const PHOTO_FRAMES = {
  dish: {
    shape: { width: 1, height: 1 },
    previews: [
      { key: "card", ratio: 1 },
      { key: "rail", ratio: 1.9 },
      { key: "dishPage", ratio: 1.5 },
    ],
    cover: { width: 440, height: 290 },
  },
  shop: {
    shape: { width: 4, height: 3 },
    previews: [
      { key: "homeCard", ratio: 2.4 },
      { key: "featured", ratio: 0.93 },
      { key: "thumb", ratio: 1 },
      { key: "shopPage", ratio: 1.33 },
    ],
    cover: { width: 440, height: 330 },
  },
} as const satisfies Record<
  PhotoKind,
  {
    shape: ImageShape;
    previews: readonly PhotoPreview[];
    /** The page cover, in points. See "Big enough for the cover". */
    cover: { width: number; height: number };
  }
>;

/** The densest phone the app is fetched for — `image-url.ts` there. */
const COVER_SCALE = 3;

/**
 * How many pixels across a picture of `aspect` (width over height) needs to
 * be sharp as `cover`. The cover crops to fill, so a picture wider for its
 * height than the cover is scaled to the cover's height and needs more.
 */
export function coverPixelsNeeded(
  cover: { width: number; height: number },
  aspect: number,
): number {
  const drawn = Math.max(cover.width, cover.height * aspect);
  return Math.round(drawn * COVER_SCALE);
}

/**
 * Stretched by more than this and it shows. A 1254-pixel square on a 1320
 * cover (1.05×) is sharp; a 1024 one (1.29×) is just soft enough to say so.
 */
const SOFT_STRETCH = 1.25;

/** Whether `pixels` across is too few for `needed`. */
export function looksSoft(pixels: number, needed: number): boolean {
  return pixels > 0 && needed / pixels > SOFT_STRETCH;
}

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
