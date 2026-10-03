/**
 * Lebrunji — the mascot, in the illustrator's poses.
 *
 * The same art the app draws: its `CharacterPose` (the poses from "Lebrunji
 * poses.pdf") and its `Lebrunji` (the running pin, `lebrunji-4.svg`), each a
 * white-edged sticker on a transparent ground so it stands on any surface.
 * `scripts/import-brand-art.ts` copies them out of the app into
 * `public/brand/`; re-run it when the app's art changes rather than editing the
 * files.
 *
 * ## Why an `<img>`, not inline SVG
 *
 * The poses are 250KB of path data between them. As files they are fetched
 * only when one is drawn, and cached — inlined, all of them would ride in the
 * bundle of every page with an empty state. Nothing here needs to reach inside
 * the drawing, so nothing is lost.
 *
 * Static, as in the app: "no animations yet".
 */
export type Pose =
  /** The running pin — the brand's character, the app's onboarding hero. */
  | "running"
  | "loader"
  | "verified"
  | "welcome"
  | "empty bag"
  | "sit-down"
  | "out-of-area"
  | "packing"
  | "placed"
  | "confirmed"
  | "on the way"
  | "delivered"
  | "cancelled"
  | "placing";

function source(pose: Pose): string {
  return pose === "running"
    ? "/brand/character.svg"
    : `/brand/poses/${pose.replace(/\s+/g, "-")}.svg`;
}

/**
 * The mascot in a pose, fitted into a `size`-pixel square, centred and
 * keeping its proportions — the app's `CharacterPose` does the same, because
 * the poses are not all one shape and a slot should not change with the art.
 *
 * Decorative: the words beside it carry the meaning.
 */
export function Lebrunji({
  pose = "running",
  size,
  className,
}: {
  pose?: Pose;
  size: number;
  className?: string;
}) {
  return (
    // A static SVG from `public/` — `next/image` has nothing to optimise, and
    // would only add a wrapper and a loader to a decorative picture.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source(pose)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
