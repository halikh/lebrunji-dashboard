"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { t } from "@/i18n/translations";
import {
  CENTRE,
  objectPosition,
  readFocus,
  withoutFragment,
  type Focus,
} from "@/lib/image-focus";
import {
  coverPixelsNeeded,
  looksSoft,
  PHOTO_FRAMES,
  type ImageShape,
  type PhotoKind,
  type PhotoPreview,
} from "@/lib/image-shape";

import { Button } from "./button";
import { Dialog } from "./overlay";

/**
 * Framing a shop's or a dish's photograph: crop it to its master shape, then
 * say where the subject is.
 *
 * ## Why both
 *
 * The app shows one photograph in frames of several shapes and crops it to
 * each (`lib/image-shape.ts`, `PHOTO_FRAMES`). The crop here makes every
 * photograph of a kind the same shape, so the app's frames cut the same amount
 * from each; the point says which part to keep (`lib/image-focus.ts`). The
 * previews are those frames, cropped by the same rule the app uses, so what is
 * seen here is what a customer sees.
 *
 * ## The crop happens in the browser
 *
 * The chosen region is drawn to a canvas at no more than {@link MAX_SIDE}
 * pixels on its long side and that is what is uploaded — so a 12-megapixel,
 * 8 MB phone photo, which the upload limits refuse, now goes up as a few
 * hundred kilobytes. The app never asks for more than 1280 pixels across
 * (`image-url.ts` there); 2000 leaves room above that without carrying the
 * camera's full size around.
 *
 * A picture with a see-through edge stays see-through (WebP, or PNG where the
 * browser cannot write WebP); anything else becomes a JPEG.
 *
 * ## Two modes
 *
 * Given a **file**, the whole step: crop, then the point. Given an **address**
 * already saved, only the point — the file is not fetched back and recut, and
 * changing the point changes nothing but the fragment on the address.
 */

/** Longest side of what is uploaded, in pixels. See the note above. */
const MAX_SIDE = 2000;

/** The crop is never smaller than this many source pixels across. */
const MIN_CROP = 400;

/** How far in the zoom goes, at most. */
const MAX_ZOOM = 4;

/** The stage the source is shown on, in CSS pixels. */
const STAGE_W = 440;
const STAGE_H = 330;

/** Width of the previews' cropped copy — enough to judge, quick to redraw. */
const PREVIEW_W = 720;

/** One arrow-key step, as a share of the picture. */
const STEP = 0.02;

export type FramerSource =
  { kind: "file"; file: File } | { kind: "url"; url: string };

export type FramedPicture = {
  /** The cropped file to upload — null when only the point was changed. */
  file: File | null;
  focus: Focus;
};

/** The crop, in source pixels. Its height follows from the shape. */
type Crop = { left: number; top: number; width: number };

export function ImageFramer({
  source,
  kind,
  shape,
  previews,
  onCancel,
  onDone,
}: {
  /** What to frame. The dialog is open while this is set. */
  source: FramerSource | null;
  /** Which page's cover it must be sharp enough for. */
  kind: PhotoKind;
  shape: ImageShape;
  previews: readonly PhotoPreview[];
  onCancel: () => void;
  onDone: (picture: FramedPicture) => void;
}) {
  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      size="xl"
      title={
        source?.kind === "url"
          ? t("images.frame.titleAdjust")
          : t("images.frame.title")
      }
      description={
        source?.kind === "url"
          ? t("images.frame.descriptionAdjust")
          : t("images.frame.description", {
              shape: `${shape.width}:${shape.height}`,
            })
      }
    >
      {/* Keyed, so a second picture starts from nothing rather than from the
          first one's crop. */}
      {source && (
        <Framer
          key={
            source.kind === "file"
              ? `${source.file.name}:${source.file.size}:${source.file.lastModified}`
              : source.url
          }
          source={source}
          kind={kind}
          shape={shape}
          previews={previews}
          onCancel={onCancel}
          onDone={onDone}
        />
      )}
    </Dialog>
  );
}

