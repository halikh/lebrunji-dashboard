import { describe, expect, it } from "vitest";

import {
  EXPIRY_MARGIN_SECONDS,
  REMEMBER_MAX_AGE,
  authCookieAttributes,
  clearedCookieAttributes,
  isExpiring,
} from "./cookies";

/**
 * Every failure mode here is silent, which is why they are pinned.
 *
 * A cookie that outlives the browser looks identical to one that does not until
 * somebody closes the window. A token treated as fresh when it is nearly dead
 * looks fine until a request happens to be slow. Neither shows up in a manual
 * click-through.
 */
describe("authCookieAttributes", () => {
  it("is always HttpOnly", () => {
    // The whole point of the split. If this ever comes back false, the refresh
    // token is readable by script again and the design is gone.
    expect(
      authCookieAttributes({ remember: true, isSecure: true }).httpOnly,
    ).toBe(true);
    expect(
      authCookieAttributes({ remember: false, isSecure: false }).httpOnly,
    ).toBe(true);
  });

  it("gives a lifetime when the box is ticked", () => {
    expect(
      authCookieAttributes({ remember: true, isSecure: true }).maxAge,
    ).toBe(REMEMBER_MAX_AGE);
  });

  it("omits the lifetime entirely when it is cleared", () => {
    // Not "a small maxAge": there is no value of maxAge that means "until the
    // window closes". Only the absence of one does.
    const attributes = authCookieAttributes({
      remember: false,
      isSecure: true,
    });
    expect(attributes).not.toHaveProperty("maxAge");
  });

  it("is lax, not strict", () => {
    // Strict would drop the cookie on a navigation *into* the dashboard from
    // another site — including the link in a password-reset email, which is
    // exactly a cross-site navigation that must arrive signed in.
    expect(
      authCookieAttributes({ remember: true, isSecure: true }).sameSite,
    ).toBe("lax");
  });

  it("is only Secure over https", () => {
    // A Secure cookie over http is not stored at all, which on localhost looks
    // like a login that silently does nothing.
    expect(
      authCookieAttributes({ remember: true, isSecure: false }).secure,
    ).toBe(false);
    expect(
      authCookieAttributes({ remember: true, isSecure: true }).secure,
    ).toBe(true);
  });
});

describe("clearedCookieAttributes", () => {
  it("deletes rather than empties", () => {
    // `maxAge: 0` is a deletion. An empty value with no maxAge is a cookie that
    // is still there, holding nothing, until the browser closes.
    expect(clearedCookieAttributes(true).maxAge).toBe(0);
    expect(clearedCookieAttributes(true).httpOnly).toBe(true);
  });
});

describe("isExpiring", () => {
  const now = 1_800_000_000_000; // a fixed Tuesday, in ms
  const nowSeconds = Math.floor(now / 1000);

  it("is false for a token with plenty of life left", () => {
    expect(isExpiring(nowSeconds + 3600, now)).toBe(false);
  });

  it("is true once inside the margin", () => {
    // The margin exists because a token valid for another two seconds is not
    // worth handing to a request that has to cross a network first.
    expect(isExpiring(nowSeconds + EXPIRY_MARGIN_SECONDS - 1, now)).toBe(true);
  });

  it("is false just outside the margin", () => {
    expect(isExpiring(nowSeconds + EXPIRY_MARGIN_SECONDS + 1, now)).toBe(false);
  });

  it("is true for a token that has already expired", () => {
    expect(isExpiring(nowSeconds - 1, now)).toBe(true);
  });

  it("treats an unknown expiry as expired", () => {
    // A token whose lifetime cannot be established must not be assumed good —
    // the cost of an unnecessary refresh is one request; the cost of the other
    // mistake is a failed query the operator sees.
    expect(isExpiring(null, now)).toBe(true);
    expect(isExpiring(undefined, now)).toBe(true);
  });
});
