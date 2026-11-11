import { describe, expect, it } from "vitest";

import { priceStepRefusal } from "./price-step";

/**
 * The database refuses a lira price off the 250 step with `PSTEP` and a
 * `currency,step,price` detail (app `0286`). The operator is told the two
 * prices either side rather than left to do the sum.
 */
describe("priceStepRefusal", () => {
  it("offers the steps either side of a refused price", () => {
    expect(priceStepRefusal({ code: "PSTEP", details: "LBP,250,62400" })).toBe(
      "LBP prices go in steps of 250. Use 62,250 or 62,500.",
    );
    expect(priceStepRefusal({ code: "PSTEP", details: "LBP,250,400" })).toBe(
      "LBP prices go in steps of 250. Use 250 or 500.",
    );
  });

  it("still says what is wrong when the detail is missing", () => {
    expect(priceStepRefusal({ code: "PSTEP", details: null })).toMatch(
      /steps of 250/,
    );
  });

  it("leaves every other error to the caller", () => {
    expect(priceStepRefusal({ code: "NOCHO", details: null })).toBeNull();
    expect(priceStepRefusal(null)).toBeNull();
    expect(priceStepRefusal(undefined)).toBeNull();
  });
});
