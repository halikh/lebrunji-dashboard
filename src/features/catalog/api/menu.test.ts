import { describe, expect, it } from "vitest";

import {
  applyOrder,
  applySectionOrder,
  canHoldProducts,
  menuTree,
  sectionPath,
  type MenuSection,
} from "./menu";

/**
 * Reordering is exactly the shape of thing this project tests: it fails
 * *silently*.
 *
 * A reorder that writes too few rows looks correct on screen — the list is
 * showing the optimistic order — and is wrong only after a reload, by which
 * point nobody connects the two. Clicking through the app does not catch it.
 * These do.
 */

type Row = { id: string; sortOrder: number; name: string };

const rows: Row[] = [
  { id: "a", sortOrder: 0, name: "Starters" },
  { id: "b", sortOrder: 1, name: "Mains" },
  { id: "c", sortOrder: 2, name: "Sides" },
  { id: "d", sortOrder: 3, name: "Drinks" },
];

describe("applyOrder", () => {
  it("puts the rows in the order the ids give", () => {
    const { next } = applyOrder(rows, ["c", "a", "d", "b"]);
    expect(next.map((row) => row.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("numbers positions from zero, leaving no gaps", () => {
    const { next } = applyOrder(rows, ["d", "c", "b", "a"]);
    expect(next.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("writes nothing when the order did not change", () => {
    // The case that matters for cost: a drag that ends where it started, or a
    // keyboard pick-up-and-drop with no arrows between, must not be four
    // requests that change nothing.
    const { updates } = applyOrder(rows, ["a", "b", "c", "d"]);
    expect(updates).toEqual([]);
  });

  it("writes only the rows that actually moved", () => {
    // Moving the last row to the front shifts all four: `d` to 0 and the other
    // three down one. Nothing is exempt just because it was not dragged.
    const { updates } = applyOrder(rows, ["d", "a", "b", "c"]);
    expect(updates).toEqual([
      { id: "d", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  it("leaves the rows below an untouched swap alone", () => {
    // Swapping the first two changes two positions. The other two keep theirs,
    // and writing them would be two requests to store the values already there.
    const { updates } = applyOrder(rows, ["b", "a", "c", "d"]);
    expect(updates).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("normalises positions that were never contiguous", () => {
    // Seeded data numbers sections 1, 2, 3 rather than from zero, and an
    // archived row leaves a hole. Every row is renumbered, so the first drag on
    // an untouched menu tidies it rather than preserving the gaps.
    const sparse: Row[] = [
      { id: "a", sortOrder: 10, name: "Starters" },
      { id: "b", sortOrder: 20, name: "Mains" },
    ];
    const { updates } = applyOrder(sparse, ["a", "b"]);
    expect(updates).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
    ]);
  });

  it("carries the rest of each row through", () => {
    // The result is fed straight to the optimistic update, so a row that lost
    // its name on the way would blank the list until the refetch landed.
    const { next } = applyOrder(rows, ["b", "a", "c", "d"]);
    expect(next[0]).toEqual({ id: "b", sortOrder: 0, name: "Mains" });
  });

  it("skips an id that names no row", () => {
    // The list moved under the drag — another tab archived a section. The
    // refetch that follows settles it; throwing here would turn a stale preview
    // into an error dialog over a list that is about to be correct anyway.
    const { next, updates } = applyOrder(rows, ["a", "gone", "b", "c", "d"]);
    expect(next.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
    expect(updates).toEqual([]);
  });

  it("drops a row the ids leave out", () => {
    // Same situation from the other side: a row arrived that the drag never
    // knew about. It is absent from the optimistic list for the moment before
    // the refetch, rather than being written to a position nobody chose.
    const { next } = applyOrder(rows, ["a", "b", "c"]);
    expect(next.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

/**
 * Sub-aisles (0196). The tree is drawn from a flat list, and the ways it goes
 * wrong are quiet too: a sub-aisle drawn as an aisle, a reorder of the aisles
 * that drops every sub-aisle off the screen, a picker offering a section the
 * database will refuse.
 */
function section(
  id: string,
  sortOrder: number,
  parentId: string | null = null,
  title = id,
): MenuSection {
  return {
    id,
    slug: id,
    title: { en: title },
    imageUrl: null,
    parentId,
    sortOrder,
    items: [],
  };
}

const flat = [
  section("milk", 1, "dairy", "Milk"),
  section("bakery", 1),
  section("dairy", 0, null, "Dairy"),
  section("cheese", 0, "dairy", "Cheese"),
];

describe("menuTree", () => {
  it("puts sub-aisles under their aisle, each level in its own order", () => {
    const tree = menuTree(flat);
    expect(tree.map((aisle) => aisle.id)).toEqual(["dairy", "bakery"]);
    expect(tree[0].subAisles.map((sub) => sub.id)).toEqual(["cheese", "milk"]);
    expect(tree[1].subAisles).toEqual([]);
  });

  it("draws a sub-aisle whose aisle is missing as an aisle, not nowhere", () => {
    const tree = menuTree([section("orphan", 0, "gone")]);
    expect(tree.map((aisle) => aisle.id)).toEqual(["orphan"]);
  });
});

describe("canHoldProducts", () => {
  it("refuses a section that has sub-aisles, on any layout", () => {
    expect(canHoldProducts(flat[2], flat, "list")).toBe(false);
    expect(canHoldProducts(flat[2], flat, "aisles")).toBe(false);
  });

  it("refuses a bare aisle on an aisles shop, and allows it on a list one", () => {
    expect(canHoldProducts(flat[1], flat, "aisles")).toBe(false);
    expect(canHoldProducts(flat[1], flat, "list")).toBe(true);
  });

  it("allows a sub-aisle", () => {
    expect(canHoldProducts(flat[0], flat, "aisles")).toBe(true);
  });
});

describe("applySectionOrder", () => {
  it("reorders one level and carries the rest of the menu through", () => {
    const { next, updates } = applySectionOrder(flat, ["bakery", "dairy"]);
    // Every section still there — the sub-aisles were not part of the drag.
    expect(next.map((one) => one.id).sort()).toEqual(
      ["bakery", "cheese", "dairy", "milk"].sort(),
    );
    expect(updates).toEqual([
      { id: "bakery", sortOrder: 0 },
      { id: "dairy", sortOrder: 1 },
    ]);
  });
});

describe("sectionPath", () => {
  it("names a sub-aisle with its aisle in front", () => {
    expect(sectionPath(flat[0], flat)).toEqual({ en: "Dairy › Milk" });
  });

  it("leaves an aisle's name as it is", () => {
    expect(sectionPath(flat[2], flat)).toEqual({ en: "Dairy" });
  });
});
