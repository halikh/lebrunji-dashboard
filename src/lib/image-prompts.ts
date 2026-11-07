/**
 * The ChatGPT prompts the dashboard hands out beside a picture that is
 * required — so a new category, tag, aisle or card matches the ones already in
 * the app instead of starting a fourth style.
 *
 * ## Read off what is live, not invented
 *
 * Each block below describes the pictures in production on 2026-11-07, which
 * were made in ChatGPT and fall into three families:
 *
 * - **Category, aisle and sub-aisle art** — one family. A glossy, photoreal 3D
 *   still life of a few typical things, three-quarter view from a little
 *   above, warm studio light, a soft shadow under the group only, on nothing.
 *   Props from the same drawer: kraft-paper jar covers tied with twine, light
 *   wooden bowls and boards, a fresh green leaf. 1254 × 1254, transparent.
 *   A category is the widest (the kind of shop), a sub-aisle the narrowest
 *   (one product and how it is eaten or used), so the cluster shrinks with it.
 * - **Tags** — a flat cartoon sticker with a thick dark outline and one soft
 *   highlight, transparent, read at 16 points beside a name.
 * - **Cards (artwork)** — a bold, minimal studio advert: one playful idea on
 *   a seamless backdrop of signal red, sunflower yellow or warm cream, glossy
 *   yellow delivery gear where delivery comes into it. 1122 × 1402 for a
 *   tile, 1915 × 821 for a banner.
 *
 * The sizes are the ones ChatGPT returns for those shapes, which is why the
 * live pictures have them; asking for them by name gets a file the uploader's
 * shape check accepts as it comes.
 *
 * ## Only the subject changes
 *
 * Everything but the subject (and a card's optional headline) is fixed text,
 * so two people asking on two days get the same look. Editing a prompt here
 * changes it for everyone, which is the point; changing it per picture is not
 * offered, because that is how the families drifted apart before.
 *
 * The prompts are English whatever the dashboard's language — they are input
 * to a model, not chrome — so they live here and not in the translations.
 */

export type ImagePromptKind =
  "category" | "aisle" | "subAisle" | "tag" | "tile" | "banner";

/** Whether this kind of picture is drawn on nothing, for the app's own tile. */
export function isCutoutKind(kind: ImagePromptKind): boolean {
  return kind !== "tile" && kind !== "banner";
}

/** Whether this kind takes a headline (the words are inside the card). */
export function takesHeadline(kind: ImagePromptKind): boolean {
  return kind === "tile" || kind === "banner";
}

const NO_BRANDS =
  "No text, no letters, no numbers, no logos and no real brand names anywhere — packaging is plain or carries only simple decorative patterns.";

const TRANSPARENT =
  "Fully transparent background (PNG with an alpha channel): no backdrop, no floor, no colour behind the subject, no frame, no border.";

/** Category, aisle and sub-aisle art: one family, so one style block. */
const STILL_LIFE_STYLE = [
  "Style: a polished, photorealistic 3D render, like a premium grocery-delivery app's icon. Glossy and rich, with saturated but natural colours.",
  "Lighting: soft, warm studio light from the upper left, gentle specular highlights, and a soft contact shadow directly under the group only.",
  "Camera: slightly above, a three-quarter view.",
  "Props, only where they fit the subject: kraft-paper jar covers tied with twine, light wooden bowls and boards, a fresh green leaf or two.",
  "Composition: centred, the group filling about 85% of the frame, nothing cropped at the edges, crisp clean outlines all round.",
].join("\n");

const CLUSTER: Record<"category" | "aisle" | "subAisle", string> = {
  category:
    "Show the whole kind of shop at a glance: a still-life cluster of 4 to 6 typical items you would buy there, grouped tightly as one arrangement, the tallest at the back and smaller pieces in front.",
  aisle:
    "Show this aisle of a Lebanese supermarket: a still-life cluster of 4 to 6 typical products from it, grouped tightly as one arrangement, the tallest at the back and smaller pieces in front.",
  subAisle:
    "Show this one product type: the product itself as the hero (in plain, unbranded packaging if it is sold packed), with at most two small companions that show how it is used or eaten — for example a bowl of it served, or a few loose pieces in front.",
};

const CARD_STYLE = [
  "Style: a bold, minimal studio advertising photograph for a food and grocery delivery app in Lebanon. Hyper-real, crisp, high contrast.",
  "One striking, slightly playful idea with a single hero subject — not a collage.",
  "Backdrop: one seamless solid colour — deep signal red, sunflower yellow or warm cream — with a soft shadow on the ground under the subject.",
  "Where delivery comes into it, the gear is glossy sunflower-yellow: helmet, jacket, insulated delivery box.",
  "Lots of clean empty space; no clutter, no busy scenery, no city skyline.",
].join("\n");

/**
 * The prompt for one picture.
 *
 * `subject` is the thing's English name as typed, trimmed; an empty one
 * leaves a bracketed placeholder in its place, so the prompt still reads
 * whole and the gap is obvious when pasted.
 */
export function imagePrompt(
  kind: ImagePromptKind,
  subject: string,
  headline = "",
): string {
  const what = subject.trim() || "[name]";

  switch (kind) {
    case "category":
    case "aisle":
    case "subAisle":
      return [
        "Create a square image, 1:1, 1254 × 1254 pixels.",
        TRANSPARENT,
        "",
        `Subject: "${what}".`,
        CLUSTER[kind],
        "",
        STILL_LIFE_STYLE,
        "",
        NO_BRANDS,
      ].join("\n");

    case "tag":
      return [
        "Create a square icon, 1:1, 1254 × 1254 pixels.",
        TRANSPARENT,
        "",
        `Subject: one simple symbol for "${what}".`,
        "Style: an emoji-like cartoon sticker — flat bold colours with subtle inner shading, a thick dark-brown outline, and one soft glossy highlight. No drop shadow.",
        "Composition: a single object, centred, filling about 70% of the frame, still readable when shown 16 pixels tall.",
        "",
        "No text, no letters, no numbers.",
      ].join("\n");

    case "tile":
    case "banner": {
      const frame =
        kind === "tile"
          ? "Create a portrait image, 4:5, 1122 × 1402 pixels."
          : "Create a wide banner image, 21:9, 1915 × 821 pixels. Keep the hero subject in the right half and leave the left third calm and empty.";
      const words = headline.trim()
        ? `Headline, written exactly as given and nothing else: "${headline.trim()}". Large, bold, rounded sans-serif, white or espresso brown for contrast, set in the empty space${kind === "banner" ? " on the left" : " at the top"}, well clear of the edges.`
        : "No text, no letters, no numbers.";
      return [
        frame,
        "",
        `Idea: ${what}.`,
        "",
        CARD_STYLE,
        "",
        words,
        "No logos and no real brand names.",
      ].join("\n");
    }
  }
}

/** Where the prompt is pasted. */
export const CHATGPT_URL = "https://chatgpt.com/";
