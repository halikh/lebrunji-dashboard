import { describe, expect, it } from "vitest";

import { applyOrder } from "./menu";

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
