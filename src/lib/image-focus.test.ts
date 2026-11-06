import { describe, expect, it } from "vitest";

import {
  objectPosition,
  readFocus,
  withFocus,
  withoutFragment,
} from "./image-focus";

const URL =
  "https://img.lebrunji.com/menu-items/0b1c2d3e-0000-4000-8000-000000000000.jpg";

describe("withFocus", () => {
  it("puts the point on the address, two decimals", () => {
    expect(withFocus(URL, { x: 0.256, y: 0.8 })).toBe(`${URL}#focus=0.26,0.80`);
  });

  it("replaces a point already there", () => {
    expect(withFocus(`${URL}#focus=0.10,0.10`, { x: 0.9, y: 0.2 })).toBe(
      `${URL}#focus=0.90,0.20`,
    );
  });

  it("says the middle by saying nothing", () => {
    expect(withFocus(`${URL}#focus=0.10,0.10`, { x: 0.5, y: 0.5 })).toBe(URL);
    expect(withFocus(`${URL}#focus=0.10,0.10`, null)).toBe(URL);
  });

  it("keeps a point inside the picture", () => {
    expect(withFocus(URL, { x: -1, y: 4 })).toBe(`${URL}#focus=0.00,1.00`);
  });
});

describe("readFocus", () => {
  it("reads back what withFocus wrote", () => {
    expect(readFocus(withFocus(URL, { x: 0.3, y: 0.7 }))).toEqual({
      x: 0.3,
      y: 0.7,
    });
  });

  it("is null when the address says nothing, or nonsense", () => {
    expect(readFocus(URL)).toBeNull();
    expect(readFocus(null)).toBeNull();
    expect(readFocus(`${URL}#focus=2,0.5`)).toBeNull();
    expect(readFocus(`${URL}#elsewhere`)).toBeNull();
  });
});

describe("the rest", () => {
  it("strips the fragment", () => {
    expect(withoutFragment(`${URL}#focus=0.30,0.70`)).toBe(URL);
  });

  it("matches CSS object-position", () => {
    expect(objectPosition({ x: 0.3, y: 0.7 })).toBe("30% 70%");
    expect(objectPosition(null)).toBe("50% 50%");
  });
});
