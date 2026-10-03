/**
 * Pulls the brand art out of the app and into `public/brand/`.
 *
 *   npm run import:brand-art
 *
 * The app holds the illustrator's art as SVG strings in two generated files —
 * `src/assets/poses.generated.ts` (one per pose) and
 * `src/assets/character.generated.ts` (the running pin, `lebrunji-4.svg`). This
 * writes each pose and the character as its own `.svg`.
 *
 * The logo is not among them: the dashboard uses the stacked lockup, which the
 * app does not carry, so `public/brand/lebrunji-logo-stacked.svg` was exported
 * once from the designer's "LebRunji Logo-final.pdf" (page 2) and is committed
 * as is.
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
  for (const m of source.matchAll(/export const (\w+)_XML = ("(?:[^"\\]|\\.)*")/g)) {
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

console.log(`${poses.length} poses and the character → ${OUT}`);
console.log(`Poses: ${poses.map(([name]) => name).join(", ")}`);
