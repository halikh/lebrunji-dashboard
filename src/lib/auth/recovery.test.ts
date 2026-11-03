import { describe, expect, it } from "vitest";

import { RECOVERY_WINDOW_SECONDS, isFreshRecovery, recoveredAt } from "./recovery";

/**
 * Getting this wrong fails quietly. A refusal that is too strict breaks
 * password reset. One that is too loose lets any signed-in session set a new
 * password, and nothing on screen would show it.
 */
function token(claims: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(claims))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `e30.${body}.sig`;
}

const NOW = 1_800_000_000_000;
const nowSeconds = NOW / 1000;

describe("recoveredAt", () => {
  it("reads the recovery entry", () => {
    expect(
      recoveredAt(
        token({ amr: [{ method: "recovery", timestamp: nowSeconds - 30 }] }),
      ),
    ).toBe(nowSeconds - 30);
  });

  it("is null for a password sign-in", () => {
    expect(
      recoveredAt(token({ amr: [{ method: "password", timestamp: nowSeconds }] })),
    ).toBeNull();
  });

  it("is null without an amr claim, or for a token that is not one", () => {
    expect(recoveredAt(token({ sub: "x" }))).toBeNull();
    expect(recoveredAt("not-a-jwt")).toBeNull();
  });
});

describe("isFreshRecovery", () => {
  const at = (age: number) =>
    token({ amr: [{ method: "recovery", timestamp: nowSeconds - age }] });

  it("accepts a link followed moments ago", () => {
    expect(isFreshRecovery(at(10), NOW)).toBe(true);
    expect(isFreshRecovery(at(RECOVERY_WINDOW_SECONDS), NOW)).toBe(true);
  });

  it("refuses one followed longer ago than the window", () => {
    expect(isFreshRecovery(at(RECOVERY_WINDOW_SECONDS + 1), NOW)).toBe(false);
  });

  it("refuses a session that was never recovered", () => {
    expect(
      isFreshRecovery(
        token({ amr: [{ method: "password", timestamp: nowSeconds }] }),
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses a timestamp well in the future", () => {
    expect(isFreshRecovery(at(-3600), NOW)).toBe(false);
  });
});
