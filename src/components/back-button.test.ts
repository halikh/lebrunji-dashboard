import { describe, expect, it } from "vitest";

import { parentOf } from "./back-button";

describe("parentOf, where Back goes with no history", () => {
  it("goes from a dish or a branch to its tab on the shop", () => {
    expect(parentOf("/shops/s1/items/i1")).toBe("/shops/s1?tab=menu");
    expect(parentOf("/shops/s1/items/new")).toBe("/shops/s1?tab=menu");
    expect(parentOf("/shops/s1/branches/b1")).toBe("/shops/s1?tab=branches");
  });

  it("goes from a record to its list", () => {
    expect(parentOf("/shops/s1")).toBe("/shops");
    expect(parentOf("/drivers/d1/edit")).toBe("/drivers/d1");
    expect(parentOf("/orders/o1")).toBe("/orders");
  });

  it("goes from help and legal pages to Settings", () => {
    expect(parentOf("/settings/help/h1")).toBe("/settings");
    expect(parentOf("/settings/legal/new")).toBe("/settings");
  });

  it("goes from a top-level page home, and nowhere from home", () => {
    expect(parentOf("/todo")).toBe("/orders");
    expect(parentOf("/orders")).toBeNull();
    expect(parentOf("/")).toBeNull();
  });
});
