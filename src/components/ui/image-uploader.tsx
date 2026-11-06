"use client";

import { Crosshair, ImageUp, RefreshCw, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { t } from "@/i18n/translations";
import { withFocus, type Focus } from "@/lib/image-focus";
import {
  fitsShape,
  isCutout,
  measureImage,
  PHOTO_FRAMES,
  type ImageShape,
  type PhotoKind,
} from "@/lib/image-shape";
import { deleteImage, uploadImage } from "@/lib/images";
import { IMAGE } from "@/lib/limits";

import { Button } from "./button";
import { cx } from "./cx";
import {
  ImageFramer,
  type FramedPicture,
  type FramerSource,
} from "./image-framer";
import { PreviewImage } from "./image-preview";

/**
 * The largest file a photo may be *before* framing. What is uploaded is the
 * framed copy, a fraction of this, and is held to the usual limits; this only
 * stops a browser tab being asked to decode something absurd.
 */
const PHOTO_SOURCE_MAX_MB = 30;

/**
 * Choosing a picture, and getting it into storage.
 *
 * ## Three ways in
 *
 * A file picker, drag and drop, and paste (a logo sent over WhatsApp sits on
 * the clipboard). Paste is listened for on the zone, not the document, so two
 * uploaders on one screen do not fight over it.
 *
 * ## It uploads on choosing, not on saving
 *
 * So the picture is seen in place before it is committed. The file goes up at
 * once (through `/api/images`, see `@/lib/images`) and the form is handed a
 * URL it saves with everything else. The cost is orphans, so this deletes its
 * own supersedings — a file it uploaded this session and then replaced has
 * never been referenced by a row. It never deletes an image that arrived as
 * `value`: that one is still live until the form saves.
 *
 * ## Checked before a byte is sent
 *
 * `shape` and `cutout` are checked in the browser first, so a wrong picture
 * costs nothing — not five megabytes over a phone, not an orphan. A file the
 * browser cannot measure is let through; the upload's own checks (type from
 * the magic bytes, size, pixel limits) say what is wrong with it better.
 *
 * ## Shop and dish photos are framed first
 *
 * With `photo`, a chosen file is not uploaded as it is: it opens
 * `ImageFramer`, which crops it to the kind's master shape and asks where the
 * subject is, and what goes up is the crop, with the point on its address
 * (`lib/image-shape.ts`, `lib/image-focus.ts`). A saved photo gets "Adjust
 * framing", which moves the point and uploads nothing.
 *
 * ## The progress bar is real
 *
 * Five megabytes over a tethered phone is slow enough that a silent spinner
 * looks like a hang — the state in which people press the button again.
 */
export function ImageUploader({
  value,
  onChange,
  folder,
  shape,
  cutout = false,
  photo,
  reframe = true,
  disabled = false,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: {
  /** The URL currently saved on the row, or chosen in this session. */
  value: string | null;
  onChange: (url: string | null) => void;
  folder:
    | "menu-items"
    | "stores"
    | "promotions"
    | "artwork"
    | "category-art"
    | "tag-art"
    | "menu-sections";
  /** The frame the app draws this picture in; other shapes are refused. */
  shape?: ImageShape;
  /** Only a transparent-background picture (art laid on the app's own tiles). */
  cutout?: boolean;
  /** A shop's or a dish's photograph: framed before it is uploaded. */
  photo?: PhotoKind;
  /**
   * Whether the saved photo can be reframed here. Off where `value` is a
   * picture this row only inherits — a branch showing its shop's photo —
   * because a new point would have to be saved somewhere it does not belong.
   */
  reframe?: boolean;
  disabled?: boolean;
  /** `Field`'s render props. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [framing, setFraming] = useState<FramerSource | null>(null);
  const frame = photo ? PHOTO_FRAMES[photo] : null;

  const input = useRef<HTMLInputElement>(null);
  /** Paths this component uploaded, newest last. Never anything it was given. */
  const ours = useRef<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  // Leaving mid-upload stops it, and stops state being set after unmount.
  useEffect(() => {
    const controller = abort;
    return () => controller.current?.abort();
  }, []);

  /** Uploads `file`; the row gets its address, with `focus` on it if given. */
  const send = useCallback(
    async (file: File, focus: Focus | null) => {
      setProgress(0);
      abort.current = new AbortController();

      const superseded = ours.current.at(-1);

      try {
        const uploaded = await uploadImage(file, folder, {
          onProgress: setProgress,
          signal: abort.current.signal,
        });

        ours.current.push(uploaded.path);
        onChange(withFocus(uploaded.url, focus));

        // The one it replaces, only if we put it there. Nothing ever pointed
        // at it. Failing to tidy up is not worth telling anybody about.
        if (superseded) void deleteImage(superseded).catch(() => {});
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error
            ? cause.message
            : t("common.somethingWentWrong"),
        );
      } finally {
        setProgress(null);
        abort.current = null;
      }
    },
    [folder, onChange],
  );

  const accept = useCallback(
    async (file: File | null | undefined) => {
      if (!file || disabled) return;

      setError(null);

      // A photo is cropped to its shape in the framing step, so its shape
      // and size here do not matter — only that it is not absurd.
      if (frame) {
        if (file.size > PHOTO_SOURCE_MAX_MB * 1024 * 1024) {
          setError(t("validation.imageTooBig", { max: PHOTO_SOURCE_MAX_MB }));
          return;
        }
        setFraming({ kind: "file", file });
        return;
      }

      if (shape) {
        const size = await measureImage(file);
        if (size && !fitsShape(size, shape)) {
          setError(
            t("images.wrongShape", {
              width: size.width,
              height: size.height,
              shape: `${shape.width}:${shape.height}`,
            }),
          );
          return;
        }
      }

      // Unknown (null) is let through, for the same reason as the shape.
      if (cutout && (await isCutout(file)) === false) {
        setError(t("images.needsCutout"));
        return;
      }

      await send(file, null);
    },
    [cutout, disabled, frame, send, shape],
  );

  const framed = useCallback(
    (picture: FramedPicture) => {
      setFraming(null);
      if (picture.file) void send(picture.file, picture.focus);
      else if (value) onChange(withFocus(value, picture.focus));
    },
    [onChange, send, value],
  );

  const framer = frame && photo && (
    <ImageFramer
      source={framing}
      kind={photo}
      shape={frame.shape}
      previews={frame.previews}
      onCancel={() => setFraming(null)}
      onDone={framed}
    />
  );

  const busy = progress !== null;
  const invalid = ariaInvalid === true || ariaInvalid === "true";
  const rules = (
    <p className="text-[12px] text-ink-4">
      {frame
        ? t("controls.imagePhotoRules", {
            shape: `${frame.shape.width}:${frame.shape.height}`,
          })
        : t("controls.imageRules", {
            mb: Math.round(IMAGE.maxBytes / (1024 * 1024)),
          })}
      {shape &&
        `, ${t("controls.imageShape", { shape: `${shape.width}:${shape.height}` })}`}
      {cutout && `, ${t("controls.imageCutout")}`}
    </p>
  );

  if (value) {
    return (
      <div
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="flex items-start gap-4"
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files)[0];
          if (file) void accept(file);
        }}
      >
        {/* Clickable, to judge the picture full size before saving. */}
        <PreviewImage
          src={value}
          className={cx(
            "size-24",
            cutout &&
              "bg-[repeating-conic-gradient(var(--color-hover)_0%_25%,var(--color-surface)_0%_50%)] bg-[length:12px_12px]",
          )}
        />

        <div className="flex min-w-0 flex-col items-start gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
            >
              <RefreshCw />
              {t("images.replace")}
            </Button>
            {frame && reframe && (
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled || busy}
                onClick={() => setFraming({ kind: "url", url: value })}
              >
                <Crosshair />
                {t("images.adjust")}
              </Button>
            )}
            <Button
              variant="danger-soft"
              size="sm"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
            >
              <Trash2 />
              {t("images.remove")}
            </Button>
          </div>
          {busy ? <Progress fraction={progress} /> : rules}
          {error && <Problem>{error}</Problem>}
        </div>

        <Picker input={input} onFile={accept} disabled={disabled} />
        {framer}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        The whole zone opens the picker for a mouse. It is a div because it
        holds a button; the inner "browse" button is the one keyboard stop.
      */}
      <div
        id={id}
        aria-describedby={describedBy}
        // So a form that scrolls to its first invalid control finds this too.
        aria-invalid={invalid || undefined}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files)[0];
          if (file) void accept(file);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onClick={() => {
          // Not mid-upload: a second file would replace the first unseen.
          if (disabled || busy) return;
          input.current?.click();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={cx(
          "flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          over
            ? "border-accent bg-accent-soft"
            : invalid
              ? "border-danger bg-surface"
              : "border-line-strong bg-subtle hover:border-ink-4 hover:bg-hover/60",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <span className="mb-1 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-3 shadow-xs">
          <ImageUp className="size-4" />
        </span>
        <p className="text-[13.5px] text-ink-2">
          {t("images.drop")}{" "}
          <button
            type="button"
            disabled={disabled || busy}
            onClick={(event) => {
              // The zone opens the picker too; don't ask twice.
              event.stopPropagation();
              input.current?.click();
            }}
            className="rounded-sm font-medium text-accent hover:text-accent-hover hover:underline disabled:text-ink-4"
          >
            {t("images.browse")}
          </button>
        </p>
        <p className="text-[12px] text-ink-3">{t("images.paste")}</p>
        {busy ? <Progress fraction={progress} /> : rules}
      </div>

      {error && <Problem>{error}</Problem>}

      <Picker input={input} onFile={accept} disabled={disabled} />
      {framer}
    </div>
  );
}

/**
 * The file input itself, out of the layout but still in the accessibility
 * tree (`sr-only`, not `display: none`).
 */
function Picker({
  input,
  onFile,
  disabled,
}: {
  input: RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  disabled: boolean;
}) {
  return (
    <input
      ref={input}
      type="file"
      accept={IMAGE.types.join(",")}
      disabled={disabled}
      tabIndex={-1}
      aria-label={t("images.choose")}
      className="sr-only"
      onChange={(event) => {
        onFile(event.target.files?.[0]);
        // Cleared, so choosing the same file again (a retry) fires again.
        event.target.value = "";
      }}
    />
  );
}

function Progress({ fraction }: { fraction: number }) {
  const percent = Math.round(fraction * 100);
  const percentLabel = `${percent}%`;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={t("images.uploading")}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-36 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[12px] text-ink-3 tabular-nums">
        {percentLabel}
      </span>
    </div>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[12.5px] leading-snug text-danger-ink">
      {children}
    </p>
  );
}
