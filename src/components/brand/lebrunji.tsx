import type { ReactNode } from "react";

/**
 * Lebrunji — the mascot.
 *
 * Ported from `src/components/domain/lebrunji.tsx` in the app. Every coordinate
 * and colour here is the design's (the handoff's `mascot-geometry.js`); the
 * only thing that changed is the medium — `react-native-svg` becomes plain SVG,
 * and the two Reanimated loops the empty states use (the blink and the drifting
 * `z`s) become CSS keyframes in `globals.css`.
 *
 * ## What was left behind
 *
 * The app's `hello` wave and `running` bob are driven motions that only its
 * home screen and live-order page make. Nothing here asks for them, so the
 * poses are ported and the motions are not: `hello` and `running` draw still,
 * which is what the app draws under Reduce Motion anyway. The scooter rider is
 * a separate drawing on a separate box and is not ported at all.
 *
 * ## Reduce Motion
 *
 * Honoured by the global rule at the end of `globals.css`, which runs every
 * animation once, instantly. The resting styles are therefore the still
 * picture: eyes open, and the `z`s sitting where they start.
 */
export type MascotMood =
  | "full"
  | "wave"
  | "hello"
  | "empty"
  | "sleeping"
  | "running";

/**
 * The mascot's own palette, deliberately **not** theme roles.
 *
 * A character's skin does not become a different colour because the app's
 * accent did — these are the character, the way a logo's colours are the logo.
 */
const art = {
  ink: "#1e1b18",
  ink2: "#3b3530",
  visor: "#2b2622",
  red: "#d42a2c",
  redD: "#a81e23",
  skin: "#e7bf9a",
  skinD: "#d3a47c",
  kraft: "#c99a6c",
  kraftD: "#b3855a",
  cream: "#f4ecdd",
  creamD: "#e2d5bd",
  white: "#ffffff",
} as const;

type Pt = readonly [number, number];
type Expression = "neutral" | "warm" | "concerned" | "asleep" | "grin";
type DrinkLevel = "full" | "low" | "none";

type Leg = {
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  /** Shoe rotation about the ankle. */
  angle: number;
  back?: boolean;
};
type Arm = readonly [shoulder: Pt, elbow: Pt, hand: Pt];

type Pose = {
  expression: Expression;
  /** Head rotation in degrees, about the neck (100, 62). */
  headTilt?: number;
  /** Transform on the whole upper body — jacket, head, arms, box, bag. */
  body?: string;
  legs: readonly [Leg, Leg];
  armL: Arm;
  armR: Arm;
  bag?: { x: number; y: number; empty: boolean };
  /** A bottle set down on the ground beside him. */
  ground?: { x: number; y: number; drink: DrinkLevel; bent: boolean };
  shadow: { cy: number; rx: number };
  /** Sitting on the delivery box rather than wearing it. */
  seat?: boolean;
  speed?: boolean;
  sleep?: boolean;
  blink?: boolean;
  /** A viewBox crop instead of the full 200×240. */
  crop?: { x: number; y: number; w: number; h: number };
};

const SH_L: Pt = [76, 72];
const SH_R: Pt = [124, 72];

const STANDING: Pose["legs"] = [
  { hip: [91, 128], knee: [90, 170], ankle: [89, 212], angle: 0 },
  { hip: [109, 128], knee: [110, 170], ankle: [111, 212], angle: 0 },
];
const ARM_DOWN_L: Arm = [SH_L, [72, 104], [76, 132]];
const ARM_DOWN_R: Arm = [SH_R, [128, 104], [132, 134]];
const ARM_RAISED_L: Arm = [SH_L, [58, 60], [60, 34]];

