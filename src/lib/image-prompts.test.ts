import { describe, expect, it } from "vitest";

import {
  imagePrompt,
  isCutoutKind,
  type ImagePromptKind,
} from "./image-prompts";
import {
  ARTWORK_SHAPES,
  exampleSize,
  fitsShape,
  shapeName,
  type ImageShape,
} from "./image-shape";

const SHAPE: Record<ImagePromptKind, ImageShape> = {
  category: ARTWORK_SHAPES.categoryIcon,
  aisle: ARTWORK_SHAPES.aisle,
  subAisle: ARTWORK_SHAPES.aisle,
  tag: ARTWORK_SHAPES.tagIcon,
  tile: ARTWORK_SHAPES.tile,
  banner: ARTWORK_SHAPES.banner,
};

describe("imagePrompt", () => {
  // The whole point of quoting a size: a file made from the prompt has to
  // get past the uploader's shape check as it comes.
  it.each(Object.entries(SHAPE))(
    "asks %s for a size its uploader accepts",
    (kind, shape) => {
      const size = exampleSize(shape);
      expect(fitsShape(size, shape)).toBe(true);
      expect(imagePrompt(kind as ImagePromptKind, "x")).toContain(
        `${size.width} × ${size.height} pixels`,
      );
    },
  );

  it("asks for a transparent background exactly where the upload needs one", () => {
    for (const kind of Object.keys(SHAPE) as ImagePromptKind[]) {
      expect(imagePrompt(kind, "x").includes("transparent background")).toBe(
        isCutoutKind(kind),
      );
    }
  });

  it("puts the subject in, and leaves a visible gap without one", () => {
    expect(imagePrompt("aisle", "  Dairy & Eggs ")).toContain('"Dairy & Eggs"');
    expect(imagePrompt("aisle", "   ")).toContain('"[name]"');
  });

  it("writes a card's headline only when there is one", () => {
    expect(imagePrompt("tile", "a rider", "20% off")).toContain('"20% off"');
    expect(imagePrompt("tile", "a rider")).toContain("No text");
  });

  it("gives the three art families the same style text within a family", () => {
    const style = (kind: ImagePromptKind) =>
      imagePrompt(kind, "x").split("\n").slice(-7).join("\n");
    expect(style("category")).toBe(style("aisle"));
    expect(style("aisle")).toBe(style("subAisle"));
  });
});

describe("shapeName", () => {
  it("names the frames the way the team does", () => {
    expect(shapeName(ARTWORK_SHAPES.aisle)).toBe("square");
    expect(shapeName(ARTWORK_SHAPES.tile)).toBe("portrait");
    expect(shapeName(ARTWORK_SHAPES.banner)).toBe("wide");
    expect(shapeName({ width: 4, height: 3 })).toBe("landscape");
  });
});
