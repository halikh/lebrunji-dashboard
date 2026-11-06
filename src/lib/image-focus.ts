/**
 * Where a photograph's subject is, carried on its address.
 *
 * ## Why
 *
 * The app draws one shop or dish photograph in frames of every shape — a
 * 2.4:1 card on Home, a square in the basket, a wide cover on its own page —
 * and crops it to fit each one. Around the middle, a dish that was not in the
 * middle loses its best half. So the framing step asks where the subject is,
 * and the app crops around that point instead.
 *
 * ## On the address, as a fragment
 *
 *     https://img.lebrunji.com/menu-items/<uuid>.jpg#focus=0.50,0.30
 *
 * `x,y` from the top left, each 0–1. A fragment is never sent to a server, so
 * the picture is fetched — and resized by Cloudflare — exactly as before, and
 * every reader between this column and the phone passes it on unchanged. The
 * database's `image_key` reads the key up to the `#` (migration 0255), so the
 * Unused pictures sweep still counts the picture as in use.
 *
 * The app reads the same shape (`src/lib/image-url.ts` there). Change one and
 * change the other.
 *
 * ## How a point becomes a crop
 *
 * As CSS `object-position` does it — the point `x`% across sits `x`% across
 * the frame — which is also what the app's image view does on both phones.
 * {@link objectPosition} is that rule for the previews here.
 */

export type Focus = { x: number; y: number };

/** The middle — what a picture with no focus is cropped around. */
export const CENTRE: Focus = { x: 0.5, y: 0.5 };

const FOCUS = /#focus=([01](?:\.\d+)?),([01](?:\.\d+)?)$/;

/** Where the subject is, or null if the address does not say. */
export function readFocus(url: string | null | undefined): Focus | null {
  if (!url) return null;
  const match = FOCUS.exec(url);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
  return { x, y };
}

/** The address without its fragment — the file itself. */
export function withoutFragment(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * The address with `focus` on it. The middle is said by saying nothing, so a
 * picture nobody reframed keeps the address it always had.
 */
export function withFocus(url: string, focus: Focus | null): string {
  const bare = withoutFragment(url);
  if (!focus) return bare;
  const x = clamp(focus.x);
  const y = clamp(focus.y);
  if (x === "0.50" && y === "0.50") return bare;
  return `${bare}#focus=${x},${y}`;
}

/** The CSS `object-position` the app's crop matches. */
export function objectPosition(focus: Focus | null): string {
  const { x, y } = focus ?? CENTRE;
  return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
}

function clamp(value: number): string {
  const safe = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
  return safe.toFixed(2);
}
