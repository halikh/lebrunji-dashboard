"use client";

import { useId, type ReactNode } from "react";

import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import {
  CATEGORY_HUES,
  CATEGORY_PRESETS,
  categoryArt,
  hexOfHue,
  hueOfHex,
  type CategoryArt,
} from "./category-art";

/**
 * A category's ground — the app's `CategoryBackdrop`, drawn as web SVG.
 *
 * The same shapes at the same proportions, so the preview in the editor is the
 * card a customer sees rather than an impression of it. Placed from the
 * picture's centre (`cx`, `cy`) and scaled with its size, as in the app.
 */
export function CategoryBackdrop({
  art,
  width: w,
  height: h,
  cx: px,
  cy: py,
  image,
}: {
  art: CategoryArt;
  width: number;
  height: number;
  cx: number;
  cy: number;
  image: number;
}) {
  const gradientId = useId();
  const fill = art.shape;

  let shapes: ReactNode;
  switch (art.preset) {
    case "orbs":
      shapes = (
        <>
          <circle
            cx={px + image * 0.18}
            cy={h * 0.68}
            r={h * 0.6}
            fill={fill}
            opacity={0.55}
          />
          <circle
            cx={px - image * 0.82}
            cy={h * 0.17}
            r={h * 0.08}
            fill={fill}
            opacity={0.7}
          />
          <circle
            cx={px - image * 0.6}
            cy={h * 0.9}
            r={h * 0.045}
            fill={fill}
            opacity={0.6}
          />
        </>
      );
      break;
    case "wave":
      shapes = (
        <>
          <path
            d={`M0 ${h * 0.74} C ${w * 0.28} ${h * 0.52}, ${w * 0.52} ${h * 1.02}, ${w} ${h * 0.5} L ${w} ${h} L 0 ${h} Z`}
            fill={fill}
            opacity={0.5}
          />
          <path
            d={`M0 ${h * 0.88} C ${w * 0.3} ${h * 0.74}, ${w * 0.6} ${h * 1.06}, ${w} ${h * 0.74} L ${w} ${h} L 0 ${h} Z`}
            fill="#FFFFFF"
            opacity={0.35}
          />
        </>
      );
      break;
    case "halo":
      shapes = (
        <>
          <circle cx={px} cy={py} r={image * 0.62} fill={fill} opacity={0.4} />
          {[0.8, 1.02, 1.26].map((k, i) => (
            <circle
              key={k}
              cx={px}
              cy={py}
              r={image * k}
              fill="none"
              stroke={fill}
              strokeWidth={1.25}
              opacity={0.75 - i * 0.18}
            />
          ))}
        </>
      );
      break;
    case "blob":
      shapes = (
        <path
          d={blobPath(
            px + image * 0.06,
            py + 4,
            image * 0.72,
            [1, 0.84, 1.08, 0.9, 1.12, 0.8],
          )}
          fill={fill}
          opacity={0.6}
        />
      );
      break;
    case "arc":
      shapes = (
        <>
          <circle
            cx={w + h * 0.08}
            cy={-h * 0.12}
            r={h * 0.95}
            fill={fill}
            opacity={0.45}
          />
          <circle
            cx={w + h * 0.08}
            cy={-h * 0.12}
            r={h * 1.18}
            fill="none"
            stroke={fill}
            strokeWidth={1.25}
            opacity={0.6}
          />
          {DOTS.map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={w * 0.5 + x * 7}
              cy={h * 0.74 + y * 7}
              r={1.4}
              fill={art.deep}
              opacity={0.12}
            />
          ))}
        </>
      );
      break;
    case "petals":
      shapes = (
        <>
          {[-34, 34].map((angle) => (
            <ellipse
              key={angle}
              cx={px}
              cy={py}
              rx={image * 0.74}
              ry={image * 0.4}
              fill={fill}
              opacity={0.45}
              transform={`rotate(${angle} ${px} ${py})`}
            />
          ))}
        </>
      );
      break;
  }

  return (
    <svg width={w} height={h} aria-hidden className="absolute inset-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={art.top} />
          <stop offset="1" stopColor={art.bottom} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={`url(#${gradientId})`} />
      {shapes}
      <circle cx={px} cy={py} r={image * 0.46} fill="#FFFFFF" opacity={0.5} />
    </svg>
  );
}

/** A 3×3 scatter, one corner left out — the app's `DOTS`. */
const DOTS: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [0, 2],
  [1, 2],
];

