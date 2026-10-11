import { describe, expect, it } from "vitest";

import {
  isMissingColumn,
  isValidAppVersion,
  isValidStoreUrl,
} from "./app-settings";

describe("isValidAppVersion", () => {
  it("takes empty as no minimum", () => {
    expect(isValidAppVersion("")).toBe(true);
    expect(isValidAppVersion("  ")).toBe(true);
  });

  it("matches the database check: one to three numeric parts", () => {
    for (const ok of ["1", "1.4", "1.4.0", "10.20.30", " 2.0.1 "]) {
      expect(isValidAppVersion(ok)).toBe(true);
    }
    for (const bad of [
      "v1.4.0",
      "1.4.0.1",
      "1..4",
      "1.4.",
      ".1",
      "1.4.0-beta",
    ]) {
      expect(isValidAppVersion(bad)).toBe(false);
    }
  });
});

describe("isValidStoreUrl", () => {
  it("takes empty as no link", () => {
    expect(isValidStoreUrl("")).toBe(true);
  });

  it("takes https only", () => {
    expect(isValidStoreUrl("https://apps.apple.com/app/id123")).toBe(true);
    expect(isValidStoreUrl("http://apps.apple.com/app/id123")).toBe(false);
    expect(isValidStoreUrl("apps.apple.com/app/id123")).toBe(false);
    expect(isValidStoreUrl("https://")).toBe(false);
  });
});

describe("isMissingColumn", () => {
  it("recognises the code and the message", () => {
    expect(isMissingColumn({ code: "42703", message: "" })).toBe(true);
    expect(
      isMissingColumn({
        message: "column app_settings.ios_store_url does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingColumn({ code: "42501", message: "permission denied" }),
    ).toBe(false);
  });
});
