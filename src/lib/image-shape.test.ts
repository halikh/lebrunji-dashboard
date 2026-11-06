import { describe, expect, it } from "vitest";

import {
  ARTWORK_SHAPES,
  coverPixelsNeeded,
  fitsShape,
  hasClearBorder,
  looksSoft,
  PHOTO_FRAMES,
} from "./image-shape";

describe("fitsShape", () => {
  it("accepts the example sizes the hints give", () => {
    expect(fitsShape({ width: 2100, height: 900 }, ARTWORK_SHAPES.banner)).toBe(
      true,
    );
    expect(fitsShape({ width: 800, height: 1000 }, ARTWORK_SHAPES.tile)).toBe(
      true,
    );
  });

  it("forgives an export that rounded a pixel", () => {
    expect(fitsShape({ width: 2100, height: 901 }, ARTWORK_SHAPES.banner)).toBe(
      true,
    );
  });

  it("refuses a square as a tile, and a 16:9 as a banner", () => {
    expect(fitsShape({ width: 600, height: 600 }, ARTWORK_SHAPES.tile)).toBe(
      false,
    );
    expect(
      fitsShape({ width: 1920, height: 1080 }, ARTWORK_SHAPES.banner),
    ).toBe(false);
  });

  it("refuses the other format's shape", () => {
    expect(fitsShape({ width: 2100, height: 900 }, ARTWORK_SHAPES.tile)).toBe(
      false,
    );
  });

  it("refuses an image with no size", () => {
    expect(fitsShape({ width: 0, height: 0 }, ARTWORK_SHAPES.tile)).toBe(false);
  });
});

describe("hasClearBorder", () => {
  /** A square of one alpha, with an optional block of another in the middle. */
  function square(size: number, edge: number, middle = edge, inset = 0) {
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inside =
          x >= inset && y >= inset && x < size - inset && y < size - inset;
        pixels[(y * size + x) * 4 + 3] = inside ? middle : edge;
      }
    }
    return pixels;
  }

  it("accepts a subject on a transparent ground", () => {
    expect(hasClearBorder(square(20, 0, 255, 3), 20, 20)).toBe(true);
  });

  it("refuses a photograph on a background", () => {
    expect(hasClearBorder(square(20, 255), 20, 20)).toBe(false);
  });

  it("refuses a photograph with transparency only inside it", () => {
    expect(hasClearBorder(square(20, 255, 0, 3), 20, 20)).toBe(false);
  });

  it("accepts a subject that touches the frame but leaves the corners clear", () => {
    const size = 20;
    const pixels = square(size, 255);
    // Clear the four corners, 3 × 3 each: 20 of the 76 border pixels.
    for (const [cx, cy] of [
      [0, 0],
      [size - 3, 0],
      [0, size - 3],
      [size - 3, size - 3],
    ]) {
      for (let y = cy; y < cy + 3; y++)
        for (let x = cx; x < cx + 3; x++) pixels[(y * size + x) * 4 + 3] = 0;
    }
    expect(hasClearBorder(pixels, size, size)).toBe(true);
  });
});

describe("sharp enough for the cover", () => {
  const cover = PHOTO_FRAMES.shop.cover;

  it("needs about 1320 pixels for a 4:3 shop photo", () => {
    expect(coverPixelsNeeded(cover, 4 / 3)).toBe(1320);
  });

  it("needs far more for a banner, which the cover scales to its height", () => {
    // Dar Aloud, Kshoor, Saleh Meat, Sarafand on dev: 1600 × 685.
    const needed = coverPixelsNeeded(cover, 1600 / 685);
    expect(needed).toBeGreaterThan(2300);
    expect(looksSoft(1600, needed)).toBe(true);
  });

  it("says a small photo is soft and a good one is not", () => {
    const needed = coverPixelsNeeded(cover, 4 / 3);
    expect(looksSoft(590, needed)).toBe(true); // Croissant Bahjat
    expect(looksSoft(1254, needed)).toBe(false);
    expect(looksSoft(2000, needed)).toBe(false);
  });
});
