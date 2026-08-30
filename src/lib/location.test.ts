import { describe, expect, it } from "vitest";

import { parseLocation } from "./location";

/**
 * This is squarely in the category this project tests: a wrong answer here
 * looks completely right.
 *
 * A pin extracted from the wrong part of a URL still draws a map with a marker
 * on it, in roughly the right neighbourhood. Nothing on the screen is wrong.
 * What is wrong is every delivery quote from that shop afterwards.
 */

const pin = (result: ReturnType<typeof parseLocation>) =>
  result.ok ? [result.latitude, result.longitude] : null;

const why = (result: ReturnType<typeof parseLocation>) =>
  result.ok ? null : result.reason;

describe("parseLocation", () => {
  it("reads what right-clicking a point in Maps copies", () => {
    expect(pin(parseLocation("33.8938, 35.5018"))).toEqual([33.8938, 35.5018]);
  });

  it("does not mind the separator or a stray bracket", () => {
    expect(pin(parseLocation("(33.8938; 35.5018)"))).toEqual([
      33.8938, 35.5018,
    ]);
    expect(pin(parseLocation("  33.8938   35.5018  "))).toEqual([
      33.8938, 35.5018,
    ]);
  });

  it("prefers the place over the viewport centre", () => {
    // The one that matters. `@` is where the map was looking when the link was
    // made; `!3d`/`!4d` is where the place is. Pan before copying and they are
    // a street apart — which is a real delivery charge, on every order, with
    // nothing on screen to say so.
    const url =
      "https://www.google.com/maps/place/Nara+Kitchen/@33.8000,35.4000,17z/data=!4m6!3m5!1s0x0!8m2!3d33.8938!4d35.5018";
    expect(pin(parseLocation(url))).toEqual([33.8938, 35.5018]);
  });

  it("reads the place even if the two markers are not adjacent", () => {
    // `!3d` is the latitude and `!4d` the longitude wherever they appear in the
    // blob. Requiring them side by side would have this fall through to the
    // viewport centre — the wrong point, and one that looks right.
    const url =
      "https://www.google.com/maps/place/X/@33.8,35.4,17z/data=!4d35.5018!1sabc!3d33.8938";
    expect(pin(parseLocation(url))).toEqual([33.8938, 35.5018]);
  });

  it("falls back to the viewport centre when there is no place", () => {
    const url = "https://www.google.com/maps/@33.8938,35.5018,17z";
    expect(pin(parseLocation(url))).toEqual([33.8938, 35.5018]);
  });

  it("reads a query link", () => {
    expect(
      pin(parseLocation("https://maps.google.com/?q=33.8938,35.5018")),
    ).toEqual([33.8938, 35.5018]);
    expect(
      pin(parseLocation("https://www.google.com/maps?q=loc:33.8938,35.5018")),
    ).toEqual([33.8938, 35.5018]);
  });

  it("reads a query link whose comma was escaped", () => {
    // Which is what a copied address bar often gives.
    expect(
      pin(parseLocation("https://maps.google.com/?q=33.8938%2C35.5018")),
    ).toEqual([33.8938, 35.5018]);
  });

  it("says a shortened link is shortened, rather than failing vaguely", () => {
    // It carries no coordinates at all — they are on Google's server, behind a
    // redirect a browser cannot follow to another origin. Naming it is the
    // difference between one extra step and a form that seems broken.
    expect(why(parseLocation("https://maps.app.goo.gl/aBcDeF12345"))).toBe(
      "shortened",
    );
    expect(why(parseLocation("https://goo.gl/maps/aBcDeF12345"))).toBe(
      "shortened",
    );
  });

  it("refuses an impossible coordinate rather than clamping it", () => {
    // 91 is a typo or a misread link. Snapping it to 90 would store a point in
    // the Arctic and report success.
    expect(why(parseLocation("91, 35.5018"))).toBe("unrecognised");
    expect(why(parseLocation("33.8938, 200"))).toBe("unrecognised");
  });

  it("refuses text that is not a location", () => {
    expect(why(parseLocation("Hamra Street, Beirut"))).toBe("unrecognised");
    expect(why(parseLocation("33.8938"))).toBe("unrecognised");
  });

  it("distinguishes empty from wrong", () => {
    // Empty is a legitimate state — a shop can be saved without a pin, with a
    // warning — and reporting it as invalid would refuse a save that is fine.
    expect(why(parseLocation("   "))).toBe("empty");
  });
});
