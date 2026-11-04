import { describe, expect, it } from "vitest";

import { toMajor, toMinor } from "./minor-units";

/**
 * What `MoneyInput` stores for what an operator types (QA-058).
 *
 * The field writes straight to prices and the delivery ladder. A slip here is
 * a factor of a hundred on every charge — `3` banked as `0.03`, `50000` banked
 * as five million — and looks entirely plausible on the screen.
 */

describe("toMinor", () => {
  it("reads dollars as cents and lira as lira", () => {
    expect(toMinor("1.50", 2)).toBe(150);
    expect(toMinor("3", 2)).toBe(300);
    expect(toMinor("50000", 0)).toBe(50000);
  });

  it("reads a half-typed figure as what is there so far", () => {
    expect(toMinor("1.", 2)).toBe(100);
    expect(toMinor(".5", 2)).toBe(50);
  });

  it("never loses a cent to float error", () => {
    // 4.35 × 100 is 434.99999999999994 in binary floating point.
    expect(toMinor("4.35", 2)).toBe(435);
    expect(toMinor("1.15", 2)).toBe(115);
    expect(toMinor("0.29", 2)).toBe(29);
  });

  it("is null for an empty field, blanks included", () => {
    expect(toMinor("", 2)).toBeNull();
    expect(toMinor("   ", 0)).toBeNull();
  });

  it("is undefined for what does not read as a number, so nothing is written", () => {
    expect(toMinor("abc", 2)).toBeUndefined();
    expect(toMinor("1.2.3", 2)).toBeUndefined();
    expect(toMinor("Infinity", 2)).toBeUndefined();
  });

  it("refuses a figure below the minimum, so a negative price is never written", () => {
    expect(toMinor("-5", 2)).toBeUndefined();
    expect(toMinor("-0.01", 2)).toBeUndefined();
    expect(toMinor("-1", 0)).toBeUndefined();
    expect(toMinor("0", 2)).toBe(0);
  });

  it("holds a minimum other than zero, in the field's own units", () => {
    expect(toMinor("0.99", 2, 1)).toBeUndefined();
    expect(toMinor("1", 2, 1)).toBe(100);
  });

  it("rounds a fraction of a lira to a whole one", () => {
    expect(toMinor("1500.6", 0)).toBe(1501);
  });

  it("reads back every amount it renders, cent for cent", () => {
    for (let cents = 0; cents <= 100_000; cents++) {
      if (toMinor(toMajor(cents, 2), 2) !== cents) {
        expect.unreachable(
          `${cents} came back as ${toMinor(toMajor(cents, 2), 2)}`,
        );
      }
    }
  });
});

describe("toMajor", () => {
  it("writes cents with both decimals", () => {
    expect(toMajor(150, 2)).toBe("1.50");
    expect(toMajor(5, 2)).toBe("0.05");
    expect(toMajor(0, 2)).toBe("0.00");
  });

  it("writes lira whole", () => {
    expect(toMajor(350_000, 0)).toBe("350000");
  });

  it("is empty for no amount", () => {
    expect(toMajor(null, 2)).toBe("");
  });

  it("is empty while the currency's scale is unknown, rather than guessing", () => {
    expect(toMajor(150, null)).toBe("");
  });
});
