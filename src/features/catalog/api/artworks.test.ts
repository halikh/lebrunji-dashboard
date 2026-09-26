import { describe, expect, it } from "vitest";

import {
  artworkState,
  friendly,
  knownPlacements,
  nextSortOrder,
  orderPlacements,
  reorderUpdates,
  toArtwork,
  toColumns,
  togglePlacement,
  type Artwork,
} from "./artworks";

/**
 * The artwork screen's pure half — migration 0129.
 *
 * Each of these fails quietly: a placement written in press order makes two
 * identical choices look like a change, a dropped `null` makes "unlink this
 * picture" a save that does nothing, and a sort order shared across formats
 * puts a new tile somewhere in the middle of the banners' numbering.
 */

function artwork(overrides: Partial<Artwork> = {}): Artwork {
  return {
    id: "a",
    format: "banner",
    imageUrl: { en: "https://x/en.png" },
    placements: ["home"],
    discount: null,
    isActive: true,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe("placements", () => {
  it("keeps the declared order whatever order they were pressed in", () => {
    expect(orderPlacements(["cart", "home"])).toEqual(["home", "cart"]);
    expect(togglePlacement(["cart"], "home")).toEqual(["home", "cart"]);
  });

  it("turns one off without touching the rest", () => {
    expect(togglePlacement(["home", "store", "cart"], "store")).toEqual([
      "home",
      "cart",
    ]);
  });

  it("allows none at all — a draft", () => {
    expect(togglePlacement(["home"], "home")).toEqual([]);
  });

  it("drops screens this build does not know, and duplicates", () => {
    expect(knownPlacements(["cart", "checkout", "home", "cart"])).toEqual([
      "home",
      "cart",
    ]);
    expect(knownPlacements(null)).toEqual([]);
  });
});

describe("toColumns", () => {
  it("writes null — unlinking is a real change", () => {
    expect(toColumns({ discountId: null, startsAt: null })).toEqual({
      discount_id: null,
      starts_at: null,
    });
  });

  it("writes nothing for keys that are absent", () => {
    expect(toColumns({})).toEqual({});
  });

  it("maps a whole draft", () => {
    expect(
      toColumns({
        format: "tile",
        imageUrl: { en: "e", ar: "a" },
        placements: ["cart", "store"],
        discountId: "d1",
        isActive: false,
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2026-02-01T00:00:00Z",
        sortOrder: 3,
      }),
    ).toEqual({
      format: "tile",
      image_url: { en: "e", ar: "a" },
      placements: ["store", "cart"],
      discount_id: "d1",
      is_active: false,
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-02-01T00:00:00Z",
      sort_order: 3,
    });
  });
});

describe("toArtwork", () => {
  it("reads the linked promotion, embedded as an object or an array", () => {
    const base = {
      id: "a",
      format: "tile",
      image_url: { en: "e" },
      placements: ["home"],
      is_active: true,
      starts_at: null,
      ends_at: null,
      sort_order: 2,
    };
    expect(
      toArtwork({
        ...base,
        discount: { id: "d", slug: "eid", deleted_at: null },
      }).discount,
    ).toEqual({ id: "d", slug: "eid", archived: false });
    expect(
      toArtwork({
        ...base,
        discount: [{ id: "d", slug: "eid", deleted_at: "2026-01-01" }],
      }).discount,
    ).toEqual({ id: "d", slug: "eid", archived: true });
    expect(toArtwork({ ...base, discount: null }).discount).toBeNull();
    expect(toArtwork({ ...base, discount: null }).format).toBe("tile");
  });
});

describe("nextSortOrder", () => {
  it("goes last within its own format only", () => {
    const rows = [
      artwork({ id: "b1", format: "banner", sortOrder: 7 }),
      artwork({ id: "t1", format: "tile", sortOrder: 1 }),
    ];
    expect(nextSortOrder(rows, "tile")).toBe(2);
    expect(nextSortOrder(rows, "banner")).toBe(8);
    expect(nextSortOrder([], "tile")).toBe(0);
  });
});

describe("reorderUpdates", () => {
  it("renumbers from zero and writes only what moved", () => {
    const rows = [
      artwork({ id: "a", sortOrder: 0 }),
      artwork({ id: "b", sortOrder: 1 }),
      artwork({ id: "c", sortOrder: 2 }),
    ];
    const { next, updates } = reorderUpdates(rows, ["b", "a", "c"]);
    expect(next.map((row) => [row.id, row.sortOrder])).toEqual([
      ["b", 0],
      ["a", 1],
      ["c", 2],
    ]);
    expect(updates).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });
});

describe("artworkState", () => {
  const now = Date.parse("2026-06-15T12:00:00Z");

  it("names each way a picture can be on and still not shown", () => {
    expect(artworkState(artwork({ isActive: false }), now)).toBe("off");
    expect(
      artworkState(
        artwork({ discount: { id: "d", slug: "s", archived: true } }),
        now,
      ),
    ).toBe("promotionArchived");
    expect(artworkState(artwork({ endsAt: "2026-06-01T00:00:00Z" }), now)).toBe(
      "ended",
    );
    expect(
      artworkState(artwork({ startsAt: "2026-07-01T00:00:00Z" }), now),
    ).toBe("scheduled");
    expect(artworkState(artwork(), now)).toBe("live");
  });
});

describe("friendly", () => {
  it("turns a constraint name into a sentence", () => {
    expect(
      friendly('violates check constraint "artworks_window_ordered"'),
    ).not.toContain("artworks_");
    expect(friendly("something else")).toBe("something else");
  });
});
