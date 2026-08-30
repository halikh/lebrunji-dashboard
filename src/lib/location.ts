/**
 * Getting a pin out of whatever somebody pasted.
 *
 * Nobody knows a shop's latitude. What they have is a Google Maps link — sent
 * by the merchant over WhatsApp, or copied from the address bar — and asking
 * them to convert it by hand is asking them to do arithmetic to fill in a form.
 *
 * So this accepts the shapes that actually arrive.
 *
 * ## The trap: a Maps URL holds *two* different points
 *
 * A place link looks like this:
 *
 *     .../maps/place/Nara+Kitchen/@33.8938,35.5018,17z/data=!3m1!4b1!4d35.5021!3d33.8942
 *
 * The `@` part is **where the map was looking** — the centre of the viewport
 * when the link was made. The `!3d`/`!4d` part is **where the place actually
 * is**. They are usually close and occasionally not: pan the map before
 * copying, and the `@` can be a street away, or a different building.
 *
 * A street is not nothing here. The pin feeds `delivery_quote`, so a wrong one
 * charges every customer for a distance that was never travelled, and it looks
 * completely fine on the screen — a map with a pin on it, in roughly the right
 * neighbourhood. So `!3d`/`!4d` wins whenever it is present, and the viewport
 * centre is only the fallback.
 *
 * ## What it deliberately cannot do
 *
 * A shortened link — `maps.app.goo.gl/xyz` — carries no coordinates at all.
 * They are on Google's server, and finding them means following a redirect,
 * which a browser cannot do to another origin. Guessing is not an option and
 * failing silently is worse, so it is recognised and named: the operator opens
 * it once and pastes what it becomes. That is one step, and it is honest.
 */

export type Located =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "empty" | "shortened" | "unrecognised" };

export function parseLocation(text: string): Located {
  const input = text.trim();
  if (input === "") return { ok: false, reason: "empty" };

  // Before anything else, because these look like perfectly good links and
  // contain nothing at all.
  if (/(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input)) {
    return { ok: false, reason: "shortened" };
  }

  for (const candidate of [
    // The place itself, out of the `data=` blob. First, deliberately.
    //
    // `!3d` and `!4d` are looked up independently rather than as one adjacent
    // pair: they are tagged values in a serialised structure, `!3d` always the
    // latitude and `!4d` always the longitude, and nothing guarantees they stay
    // next to each other or in that order as Google's format shifts. Requiring
    // adjacency would silently fall through to the viewport centre — which is
    // the wrong point, and looks right.
    place(input),
    // `?q=33.89,35.50`, `?q=loc:33.89,35.50`, `?ll=`, `?daddr=`, `?destination=`
    match(
      input,
      /[?&](?:q|ll|daddr|destination|center)=(?:loc:)?(-?\d+(?:\.\d+)?)%2C\s*(-?\d+(?:\.\d+)?)/i,
    ),
    match(
      input,
      /[?&](?:q|ll|daddr|destination|center)=(?:loc:)?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    ),
    // The viewport centre. Last resort, and only when the place is absent.
    match(input, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/),
    // A bare pair, which is what right-clicking a point in Maps copies.
    bare(input),
  ]) {
    if (candidate) return candidate;
  }

  return { ok: false, reason: "unrecognised" };
}

function place(input: string): Located | null {
  const latitude = /!3d(-?\d+(?:\.\d+)?)/.exec(input);
  const longitude = /!4d(-?\d+(?:\.\d+)?)/.exec(input);
  if (!latitude || !longitude) return null;
  return check(Number(latitude[1]), Number(longitude[1]));
}

function match(input: string, pattern: RegExp): Located | null {
  const found = pattern.exec(input);
  if (!found) return null;
  return check(Number(found[1]), Number(found[2]));
}

/**
 * `33.8938, 35.5018` and its near relations.
 *
 * Forgiving about what separates and surrounds the numbers — a comma, a
 * semicolon, a space, a stray bracket from a paste — and refuses anything with
 * more than two parts, so a URL that reached here by mistake is rejected rather
 * than half-read.
 */
function bare(input: string): Located | null {
  const parts = input
    .replace(/[()[\]]/g, "")
    .split(/[,;\s]+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  return check(Number(parts[0]), Number(parts[1]));
}

/**
 * Refused rather than clamped.
 *
 * A latitude of 91 is a typo or a misread link. Snapping it to 90 would store a
 * point in the Arctic and report success, and the operator would find out from
 * a delivery quote rather than from this form.
 */
function check(latitude: number, longitude: number): Located | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { ok: true, latitude, longitude };
}
