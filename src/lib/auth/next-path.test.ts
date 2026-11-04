import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

const ORIGIN = "https://dashboard.lebrunji.com";

describe("safeNextPath", () => {
  it("keeps a path on this dashboard", () => {
    expect(safeNextPath("/orders", ORIGIN)).toBe("/orders");
    expect(safeNextPath("/orders?scope=today#o-12", ORIGIN)).toBe(
      "/orders?scope=today#o-12",
    );
  });

  it("goes home when there is nothing to go to", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/");
    expect(safeNextPath("", ORIGIN)).toBe("/");
  });

  it("refuses another host, however it is spelled", () => {
    // The first two are what a plain prefix check already caught; the rest are
    // what it let through, each of which a URL parser reads as `//evil.com`.
    for (const next of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(next, ORIGIN), JSON.stringify(next)).toBe("/");
    }
  });
});