const POSES: Record<MascotMood, Pose> = {
  full: {
    expression: "neutral",
    legs: STANDING,
    armL: ARM_DOWN_L,
    armR: ARM_DOWN_R,
    bag: { x: 132, y: 138, empty: false },
    shadow: { cy: 222, rx: 46 },
  },
  wave: {
    expression: "warm",
    legs: STANDING,
    armL: ARM_RAISED_L,
    armR: ARM_DOWN_R,
    bag: { x: 132, y: 138, empty: false },
    shadow: { cy: 222, rx: 46 },
  },
  hello: {
    expression: "warm",
    legs: STANDING,
    armL: ARM_RAISED_L,
    armR: [SH_R, [128, 104], [126, 132]],
    crop: { x: 44, y: 2, w: 112, h: 112 },
    shadow: { cy: 222, rx: 0 },
  },
  empty: {
    expression: "concerned",
    headTilt: -5,
    legs: STANDING,
    armL: ARM_DOWN_L,
    armR: ARM_DOWN_R,
    bag: { x: 132, y: 138, empty: true },
    ground: { x: 46, y: 222, drink: "none", bent: true },
    shadow: { cy: 222, rx: 46 },
    blink: true,
  },
  sleeping: {
    expression: "asleep",
    body: "translate(0 44)",
    headTilt: 13,
    legs: [
      { hip: [91, 172], knee: [86, 192], ankle: [84, 222], angle: 0 },
      { hip: [109, 172], knee: [114, 192], ankle: [116, 222], angle: 0 },
    ],
    armL: [SH_L, [72, 100], [88, 134]],
    armR: [SH_R, [128, 100], [112, 134]],
    seat: true,
    ground: { x: 156, y: 228, drink: "low", bent: false },
    shadow: { cy: 228, rx: 52 },
    sleep: true,
  },
  running: {
    expression: "grin",
    body: "translate(4 -6) rotate(7 100 130)",
    legs: [
      {
        hip: [96, 124],
        knee: [84, 160],
        ankle: [62, 168],
        angle: 62,
        back: true,
      },
      { hip: [103, 124], knee: [124, 150], ankle: [119, 186], angle: -6 },
    ],
    armL: [SH_L, [64, 98], [56, 118]],
    armR: [SH_R, [140, 94], [152, 86]],
    bag: { x: 152, y: 90, empty: false },
    shadow: { cy: 212, rx: 36 },
    speed: true,
  },
};

/** Brows and mouth per expression. `mouthFill` is a filled shape, not a line. */
const EXPRESSIONS: Record<
  Expression,
  { brow: string; mouth?: string; mouthFill?: string }
> = {
  neutral: {
    brow: "M90.5 33.4 L96.5 32.8 M103.5 32.8 L109.5 33.4",
    mouth: "M97.5 55 Q100 56.6 102.5 55",
  },
  warm: {
    brow: "M90.5 33 Q93.5 31.2 96.5 32.4 M103.5 32.4 Q106.5 31.2 109.5 33",
    mouth: "M96.2 54.4 Q100 58.4 103.8 54.4",
  },
  concerned: {
    brow: "M90.5 33.6 L96.5 31.8 M103.5 31.8 L109.5 33.6",
    mouth: "M97.6 55.6 L102.4 55.6",
  },
  asleep: {
    brow: "M91 34.4 L96.5 34.2 M103.5 34.2 L109 34.4",
    mouth: "M98.4 55.4 Q100 56.4 101.6 55.4",
  },
  grin: {
    brow: "M90.5 32.4 L96.5 33.6 M103.5 33.6 L109.5 32.4",
    mouthFill: "M95.8 54 Q100 60 104.2 54 Z",
  },
};

const SHUT_EYES =
  "M91.8 38.4 Q94 40.4 96.2 38.4 M103.8 38.4 Q106 40.4 108.2 38.4";

/** Not copy — a drawn glyph, the same in every language. */
const SNORE = "z";

const ptStr = (p: Pt) => `${p[0]} ${p[1]}`;

/**
 * A sleeve: shoulder → elbow → just short of the hand, so the hand circle
 * drawn after it sits at the cuff rather than on top of a round cap.
 */
