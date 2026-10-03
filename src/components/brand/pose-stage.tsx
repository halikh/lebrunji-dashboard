import { Lebrunji, type Pose } from "./lebrunji";

/**
 * A pose standing in its own shapes — the app's backdrops, path for path.
 *
 * The app never draws a pose on bare ground. Its empty states
 * (`components/domain/empty-state.tsx`) set each one in two organic blobs a
 * little out of register, low mounds at the foot, a ground shadow and a few
 * loose pen strokes that never touch the figure; its setup screens
 * (`components/domain/pose-stage.tsx`) do the same for the poses there. The
 * dashboard drew the same characters floating in white, which is the one
 * thing that made them look borrowed rather than shared.
 *
 * ## The shapes are the app's; the colours are one step deeper
 *
 * Every path below is copied from those two files, on the same stage, so the
 * scene is the illustrator's. The fills are not quite: the app lays its blobs
 * in cream on a white sheet, and the dashboard's *page* is that cream — the
 * pale blob would vanish on it. So each fill moves one step down the same ramp
 * (cream → cream-deep, cream-deep → line-soft, border → line), which reads on
 * a white card and on the cream page alike.
 *
 * ## Scaled, not redrawn
 *
 * The app's stage is most of a phone screen; here it often sits inside one tab
 * of a page. The whole scene — stage, shapes, figure — is drawn at `scale`, so
 * the proportions between the pose and its shapes stay the ones that were
 * designed.
 *
 * Decorative throughout: the words beside it carry the meaning.
 */

/** The poses that have a scene of their own in the app. */
export type StagedPose = "empty bag" | "sit-down" | "verified" | "packing";

type Scene = {
  /** The stage the shapes are drawn to, in the app's points. */
  width: number;
  height: number;
  /** The figure's box, and how far its feet sit above the stage's foot. */
  pose: { width: number; height: number; lift: number };
  /** Low mounds at the foot, where the scene has them. */
  mounds?: string;
  /** The lighter blob behind. */
  pale: string;
  /** The deeper shape the figure stands in. */
  deep: string;
  /** The ground shadow. */
  shadow: { cy: number; rx: number; ry: number };
  /** The pose's own strokes — sparkles, steam, ticks. */
  marks?: string;
  /** Faint dashes at the edges. */
  dashes?: string;
};

const SCENES: Record<StagedPose, Scene> = {
  // From the app's `EmptyState`. Standing beside the bag: the pale blob leans
  // left, the deep one up and right with a soft notch in its shoulder. Two
  // ticks off the bag's shoulder.
  "empty bag": {
    width: 300,
    height: 220,
    pose: { width: 180, height: 170, lift: 12 },
    mounds:
      "M0 182c0-26 22-44 46-40 20 3 30 20 26 40ZM228 182c2-22 22-36 44-32 16 3 28 16 28 32Z",
    pale: "M40 96C34 54 68 22 110 26c22 2 34 14 54 12 30-4 50 10 52 36 2 30-24 46-26 76-2 28-30 44-64 40-46-6-80-52-86-94Z",
    deep: "M70 84C78 44 118 18 168 16c40-2 70 18 82 50 6 18-6 26-4 42 4 30 22 44 10 66-12 22-46 28-96 28-50 0-92-14-98-48-4-26 4-46 8-70Z",
    shadow: { cy: 204, rx: 96, ry: 7 },
    marks: "M77 146l8 5M88 140l4 9",
    dashes: "M18 113l8-7M232 179l10-8M21 202l28-5",
  },
  // From the app's `EmptyState`. Seated on the box, cup in hand: a low mound
  // rising behind the head and a round moon peeking up and left — nothing on
  // its way, a quiet hour. Two wisps of steam off the cup.
  "sit-down": {
    width: 300,
    height: 220,
    pose: { width: 190, height: 170, lift: 12 },
    pale: "M52 62a40 40 0 1 0 80 0a40 40 0 1 0-80 0Z",
    deep: "M44 168C34 132 52 100 86 92c18-4 26-30 52-44 30-16 66-8 84 18 12 18 10 34 22 48 18 22 22 50 6 70-12 14-40 18-110 18-56 0-88-12-96-34Z",
    shadow: { cy: 204, rx: 96, ry: 7 },
    marks: "M190 88c-5-6 5-10 0-17M200 90c-5-6 5-10 0-17",
    dashes: "M232 179l10-8",
  },
  // From the app's `PoseStage`. Arm up, cheering: a round burst behind, a blob
  // up by the raised hand, and sparkles.
  verified: {
    width: 320,
    height: 290,
    pose: { width: 240, height: 250, lift: 14 },
    pale: "M196 30c26-20 70-16 90 10 20 26 14 64-10 84-22 18-58 18-80-2-24-22-26-70 0-92Z",
    deep: "M160 34c64 0 116 50 116 114s-52 114-116 114S44 212 44 148 96 34 160 34Z",
    shadow: { cy: 276, rx: 100, ry: 8 },
    marks: "M258 40l8-14M276 58l14-6M244 28l2-14M40 92l-12-8M30 118h-14",
  },
  // The app gives "packing" no backdrop of its own, so it stands in the
  // `PoseStage` scene for the figure with the bag — `welcome`, which that file
  // describes as "two blobs out of register and low mounds at the foot, like
  // the empty states".
  packing: {
    width: 320,
    height: 290,
    pose: { width: 240, height: 250, lift: 14 },
    mounds:
      "M0 252c0-28 24-48 50-44 22 3 32 22 28 44ZM244 252c2-24 24-40 48-35 18 3 30 18 28 35Z",
    pale: "M44 120C38 70 78 30 126 34c26 2 40 16 62 14 34-4 58 12 60 42 2 34-28 52-30 86-2 32-34 50-74 46-52-6-92-60-100-102Z",
    deep: "M78 104C88 56 134 26 192 24c46-2 80 20 94 58 6 20-6 30-4 48 4 34 24 50 12 76-14 26-52 32-110 32-58 0-106-16-112-56-4-30 4-52 6-78Z",
    shadow: { cy: 276, rx: 110, ry: 8 },
  },
};

/**
 * `height` is the stage's height on screen, in pixels; everything else follows
 * from it, so two scenes of different shapes can be asked for at one size.
 */
export function PoseStage({
  pose,
  height,
  className,
}: {
  pose: StagedPose;
  height: number;
  className?: string;
}) {
  const scene = SCENES[pose];
  const scale = height / scene.height;
  const width = Math.round(scene.width * scale);
  const figure = Math.round(
    Math.min(scene.pose.width, scene.pose.height) * scale,
  );

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {scene.mounds ? (
          <path d={scene.mounds} fill="var(--color-cream-deep)" />
        ) : null}
        <path d={scene.pale} fill="var(--color-cream-deep)" />
        <path d={scene.deep} fill="var(--color-line-soft)" />
        <ellipse
          cx={scene.width / 2}
          cy={scene.shadow.cy}
          rx={scene.shadow.rx}
          ry={scene.shadow.ry}
          fill="var(--color-line)"
        />
        {scene.marks ? (
          <path
            d={scene.marks}
            fill="none"
            stroke="var(--color-text-faint)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        {scene.dashes ? (
          <path
            d={scene.dashes}
            stroke="var(--color-line)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {/* Feet on the ground shadow, as in the app. */}
      <span
        className="relative flex"
        style={{ marginBottom: Math.round(scene.pose.lift * scale) }}
      >
        <Lebrunji pose={pose satisfies Pose} size={figure} />
      </span>
    </div>
  );
}
