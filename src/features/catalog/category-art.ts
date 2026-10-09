/**
 * How the app dresses a category card — a transcription of the app's
 * `src/theme/category-art.ts`, so the editor can show what a customer will see.
 *
 * The app draws every category card itself: a pastel gradient and one of six
 * abstract backgrounds, both picked from the category's id. `categories.tint`
 * and `categories.art_preset` (`0164`) override either pick; null means "let
 * the id choose".
 *
 * **This has to stay in step with the app.** The preset order is the contract
 * with `art_preset`, and the hash and hue list decide what "Automatic" looks
 * like — change them there, change them here.
 */

/** How many backgrounds there are. `categories_art_preset_range` allows 0–5. */
export const CATEGORY_PRESET_COUNT = 6;

/** The backgrounds, in `art_preset` order. A new one goes on the end. */
export const CATEGORY_PRESETS = [
  "orbs",
  "wave",
  "halo",
  "blob",
  "arc",
  "petals",
] as const;
export type CategoryPreset = (typeof CATEGORY_PRESETS)[number];

/** The hues an automatic card can take — the app's `HUES`. */
export const CATEGORY_HUES = [
  6, 22, 36, 48, 150, 172, 192, 208, 226, 252, 284, 330,
];

/** The pastel band every card is drawn in — the app's `BAND`. */
const BAND = {
  top: { s: 70, l: 96.5 },
  bottom: { s: 58, l: 91 },
  shape: { s: 52, l: 84 },
  deep: { s: 42, l: 34 },
};

const hsl = (hue: number, s: number, l: number) => `hsl(${hue}, ${s}%, ${l}%)`;

export type CategoryArt = {
  preset: CategoryPreset;
  hue: number;
  top: string;
  bottom: string;
  shape: string;
  deep: string;
};

/** The app's `stableHash` (djb2), from `theme/store-art.ts`. */
function stableHash(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** A `#RRGGBB` hex's hue, or null for a grey or anything malformed. */
export function hueOfHex(hex: string | null | undefined): number | null {
  const match = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null;
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return null;
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

/** A hue as the `#RRGGBB` the `tint` column stores, at full strength. */
export function hexOfHue(hue: number): string {
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const v = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** A category's art — the same answer the app's `categoryArt` gives. */
export function categoryArt(
  id: string,
  overrides: { tint?: string | null; preset?: number | null } = {},
): CategoryArt {
  const h = stableHash(id);
  const presetIndex =
    overrides.preset != null &&
    Number.isInteger(overrides.preset) &&
    overrides.preset >= 0 &&
    overrides.preset < CATEGORY_PRESET_COUNT
      ? overrides.preset
      : h % CATEGORY_PRESET_COUNT;
  const hue =
    hueOfHex(overrides.tint) ??
    CATEGORY_HUES[Math.floor(h / CATEGORY_PRESET_COUNT) % CATEGORY_HUES.length];

  return {
    preset: CATEGORY_PRESETS[presetIndex],
    hue,
    top: hsl(hue, BAND.top.s, BAND.top.l),
    bottom: hsl(hue, BAND.bottom.s, BAND.bottom.l),
    shape: hsl(hue, BAND.shape.s, BAND.shape.l),
    deep: hsl(hue, BAND.deep.s, BAND.deep.l),
  };
}