function Framer({
  source,
  kind,
  shape,
  previews,
  onCancel,
  onDone,
}: {
  source: FramerSource;
  kind: PhotoKind;
  shape: ImageShape;
  previews: readonly PhotoPreview[];
  onCancel: () => void;
  onDone: (picture: FramedPicture) => void;
}) {
  const aspect = shape.width / shape.height;
  const cropping = source.kind === "file";

  // The source, as an <img> the canvas can draw from. A file is read through
  // an object URL — same origin, so the canvas is never tainted; an address
  // is only ever shown, never drawn, so it needs no CORS.
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [broken, setBroken] = useState(false);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [focus, setFocus] = useState<Focus>(
    source.kind === "url" ? (readFocus(source.url) ?? CENTRE) : CENTRE,
  );
  const [preview, setPreview] = useState<string | null>(
    source.kind === "url" ? withoutFragment(source.url) : null,
  );
  const [busy, setBusy] = useState(false);

  // The picture as it will be saved: the crop, at its shape, no wider than
  // the export makes it — or, only reframing, the saved file as it is.
  const savedAspect =
    cropping || !image ? aspect : image.naturalWidth / image.naturalHeight;
  const savedPixels = cropping
    ? Math.min(crop?.width ?? 0, MAX_SIDE * Math.min(1, aspect))
    : (image?.naturalWidth ?? 0);
  const neededPixels = coverPixelsNeeded(PHOTO_FRAMES[kind].cover, savedAspect);
  const soft =
    image !== null && looksSoft(Math.round(savedPixels), neededPixels);

  useEffect(() => {
    const src =
      source.kind === "file"
        ? URL.createObjectURL(source.file)
        : withoutFragment(source.url);
    const element = new window.Image();
    element.onload = () => {
      setImage(element);
      if (source.kind === "file") {
        setCrop(
          largestCrop(element.naturalWidth, element.naturalHeight, aspect),
        );
      }
    };
    element.onerror = () => setBroken(true);
    element.src = src;
    return () => {
      element.onload = null;
      element.onerror = null;
      if (source.kind === "file") URL.revokeObjectURL(src);
    };
  }, [source, aspect]);

  // The cropped copy the point and the previews are drawn from, redrawn a
  // moment after the crop stops moving. Each one replaces the last.
  useEffect(() => {
    if (!cropping || !image || !crop) return;
    let url: string | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const canvas = drawCrop(image, crop, aspect, PREVIEW_W);
      canvas?.toBlob(
        (blob) => {
          if (!blob || cancelled) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
        },
        "image/jpeg",
        0.85,
      );
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [cropping, image, crop, aspect]);

  async function finish() {
    if (source.kind !== "file") {
      onDone({ file: null, focus });
      return;
    }
    if (!image || !crop) return;
    setBusy(true);
    try {
      const file = await exportCrop(image, crop, aspect, source.file.type);
      onDone({ file, focus });
    } catch {
      setBroken(true);
    } finally {
      setBusy(false);
    }
  }

  if (broken) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="text-[13.5px] text-danger-ink">
          {t("images.frame.cannotOpen")}
        </p>
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={
          cropping
            ? "grid gap-6 md:grid-cols-[440px_1fr]"
            : "grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]"
        }
      >
        {cropping && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-ink-2">
              {t("images.frame.crop")}
            </h3>
            {image && crop ? (
              <CropStage
                image={image}
                crop={crop}
                aspect={aspect}
                onChange={setCrop}
              />
            ) : (
              <div
                className="rounded-md bg-subtle"
                style={{ width: STAGE_W, height: STAGE_H }}
              />
            )}
            {image && crop && (
              <ZoomSlider
                image={image}
                crop={crop}
                aspect={aspect}
                onChange={setCrop}
              />
            )}
            <p className="text-[12px] text-ink-3">
              {t("images.frame.cropHint")}
            </p>
          </section>
        )}

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink-2">
              {t("images.frame.focus")}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setFocus(CENTRE)}>
              {t("images.frame.reset")}
            </Button>
          </div>
          {/* The saved file's own shape: reframing an older photo that is not
              the master shape, the point is measured on all of it, not on a
              crop of it the app never makes. */}
          <FocusPicker
            src={preview}
            aspect={savedAspect}
            focus={focus}
            onChange={setFocus}
          />
          <p className="text-[12px] text-ink-3">
            {t("images.frame.focusHint")}
          </p>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-ink-2">
          {t("images.frame.inTheApp")}
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          {previews.map((frame) => (
            <figure key={frame.key} className="flex flex-col gap-1.5">
              <div
                className="overflow-hidden rounded-md border border-line bg-subtle"
                style={{ height: 96, width: Math.round(96 * frame.ratio) }}
              >
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element -- a blob URL; next/image cannot take one
                  <img
                    src={preview}
                    alt=""
                    className="size-full object-cover"
                    style={{ objectPosition: objectPosition(focus) }}
                  />
                )}
              </div>
              <figcaption className="text-[12px] text-ink-3">
                {t(`images.frame.${frame.key}`)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* A warning, not a refusal: a soft photo of the right shop beats none.
          Live, so zooming in too far says so as it happens. */}
      {soft && (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[12.5px] leading-snug text-warning-ink"
        >
          {t(
            kind === "shop" ? "images.frame.softShop" : "images.frame.softDish",
            {
              pixels: Math.round(savedPixels),
              needed: neededPixels,
            },
          )}
        </p>
      )}

      <div className="sticky bottom-0 z-10 -mx-6 -mb-5 mt-auto flex justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={() => void finish()}
          disabled={busy || !preview || (cropping && !crop)}
          pending={busy}
        >
          {cropping ? t("images.frame.use") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────── the crop ───────────────────────────── */

function CropStage({
  image,
  crop,
  aspect,
  onChange,
}: {
  image: HTMLImageElement;
  crop: Crop;
  aspect: number;
  onChange: (crop: Crop) => void;
}) {
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;
  const scale = Math.min(STAGE_W / naturalW, STAGE_H / naturalH);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const height = crop.width / aspect;

  function move(dx: number, dy: number, from: Crop) {
    onChange(
      clampCrop(
        { ...from, left: from.left + dx, top: from.top + dy },
        naturalW,
        naturalH,
        aspect,
      ),
    );
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = Math.max(naturalW, naturalH) * STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    move(delta[0], delta[1], crop);
  }

  return (
    <div
      className="relative overflow-hidden rounded-md bg-ink/5 select-none"
      style={{ width: naturalW * scale, height: naturalH * scale }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL */}
      <img src={image.src} alt="" draggable={false} className="size-full" />
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("images.frame.crop")}
        aria-valuetext={`${Math.round(crop.left)}, ${Math.round(crop.top)}`}
        aria-valuenow={Math.round(crop.left)}
        onKeyDown={onKey}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, crop };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          move(
            (event.clientX - start.x) / scale,
            (event.clientY - start.y) / scale,
            start.crop,
          );
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        // Everything outside the crop dimmed by one enormous shadow; the stage
        // clips it.
        className="absolute cursor-move rounded-[2px] outline-2 outline-white shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] focus-visible:outline-accent"
        style={{
          left: crop.left * scale,
          top: crop.top * scale,
          width: crop.width * scale,
          height: height * scale,
        }}
      />
    </div>
  );
}

