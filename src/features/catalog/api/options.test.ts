import { describe, expect, it } from "vitest";

import { groupExclusions, offeredOn, type ItemOption } from "./options";

/**
 * The per-item half of a common question — migration 0096.
 *
 * Both of these fail *silently*, which is why they are tested rather than
 * clicked through. A mis-keyed bucket draws every choice as offered on a dish
 * that does not offer it, and a mis-resolved default opens a sheet on a choice
 * two of the dishes do not have. Neither throws, neither logs, and both look
 * identical to a shop that has simply set nothing.
 *
 * They are also the two places the dashboard and the storefront have to agree.
 * If these drift, the operator sees one menu and the customer orders from
 * another.
 */

/** "Choose a size" — the case the whole feature exists for. */
const SIZES: ItemOption[] = [
  {
    id: "small",
    name: { en: "Small" },
    price: 0,
    isActive: true,
    isDefault: false,
    sortOrder: 0,
  },
  {
    id: "medium",
    name: { en: "Medium" },
    price: 150,
    isActive: true,
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: "large",
    name: { en: "Large" },
    price: 300,
    isActive: true,
    isDefault: false,
    sortOrder: 2,
  },
];

const nothingExcluded: ReadonlySet<string> = new Set<string>();

describe("groupExclusions", () => {
  it("buckets by question, then by item", () => {
    const map = groupExclusions([
      { groupId: "size", itemId: "margherita", optionId: "large" },
      { groupId: "size", itemId: "calzone", optionId: "large" },
      { groupId: "bread", itemId: "calzone", optionId: "seeded" },
    ]);

    expect([...map.keys()].sort()).toEqual(["bread", "size"]);
    expect([...(map.get("size")?.keys() ?? [])].sort()).toEqual([
      "calzone",
      "margherita",
    ]);
    expect(map.get("bread")?.get("calzone")).toEqual(new Set(["seeded"]));
  });

  it("collects several choices excluded on the same item", () => {
    // The row that would be lost by overwriting the entry instead of adding to
    // it: a dish with neither Medium nor Large would silently get one back.
    const map = groupExclusions([
      { groupId: "size", itemId: "calzone", optionId: "medium" },
      { groupId: "size", itemId: "calzone", optionId: "large" },
    ]);

    expect(map.get("size")?.get("calzone")).toEqual(
      new Set(["medium", "large"]),
    );
  });

  it("leaves an item with nothing excluded out entirely", () => {
    // Absence is the representation, and it is load-bearing: the map is the
    // size of the exceptions, not the size of the menu.
    const map = groupExclusions([
      { groupId: "size", itemId: "calzone", optionId: "large" },
    ]);

    expect(map.get("size")?.has("margherita")).toBe(false);
    expect(map.get("bread")).toBeUndefined();
  });

  it("is empty for a shop that has excluded nothing", () => {
    expect(groupExclusions([]).size).toBe(0);
  });
});

describe("offeredOn", () => {
  it("returns every choice when nothing is excluded", () => {
    const shown = offeredOn(SIZES, nothingExcluded, null);
    expect(shown.map((choice) => choice.id)).toEqual([
      "small",
      "medium",
      "large",
    ]);
  });

  it("drops the choices this dish does not have", () => {
    const shown = offeredOn(SIZES, new Set(["large"]), null);
    expect(shown.map((choice) => choice.id)).toEqual(["small", "medium"]);
  });

  it("keeps the question's own default when the dish has not been pinned", () => {
    const shown = offeredOn(SIZES, new Set(["large"]), null);
    expect(shown.filter((choice) => choice.isDefault).map((c) => c.id)).toEqual([
      "medium",
    ]);
  });

  it("lets a dish open on its own answer instead", () => {
    const shown = offeredOn(SIZES, nothingExcluded, "small");
    expect(shown.filter((choice) => choice.isDefault).map((c) => c.id)).toEqual([
      "small",
    ]);
  });

  it("clears the question's default when the dish pins another", () => {
    // The bug this guards: resolving the pin by *adding* a default rather than
    // replacing one leaves two, and a single-choice sheet opens on whichever
    // the renderer reaches first.
    const shown = offeredOn(SIZES, nothingExcluded, "small");
    expect(shown.filter((choice) => choice.isDefault)).toHaveLength(1);
  });

  it("leaves no default at all when the pinned choice is gone", () => {
    // 0096's trigger clears a pin when the choice it names is excluded, so this
    // is a database edited by hand. It resolves to "no default", which the sheet
    // already copes with — an optional question opens on nothing every time.
    const shown = offeredOn(SIZES, new Set(["large"]), "large");
    expect(shown.some((choice) => choice.isDefault)).toBe(false);
  });

  it("does not alter the choices it was given", () => {
    // The result feeds a cache the question list also reads. Mutating in place
    // would let one dish's view of a common question rewrite every other's.
    offeredOn(SIZES, new Set(["large"]), "small");
    expect(SIZES.map((choice) => choice.isDefault)).toEqual([
      false,
      true,
      false,
    ]);
    expect(SIZES).toHaveLength(3);
  });
});
