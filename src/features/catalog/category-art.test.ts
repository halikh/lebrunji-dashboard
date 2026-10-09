import { describe, expect, it } from "vitest";

import {
  CATEGORY_HUES,
  CATEGORY_PRESETS,
  categoryArt,
  hexOfHue,
  hueOfHex,
} from "./category-art";

const ID = "3f6c2a1e-8b4d-4c2a-9e1f-0a7b5c3d2e10";

describe("categoryArt", () => {
  // Read off the app's own `categoryArt` for these ids. If this fails, the
  // editor's "Automatic" preview no longer matches what a customer sees.
  it("picks what the app picks", () => {
    expect([categoryArt(ID).preset, categoryArt(ID).hue]).toEqual([
      "halo",
      284,
    ]);
    expect([
      categoryArt("all-stores").preset,
      categoryArt("all-stores").hue,
    ]).toEqual(["blob", 6]);
    const other = categoryArt("b0b0b0b0-0000-4000-8000-000000000001");
    expect([other.preset, other.hue]).toEqual(["arc", 330]);
  });

  it("takes a valid preset override and ignores an invalid one", () => {
    expect(categoryArt(ID, { preset: 2 }).preset).toBe("halo");
    expect(categoryArt(ID, { preset: 0 }).preset).toBe(CATEGORY_PRESETS[0]);
    expect(categoryArt(ID, { preset: 9 }).preset).toBe(categoryArt(ID).preset);
  });

  it("takes only the hue of a tint override", () => {
    const art = categoryArt(ID, { tint: "#FF0000" });
    expect(art.hue).toBe(0);
    expect(art.top).toBe("hsl(0, 70%, 96.5%)");
  });

  it("lets the id choose when the tint is grey or malformed", () => {
    const own = categoryArt(ID).hue;
    expect(categoryArt(ID, { tint: "#808080" }).hue).toBe(own);
    expect(categoryArt(ID, { tint: "red" }).hue).toBe(own);
  });
});

describe("hexOfHue", () => {
  it("round-trips every swatch hue through the stored hex", () => {
    for (const hue of CATEGORY_HUES) {
      const hex = hexOfHue(hue);
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(Math.abs((hueOfHex(hex) ?? -99) - hue)).toBeLessThanOrEqual(1);
    }
  });
});
