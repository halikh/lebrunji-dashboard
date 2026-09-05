import { describe, expect, it } from "vitest";

import {
  CONTRAST_FLOOR,
  INK_HEX,
  bestInk,
  contrastRatio,
  isLegible,
} from "./contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#14b87f", "#14b87f")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the pair is given", () => {
    expect(contrastRatio("#ff5a3c", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#ff5a3c"),
      10,
    );
  });

  /*
   * The five the palette measured by hand before `0114` made colours free.
   * These are the numbers written into `theme.css` and into the chip's own
   * note, so a change here that moved them would be a change to something the
   * design has already decided.
   */
  it("reproduces the palette's own recorded figures", () => {
    expect(contrastRatio("#f0eae1", INK_HEX.dark)).toBeCloseTo(14.3, 1);
    expect(contrastRatio("#14b87f", INK_HEX.dark)).toBeCloseTo(6.7, 1);
    expect(contrastRatio("#ffc634", INK_HEX.dark)).toBeCloseTo(10.9, 1);
    expect(contrastRatio("#ff5a3c", INK_HEX.dark)).toBeCloseTo(5.5, 1);
    expect(contrastRatio("#6c4bf5", INK_HEX.light)).toBeCloseTo(5.3, 1);
  });

  // White on coral is 3.1:1 — the number the palette records as fine for a ring
  // and under the bar for a label. It is the pairing the whole ink choice
  // exists to let somebody see before they pick it.
  it("agrees that white on coral is under the bar", () => {
    expect(contrastRatio("#ff5a3c", INK_HEX.light)).toBeCloseTo(3.1, 1);
    expect(isLegible("#ff5a3c", "light")).toBe(false);
    expect(isLegible("#ff5a3c", "dark")).toBe(true);
  });
});

describe("bestInk", () => {
  it("picks dark on a light ground and light on a dark one", () => {
    expect(bestInk("#ffc634")).toBe("dark");
    expect(bestInk("#6c4bf5")).toBe("light");
    expect(bestInk("#ffffff")).toBe("dark");
    expect(bestInk("#000000")).toBe("light");
  });
});

describe("hex parsing", () => {
  it("takes shorthand, a missing hash, and any case", () => {
    expect(contrastRatio("#fff", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("FFFFFF", "#000")).toBeCloseTo(21, 1);
  });

  // A malformed colour reads as black, which is the pessimistic answer: it
  // reports the pairing as worse than it is rather than waving it through.
  it("treats nonsense as black rather than as fine", () => {
    expect(contrastRatio("not-a-colour", INK_HEX.dark)).toBeLessThan(
      CONTRAST_FLOOR,
    );
  });
});
