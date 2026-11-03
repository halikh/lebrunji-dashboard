import { describe, expect, it } from "vitest";

import { ARTWORK_SHAPES, fitsShape } from "./image-shape";

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
    expect(fitsShape({ width: 1920, height: 1080 }, ARTWORK_SHAPES.banner)).toBe(
      false,
    );
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