function ZoomSlider({
  image,
  crop,
  aspect,
  onChange,
}: {
  image: HTMLImageElement;
  crop: Crop;
  aspect: number;
  onChange: (crop: Crop) => void;
}) {
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;
  const full = largestCrop(naturalW, naturalH, aspect).width;
  const most = Math.max(1, Math.min(MAX_ZOOM, full / Math.min(full, MIN_CROP)));
  const zoom = full / crop.width;

  if (most <= 1) return null;

  return (
    <label className="flex items-center gap-3 text-[12.5px] text-ink-2">
      {t("images.frame.zoom")}
      <input
        type="range"
        min={1}
        max={most}
        step={0.01}
        value={zoom}
        onChange={(event) => {
          // Zoom about the crop's centre, then back inside the picture.
          const width = full / Number(event.target.value);
          const centreX = crop.left + crop.width / 2;
          const centreY = crop.top + crop.width / aspect / 2;
          onChange(
            clampCrop(
              {
                width,
                left: centreX - width / 2,
                top: centreY - width / aspect / 2,
              },
              naturalW,
              naturalH,
              aspect,
            ),
          );
        }}
        className="w-48 accent-accent"
      />
    </label>
  );
}

/* ───────────────────────────── the point ───────────────────────────── */

function FocusPicker({
  src,
  aspect,
  focus,
  onChange,
}: {
  src: string | null;
  aspect: number;
  focus: Focus;
  onChange: (focus: Focus) => void;
}) {
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange({
      x: Math.min(1, Math.max(0, focus.x + delta[0])),
      y: Math.min(1, Math.max(0, focus.y + delta[1])),
    });
  }

  return (
    <button
      type="button"
      onKeyDown={onKey}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        // A keyboard "click" has no position; arrows move the point instead.
        if (event.detail === 0) return;
        onChange({
          x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
          y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
        });
      }}
      aria-label={t("images.frame.focusHint")}
      className="relative w-full max-w-[320px] cursor-crosshair overflow-hidden rounded-md border border-line bg-subtle focus-visible:shadow-focus"
      style={{ aspectRatio: aspect }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- a blob or a stored URL
        <img
          src={src}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow-[0_0_0_1px_rgba(15,23,42,0.4)]"
        style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
      />
    </button>
  );
}