function Sleeve({ arm }: { arm: Arm }) {
  const [sh, el, h] = arm;
  const dx = h[0] - el[0];
  const dy = h[1] - el[1];
  const len = Math.hypot(dx, dy);
  const k = (len - 5) / len;
  const end: Pt = [el[0] + dx * k, el[1] + dy * k];
  return (
    <path
      d={`M${ptStr(sh)} L${ptStr(el)} L${ptStr(end)}`}
      stroke={art.redD}
      strokeWidth={13}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

function Hand({ at }: { at: Pt }) {
  return <circle cx={at[0]} cy={at[1]} r={5.6} fill={art.skin} />;
}

function LegShape({ leg, colour }: { leg: Leg; colour: string }) {
  const [ax, ay] = leg.ankle;
  return (
    <g>
      <path
        d={`M${ptStr(leg.hip)} L${ptStr(leg.knee)} L${ptStr(leg.ankle)}`}
        stroke={colour}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* The shoe, drawn around the ankle and rotated about it. */}
      <g transform={`translate(${ax} ${ay}) rotate(${leg.angle})`}>
        <path d="M-8 1 Q-8 -3 -3 -3 L6 -1 Q13 1 13 5 L-8 5Z" fill={art.redD} />
        <rect x={-8} y={4} width={21} height={2.4} rx={1} fill={art.cream} />
      </g>
    </g>
  );
}

/**
 * The bottle, drawn around a base point of `(0, 0)` with the neck up.
 *
 * The straw's stripes are a dashed cream stroke laid over a solid red one on the
 * same path, so the curve is the only thing that exists and the stripes follow
 * it.
 */
function Bottle({ drink, bent }: { drink: DrinkLevel; bent: boolean }) {
  const straw = bent
    ? "M0 -31 C0 -39 2 -42 9 -41"
    : "M0 -31 C0 -41 -1 -45 -7 -47";
  return (
    <g>
      <path
        d={straw}
        stroke={art.red}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={straw}
        stroke={art.cream}
        strokeWidth={3.2}
        strokeDasharray="2.4 2.4"
        fill="none"
      />
      <path
        d="M-7 -18 C-7 -22 -3 -24 -3 -27 L-3 -32 L3 -32 L3 -27 C3 -24 7 -22 7 -18 L7 -2 Q7 0 5 0 L-5 0 Q-7 0 -7 -2Z"
        fill={art.cream}
        stroke={art.ink}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {drink === "full" && (
        <rect
          x={-5.2}
          y={-17}
          width={10.4}
          height={15.4}
          rx={1.5}
          fill={art.red}
        />
      )}
      {drink === "low" && (
        <rect
          x={-5.2}
          y={-8}
          width={10.4}
          height={6.4}
          rx={1.5}
          fill={art.red}
        />
      )}
      <rect x={-3.8} y={-35} width={7.6} height={4.2} rx={1} fill={art.ink} />
      <path
        d="M-4 -15 v6"
        stroke={art.white}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
}

/** Handles, contents and body of the grocery bag, hanging from (x, y). */
function Bag({ x, y, empty }: { x: number; y: number; empty: boolean }) {
  const handles = (
    <path
      d={`M${x - 8} ${y + 1} Q${x - 6} ${y - 7} ${x} ${y - 5} M${x + 8} ${y + 1} Q${x + 6} ${y - 7} ${x} ${y - 5}`}
      stroke={art.kraftD}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
    />
  );

  // Narrower and creased, which is the whole point of it.
  if (empty) {
    return (
      <g>
        {handles}
        <path
          d={`M${x - 11} ${y} L${x + 11} ${y} L${x + 14} ${y + 32} L${x - 14} ${y + 32}Z`}
          fill={art.kraft}
        />
        <path
          d={`M${x - 11} ${y} L${x + 11} ${y} L${x + 11.4} ${y + 5} L${x - 11.4} ${y + 5}Z`}
          fill={art.kraftD}
        />
        <path
          d={`M${x - 12.7} ${y + 17} L${x + 12.7} ${y + 17} L${x + 13.3} ${y + 22} L${x - 13.3} ${y + 22}Z`}
          fill={art.red}
        />
        <path
          d={`M${x - 6} ${y + 8} L${x - 3} ${y + 30} M${x + 5} ${y + 7} L${x + 7} ${y + 30}`}
          stroke={art.kraftD}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return (
    <g>
      {handles}
      {/* The baguette and the bottle go in before the bag's front, so the bag
          hides their bases and they read as being *in* it. */}
      <path
        d={`M${x + 3} ${y + 22} L${x + 12} ${y - 17}`}
        stroke={art.skin}
        strokeWidth={7.5}
        strokeLinecap="round"
      />
      <path
        d={`M${x + 8} ${y - 6} l3 -2 M${x + 10} ${y - 12} l3 -2`}
        stroke={art.skinD}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <g transform={`translate(${x - 6} ${y + 24})`}>
        <Bottle drink="full" bent={false} />
      </g>
      <path
        d={`M${x - 14} ${y} L${x + 14} ${y} L${x + 16} ${y + 40} L${x - 16} ${y + 40}Z`}
        fill={art.kraft}
      />
      <path
        d={`M${x - 14} ${y} L${x + 14} ${y} L${x + 14.3} ${y + 5} L${x - 14.3} ${y + 5}Z`}
        fill={art.kraftD}
      />
      <path
        d={`M${x - 15.1} ${y + 22} L${x + 15.1} ${y + 22} L${x + 15.4} ${y + 28} L${x - 15.4} ${y + 28}Z`}
        fill={art.red}
      />
    </g>
  );
}

/**
 * The open-face moto helmet, visor flipped up. Deliberately no screws, vents or
 * chin strap — at the sizes he is drawn they read as earrings.
 */
function Helmet() {
  return (
    <g>
      <path
        d="M80.4 40 C79.4 16.4 89 6.4 100 6.4 C111 6.4 120.6 16.4 119.6 40 L119.4 45.4 Q116.6 47.6 112.9 47.2 L112.8 36.6 Q100 26 87.2 36.6 L87.1 47.2 Q83.4 47.6 80.6 45.4Z"
        fill={art.red}
      />
      <path
        d="M80.4 40 C79.8 26 83.6 16.6 89.6 11.6 Q84.8 22 85 38 L85.1 47.5 Q82.4 47.2 80.6 45.4Z"
        fill={art.redD}
      />
      <path
        d="M104 9 Q112 11 116 18"
        stroke={art.white}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.45}
      />
      <path
        d="M97 6.6 Q100 6.3 103 6.6 L103 21.8 Q100 21.4 97 21.8Z"
        fill={art.cream}
      />
      <path
        d="M86.4 38.4 Q100 27.8 113.6 38.4 L112.8 36.6 Q100 26 87.2 36.6Z"
        fill={art.ink}
        opacity={0.5}
      />
      <path
        d="M82.8 29.6 Q100 16.6 117.2 29.6 Q118.6 24.2 114.4 21.4 Q100 12.8 85.6 21.4 Q81.4 24.2 82.8 29.6Z"
        fill={art.visor}
      />
      <path
        d="M86.6 22.8 Q100 15.4 113.4 22.8"
        stroke={art.white}
        strokeWidth={1.3}
        fill="none"
        opacity={0.35}
        strokeLinecap="round"
      />
      <path
        d="M82.8 29.6 Q100 16.6 117.2 29.6"
        stroke={art.ink}
        strokeWidth={1.2}
        fill="none"
      />
    </g>
  );
}

/**
 * His head: neck, face, hair and sideburns, the helmet, brows, eyes, nose,
 * moustache and mouth. `eyes` is supplied by the caller, because it is the one
 * part that varies by more than a path.
 */
function Head({
  expression,
  eyes,
}: {
  expression: Expression;
  eyes: ReactNode;
}) {
  const expr = EXPRESSIONS[expression];
  return (
    <g>
      {/* Neck, face, hair, sideburns. No ears: the helmet covers them. */}
      <rect x={95} y={52} width={10} height={14} fill={art.skinD} />
      <path
        d="M86 34 C86 23 114 23 114 34 L114 44 C114 54 106 60 100 60 C94 60 86 54 86 44Z"
        fill={art.skin}
      />
      <path
        d="M85 37 C83 22 92 16 101 16 C111 16 118 22 115 37 C113.6 30 108 27.4 100 27.4 C92 27.4 86.6 30 85 37Z"
        fill={art.ink}
      />
      <path
        d="M85.2 33 L88.6 33 L88.4 47 Q86.6 46 85.6 44Z M114.8 33 L111.4 33 L111.6 47 Q113.4 46 114.4 44Z"
        fill={art.ink}
      />

      <Helmet />

      <path
        d={expr.brow}
        stroke={art.ink}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {eyes}

      {/* Nose, moustache, mouth. */}
      <path
        d="M100 38.5 L98.6 45 L100.8 45.4"
        stroke={art.skinD}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M100 47.6 C96 45.6 90 45.8 87.6 50.2 C91 52.4 96 52.2 100 50.4 C104 52.2 109 52.4 112.4 50.2 C110 45.8 104 45.6 100 47.6Z"
        fill={art.ink}
      />
      {expr.mouthFill ? (
        <path d={expr.mouthFill} fill={art.ink} />
      ) : (
        <path
          d={expr.mouth}
          stroke={art.ink}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function ShutEyes({ className }: { className?: string }) {
  return (
    <path
      d={SHUT_EYES}
      stroke={art.ink}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
      className={className}
    />
  );
}

/**
 * The mascot, `size` pixels wide. Full-body moods are 1.2× as tall as they are
 * wide; `hello` is square.
 *
 * Decorative: every place that draws him also says in words what he is there
 * to say, so he is hidden from assistive technology.
 */
export function Lebrunji({
  mood = "full",
  size,
  className,
}: {
  mood?: MascotMood;
  size: number;
  className?: string;
}) {
  const p = POSES[mood];
  const crop = p.crop ?? { x: 0, y: 0, w: 200, h: 240 };
  const height = Math.round((size * crop.h) / crop.w);

  return (
    <svg
      width={size}
      height={height}
      viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
      aria-hidden
      className={className}
    >
      {p.shadow.rx > 0 && (
        <ellipse
          cx={100}
          cy={p.shadow.cy}
          rx={p.shadow.rx}
          ry={5}
          fill={art.ink}
          opacity={0.1}
        />
      )}

      {p.seat && (
        <g>
          <rect x={66} y={166} width={68} height={62} rx={5} fill={art.ink} />
          <path d="M66 175 L134 175" stroke={art.ink2} strokeWidth={2} />
        </g>
      )}

      {p.legs.map((leg, i) => (
        <LegShape key={i} leg={leg} colour={leg.back ? art.ink2 : art.ink} />
      ))}

      <g transform={p.body}>
        {/* The box on his back, when he is not sitting on it. */}
        {!p.seat && (
          <g>
            <rect x={64} y={42} width={72} height={80} rx={6} fill={art.ink} />
            <path d="M64 51 L136 51" stroke={art.ink2} strokeWidth={2} />
          </g>
        )}

        {/* Jacket, T-shirt V, zip, hem band — then the box straps. */}
        <path
          d="M100 62 C112 62 124 64 128 74 L126 134 L74 134 L72 74 C76 64 88 62 100 62Z"
          fill={art.red}
        />
        <path
          d="M91 62.6 L100 77 L109 62.6 Q100 60.6 91 62.6Z"
          fill={art.cream}
        />
        <path d="M100 77 L100 134" stroke={art.redD} strokeWidth={1.6} />
        <path d="M74 126 L126 126 L126 134 L74 134Z" fill={art.redD} />
        {!p.seat && (
          <path
            d="M84 64 L82 112 M116 64 L118 112"
            stroke={art.ink}
            strokeWidth={5}
            strokeLinecap="round"
          />
        )}

        <g transform={p.headTilt ? `rotate(${p.headTilt} 100 62)` : undefined}>
          <Head
            expression={p.expression}
            eyes={
              p.expression === "asleep" ? (
                <ShutEyes />
              ) : (
                <>
                  <g className={p.blink ? "mascot-eyes-open" : undefined}>
                    <circle cx={94} cy={38.6} r={1.9} fill={art.ink} />
                    <circle cx={106} cy={38.6} r={1.9} fill={art.ink} />
                  </g>
                  {/* The shut pair, drawn over the open one and normally
                      invisible. Only the blinking mood pays for it. */}
                  {p.blink && <ShutEyes className="mascot-eyes-shut" />}
                </>
              )
            }
          />
        </g>

        <Sleeve arm={p.armL} />
        <Hand at={p.armL[2]} />

        {/* Right sleeve, the bag, then the hand over the bag's handles. */}
        <Sleeve arm={p.armR} />
        {p.bag && <Bag {...p.bag} />}
        <Hand at={p.armR[2]} />
      </g>

      {/* Set down beside him, with a small shadow of its own. */}
      {p.ground && (
        <g>
          <ellipse
            cx={p.ground.x}
            cy={p.ground.y}
            rx={11}
            ry={3}
            fill={art.ink}
            opacity={0.1}
          />
          <g
            transform={`translate(${p.ground.x} ${p.ground.y - 1}) scale(1.15)`}
          >
            <Bottle drink={p.ground.drink} bent={p.ground.bent} />
          </g>
        </g>
      )}

      {p.speed && (
        <path
          d="M18 84 H40 M24 102 H44 M16 120 H34"
          stroke={art.ink}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.3}
        />
      )}

      {/* Two glyphs drifting on their own beats, not one rigid pair. The peak
          strength is `fill-opacity`, so the keyframes can own `opacity`. */}
      {p.sleep && (
        <g
          fill={art.ink}
          fontFamily="var(--font-heading)"
          fontWeight={600}
          className="mascot-sleep"
        >
          <text x={124} y={60} fontSize={22} fillOpacity={0.6}>
            {SNORE}
          </text>
          <text x={140} y={46} fontSize={15} fillOpacity={0.4}>
            {SNORE}
          </text>
        </g>
      )}
    </svg>
  );
}
