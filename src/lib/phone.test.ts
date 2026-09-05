import { describe, expect, it } from "vitest";

import {
  CALLING_CODE,
  digitsOf,
  formatPhone,
  internationalFrom,
  nationalPart,
} from "./phone";

/**
 * The other category this project tests: a wrong answer here rings somebody.
 *
 * Every failure below produces a number that looks like a number. It passes the
 * CHECK constraint, it saves without complaint, it renders on the driver's card
 * — and the order goes to a stranger, or to nobody, and the first anyone hears
 * of it is a shop asking where their tickets went.
 */

describe("digitsOf", () => {
  it("keeps only digits", () => {
    expect(digitsOf("+961 70 123 456")).toBe("96170123456");
    expect(digitsOf("(961) 70-123-456")).toBe("96170123456");
  });

  it("drops the 00 that means +", () => {
    // The difference between a number WhatsApp reads as an unknown country and
    // one that rings.
    expect(digitsOf("0096170123456")).toBe("96170123456");
  });

  it("leaves a national leading zero alone, which is not a 00 prefix", () => {
    expect(digitsOf("03123456")).toBe("03123456");
  });
});

describe("nationalPart", () => {
  it("takes the country code off a stored number", () => {
    expect(nationalPart("96170123456")).toBe("70123456");
  });

  it("is empty for nothing", () => {
    expect(nationalPart("")).toBe("");
    expect(nationalPart(null)).toBe("");
    expect(nationalPart(undefined)).toBe("");
  });

  it("leaves a number that is not Lebanese whole", () => {
    // The one that matters. Stripping three digits regardless would turn a
    // French number into a shorter French number and then save it as a Lebanese
    // one — a corruption indistinguishable from a successful edit. Returned
    // whole, it is visibly too long in a field captioned +961.
    expect(nationalPart("33612345678")).toBe("33612345678");
  });
});

describe("internationalFrom", () => {
  it("joins the code onto what was typed", () => {
    expect(internationalFrom("70123456")).toBe("96170123456");
  });

  it("drops the trunk prefix somebody copied off a shopfront", () => {
    // `03 123 456` is how a Lebanese number is written locally, and the leading
    // zero is not part of the international form. Keeping it would produce
    // 96103123456 — a different number, and not one that exists.
    expect(internationalFrom("03123456")).toBe("9613123456");
  });

  it("stays empty rather than becoming a bare country code", () => {
    // `961` on its own is eleven characters short of a phone number and would
    // sail through a length check.
    expect(internationalFrom("")).toBe("");
    expect(internationalFrom("   ")).toBe("");
    expect(internationalFrom("0")).toBe("");
  });

  it("survives a full number being pasted into the national box", () => {
    // `PhoneInput` strips the code before calling this, so the pair round-trips
    // rather than stacking a second 961 onto the first.
    expect(internationalFrom(nationalPart("96170123456"))).toBe("96170123456");
  });
});

describe("formatPhone", () => {
  it("adds the + that storage does not keep", () => {
    expect(formatPhone("96170123456")).toBe("+96170123456");
  });

  it("is idempotent, so it can be applied without checking first", () => {
    expect(formatPhone("+96170123456")).toBe("+96170123456");
  });

  it("has nothing to say about nothing", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone("  ")).toBe("");
  });
});

describe("the round trip a form actually performs", () => {
  it("returns the stored value unchanged when nothing is typed", () => {
    // Mounting a form must not rewrite the row it is showing. If this fails,
    // opening a shop and pressing Save changes its number.
    const stored = `${CALLING_CODE}70123456`;
    expect(internationalFrom(nationalPart(stored))).toBe(stored);
  });
});