/* ───────────────────────────── drawing ───────────────────────────── */

/** The largest crop of `aspect` that fits, centred. */
function largestCrop(naturalW: number, naturalH: number, aspect: number): Crop {
  const width = Math.min(naturalW, naturalH * aspect);
  return {
    width,
    left: (naturalW - width) / 2,
    top: (naturalH - width / aspect) / 2,
  };
}

/** `crop` kept inside the picture and no larger than it. */
function clampCrop(
  crop: Crop,
  naturalW: number,
  naturalH: number,
  aspect: number,
): Crop {
  const width = Math.min(crop.width, naturalW, naturalH * aspect);
  const height = width / aspect;
  return {
    width,
    left: Math.min(Math.max(0, crop.left), naturalW - width),
    top: Math.min(Math.max(0, crop.top), naturalH - height),
  };
}

/** The crop drawn at `outWidth` across (never enlarged), or null. */
function drawCrop(
  image: HTMLImageElement,
  crop: Crop,
  aspect: number,
  outWidth: number,
): HTMLCanvasElement | null {
  const width = Math.max(1, Math.round(Math.min(outWidth, crop.width)));
  const height = Math.max(1, Math.round(width / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.left,
    crop.top,
    crop.width,
    crop.width / aspect,
    0,
    0,
    width,
    height,
  );
  return canvas;
}

/** The file that is uploaded. See "The crop happens in the browser". */
async function exportCrop(
  image: HTMLImageElement,
  crop: Crop,
  aspect: number,
  sourceType: string,
): Promise<File> {
  const longest = Math.max(crop.width, crop.width / aspect);
  const outWidth = crop.width * Math.min(1, MAX_SIDE / longest);
  const canvas = drawCrop(image, crop, aspect, outWidth);
  if (!canvas) throw new Error("no canvas");

  // Only a PNG or WebP can be see-through; a JPEG never is, so never asks.
  const clear = sourceType !== "image/jpeg" && hasTransparency(canvas);
  const blob = clear
    ? ((await toBlob(canvas, "image/webp", 0.9)) ??
      (await toBlob(canvas, "image/png")))
    : await toBlob(canvas, "image/jpeg", 0.88);
  if (!blob) throw new Error("no blob");

  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/webp"
        ? "webp"
        : "jpg";
  return new File([blob], `photo.${extension}`, { type: blob.type });
}

/** Whether any pixel of the canvas, read small, is less than opaque. */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const sample = document.createElement("canvas");
  sample.width = 64;
  sample.height = Math.max(1, Math.round((64 * canvas.height) / canvas.width));
  const context = sample.getContext("2d");
  if (!context) return false;
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return true;
  return false;
}

/**
 * `canvas.toBlob` as a promise. A browser that cannot write `type` writes a
 * PNG instead; that comes back as null here, so the caller's fallback decides.
 */
function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob && blob.type === type ? blob : null),
      type,
      quality,
    ),
  );
}
