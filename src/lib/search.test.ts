import { describe, expect, it } from "vitest";

import { likeAny, matchesLike, searchTerm } from "./search";

describe("matchesLike", () => {
  it("quotes the term, so a comma cannot end the condition", () => {
    // The bug this file exists for: unquoted, PostgREST reads everything after
    // the comma as a second condition naming no column, and refuses the lot.
    expect(matchesLike("name", "Ali, Beirut")).toBe(
      'name.ilike."%Ali, Beirut%"',
    );
  });

  it("survives parentheses, which would otherwise open a group", () => {
    expect(matchesLike("slug", "kibbeh (small)")).toBe(
      'slug.ilike."%kibbeh (small)%"',
    );
  });

  it("escapes the two characters quoting cannot hold on its own", () => {
    expect(matchesLike("name", 'a"b')).toBe('name.ilike."%a\\"b%"');
    expect(matchesLike("name", "a\\b")).toBe('name.ilike."%a\\\\b%"');
  });

  it("reaches inside a jsonb column", () => {
    expect(matchesLike("name->>ar", "كبة")).toBe('name->>ar.ilike."%كبة%"');
  });

  it("trims, so a trailing space is not part of the match", () => {
    expect(matchesLike("name", "  pizza  ")).toBe('name.ilike."%pizza%"');
  });
});

describe("likeAny", () => {
  it("joins the columns the way the or filter wants them", () => {
    expect(likeAny(["name->>en", "name->>ar"], "kibbeh")).toBe(
      'name->>en.ilike."%kibbeh%",name->>ar.ilike."%kibbeh%"',
    );
  });
});

describe("searchTerm", () => {
  it("is null below the minimum, so one letter is not a query", () => {
    expect(searchTerm("a")).toBeNull();
    expect(searchTerm(" ")).toBeNull();
    expect(searchTerm("")).toBeNull();
    expect(searchTerm(null)).toBeNull();
    expect(searchTerm(undefined)).toBeNull();
  });

  it("trims before measuring", () => {
    expect(searchTerm("  ab  ")).toBe("ab");
  });

  it("cuts an over-long term rather than refusing it", () => {
    // A paste, not an intention. An error would be a worse answer than a match.
    expect(searchTerm("x".repeat(200))).toHaveLength(64);
  });
});
