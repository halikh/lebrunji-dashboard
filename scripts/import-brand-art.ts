/**
 * Pulls the brand art out of the app and into `public/brand/`.
 *
 *   npm run import:brand-art
 *
 * The app holds the illustrator's art as SVG strings in two generated files —
 * `src/assets/poses.generated.ts` (one per pose) and
 * `src/assets/character.generated.ts` (the running pin, `lebrunji-4.svg`). This
 * writes each pose and the character as its own `.svg`, and the character again
 * as `public/favicon.svg`.
 *
 * The logos are not among them — the app does not carry either lockup. Both
 * were exported once and are committed as is: `lebrunji-logo-stacked.svg` from
 * the designer's "LebRunji Logo-final.pdf" (page 2), and `lebrunji-logo.svg`
 * from their `lebrunji-1.svg`, each with the yellow ground removed and the view
 * box cropped to the art.
 *
 * ## Why files, not a generated module
 *
 * The poses are 250KB of path data. Inlined into a component, every byte of
 * that would ship in the JavaScript bundle of every page that can show an empty
 * state. As files they are fetched only when drawn, and cached.
 *
 * ## Re-run when
 *
 * The app's art changes — its own import scripts say when that is. The output
 * is committed, so nothing here runs at build time and the dashboard does not
 * need the app checked out to build.
 */
import fs from "node:fs";
import path from "node:path";

const APP = process.env.LEBRUNJI_APP ?? "c:/Projects/lebrunji";
const OUT = path.resolve(import.meta.dirname, "../public/brand");

/** Every `'key': "<svg …>"` pair, and the bare `= "<svg …>"` of a constant. */
function svgStrings(file: string): [string, string][] {
  const source = fs.readFileSync(path.join(APP, file), "utf8");
  const pairs: [string, string][] = [];
  for (const m of source.matchAll(/'([^']+)':\s*("(?:[^"\\]|\\.)*")/g)) {
    pairs.push([m[1], JSON.parse(m[2]) as string]);
  }
  for (const m of source.matchAll(
    /export const (\w+)_XML = ("(?:[^"\\]|\\.)*")/g,
  )) {
    pairs.push([m[1].toLowerCase(), JSON.parse(m[2]) as string]);
  }
  return pairs;
}

/** `'on the way'` → `on-the-way`, so a pose name is a path segment. */
const slug = (name: string) => name.replace(/\s+/g, "-");

fs.mkdirSync(path.join(OUT, "poses"), { recursive: true });

const poses = svgStrings("src/assets/poses.generated.ts");
for (const [name, xml] of poses) {
  fs.writeFileSync(path.join(OUT, "poses", `${slug(name)}.svg`), xml);
}

const [[, character]] = svgStrings("src/assets/character.generated.ts");
fs.writeFileSync(path.join(OUT, "character.svg"), character);

/**
 * The character alone is the favicon — at sixteen pixels a lockup is a smudge,
 * and the running pin is the one shape that still reads.
 *
 * Its view box is made square around the art, because a browser fits a
 * non-square icon by stretching it. The art's own box is wider than tall by
 * nothing and taller by a lot, so the square takes the height and centres the
 * width in it.
 */
const box = /viewBox="([\d.\s-]+)"/.exec(character);
if (!box) throw new Error("The character has no viewBox to square.");
const [x, y, w, h] = box[1].trim().split(/\s+/).map(Number);
const side = Math.max(w, h);
const square = `${x - (side - w) / 2} ${y - (side - h) / 2} ${side} ${side}`;
fs.writeFileSync(
  path.resolve(OUT, "../favicon.svg"),
  character.replace(box[0], `viewBox="${square}"`),
);

console.log(`${poses.length} poses, the character and the favicon → ${OUT}`);
console.log(`Poses: ${poses.map(([name]) => name).join(", ")}`);