/** The app's `blobPath`: a smooth pebble, Catmull-Rom drawn as cubics. */
function blobPath(cx: number, cy: number, r: number, shares: number[]): string {
  const n = shares.length;
  const pts = shares.map((k, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
  const at = (i: number) => pts[(i + n) % n];
  let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

// ---- the preview ------------------------------------------------------------

/** The app's strip tile: 80pt, the picture at 64, the shapes laid out for 54. */
const TILE = 80;
/** The app's Search card, at a typical phone width. */
const CARD_W = 170;
const CARD_H = 112;
const CARD_IMAGE = 60;

/**
 * The category as the app draws it — the strip tile and the Search card, side
 * by side, from the same art.
 */
export function CategoryArtPreview({
  art,
  name,
  iconUrl,
}: {
  art: CategoryArt;
  name: string;
  iconUrl: string | null;
}) {
  const picture = (size: number) =>
    iconUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- a preview of an uploaded file, at its own URL
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className="relative object-contain"
        style={{ width: size, height: size }}
      />
    ) : null;

  return (
    <div className="flex flex-wrap items-end gap-lg" aria-hidden>
      <div className="flex flex-col items-center gap-xs">
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-[22px]"
          style={{
            width: TILE,
            height: TILE,
            boxShadow: `0 3px 6px ${art.deep}22`,
          }}
        >
          <CategoryBackdrop
            art={art}
            width={TILE}
            height={TILE}
            cx={TILE / 2}
            cy={TILE / 2}
            image={54}
          />
          {picture(64)}
        </div>
        <span className="max-w-[88px] truncate text-[13px] font-semibold text-text-soft">
          {name}
        </span>
      </div>

      <div
        className="relative flex overflow-hidden rounded-[22px]"
        style={{
          width: CARD_W,
          height: CARD_H,
          boxShadow: `0 6px 12px ${art.deep}26`,
        }}
      >
        <CategoryBackdrop
          art={art}
          width={CARD_W}
          height={CARD_H}
          cx={CARD_W - 8 - CARD_IMAGE / 2}
          cy={CARD_H / 2}
          image={CARD_IMAGE}
        />
        <span className="relative line-clamp-2 flex-1 ps-[18px] pt-[18px] pe-xs text-[15px] font-bold text-text">
          {name}
        </span>
        <span className="relative me-[8px] self-center">
          {picture(CARD_IMAGE)}
        </span>
      </div>
    </div>
  );
}

// ---- the pickers ------------------------------------------------------------

const SWATCH = 52;

/**
 * Which background — Automatic, or one of the six, each drawn in the card's
 * current colour so the choice is made by looking rather than by name.
 */
export function PresetChoice({
  id,
  tint,
  value,
  onChange,
  disabled,
}: {
  /** The row's id, so Automatic shows what the id would pick. Null when new. */
  id: string | null;
  tint: string | null;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled: boolean;
}) {
  const auto = id ? categoryArt(id, { tint }) : null;
  return (
    <div
      role="radiogroup"
      aria-label={t("categories.preset")}
      className="flex flex-wrap gap-sm ps-md"
    >
      <ChoiceButton
        selected={value === null}
        onClick={() => onChange(null)}
        disabled={disabled}
        label={t("categories.auto")}
      >
        {auto ? (
          <Swatch art={auto} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-text-faint">
            {t("categories.autoShort")}
          </span>
        )}
      </ChoiceButton>
      {CATEGORY_PRESETS.map((preset, index) => (
        <ChoiceButton
          key={preset}
          selected={value === index}
          onClick={() => onChange(index)}
          disabled={disabled}
          label={t(`categories.presets.${preset}`)}
        >
          <Swatch art={categoryArt(id ?? "new", { tint, preset: index })} />
        </ChoiceButton>
      ))}
    </div>
  );
}

/**
 * Which colour — Automatic, one of the app's twelve hues, or any other picked
 * by hand. Stored as a hex; only its hue reaches the card.
 */
export function TintChoice({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled: boolean;
}) {
  const hue = hueOfHex(value);
  const matches = (h: number) => hue !== null && Math.abs(hue - h) <= 1;
  const custom = value !== null && !CATEGORY_HUES.some(matches);

  return (
    <div
      role="radiogroup"
      aria-label={t("categories.tint")}
      className="flex flex-wrap items-center gap-sm ps-md"
    >
      <ChoiceButton
        selected={value === null}
        onClick={() => onChange(null)}
        disabled={disabled}
        label={t("categories.auto")}
        round
      >
        <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-text-faint">
          {t("categories.autoShort")}
        </span>
      </ChoiceButton>
      {CATEGORY_HUES.map((h) => (
        <ChoiceButton
          key={h}
          selected={matches(h) && !custom}
          onClick={() => onChange(hexOfHue(h))}
          disabled={disabled}
          label={hexOfHue(h)}
          round
        >
          <span
            className="block h-full w-full"
            style={{
              background: `linear-gradient(135deg, hsl(${h}, 70%, 96.5%), hsl(${h}, 58%, 85%))`,
            }}
          />
        </ChoiceButton>
      ))}
      <label
        className={cx(
          "relative flex h-[36px] cursor-pointer items-center gap-xs rounded-full border px-md text-[13px] font-semibold",
          custom
            ? "border-primary bg-primary-wash text-primary"
            : "border-border text-text-soft hover:bg-neutral-fill",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span
          aria-hidden
          className="h-[16px] w-[16px] rounded-full border border-border"
          style={{ background: value ?? "transparent" }}
        />
        {t("categories.tintCustom")}
        <input
          type="color"
          value={value ?? "#FF7A59"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function Swatch({ art }: { art: CategoryArt }) {
  return (
    <CategoryBackdrop
      art={art}
      width={SWATCH}
      height={SWATCH}
      cx={SWATCH / 2}
      cy={SWATCH / 2}
      image={34}
    />
  );
}

function ChoiceButton({
  selected,
  onClick,
  disabled,
  label,
  round,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  label: string;
  round?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "relative shrink-0 overflow-hidden border-2",
        round
          ? "h-[36px] w-[36px] rounded-full"
          : "h-[52px] w-[52px] rounded-[14px]",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-text-faint",
        disabled && "opacity-60",
      )}
    >
      {children}
    </button>
  );
}
