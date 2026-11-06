"use client";

import { ImageOff } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import { t } from "@/i18n/translations";

import { cx } from "./cx";
import { Dialog } from "./overlay";

/**
 * A picture that opens full size when it is clicked.
 *
 * Lists draw pictures at 40–128px — enough to recognise a dish, not to judge
 * one (right dish? sideways? does the artwork read?). So every thumbnail is a
 * real button, reachable from the keyboard, whose label names the row so a
 * list does not announce "View the picture" forty times.
 *
 * The large image is mounted only while the dialog is open, so a list of rows
 * does not fetch a full-size copy of each picture on mount.
 */
export function PreviewImage({
  src,
  name,
  className,
  style,
}: {
  src: string;
  /** What the picture is of. Optional — an unsaved row may have no name yet. */
  name?: string;
  /** The box: size, rounding, and any dimming the row applies. */
  className?: string;
  /** For call sites whose size is a number rather than a utility. */
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // Rows put a link or an edit button around their contents; opening
          // the picture should not also open the row.
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={name ? t("images.viewOf", { name }) : t("images.view")}
        className={cx(
          "group relative block shrink-0 overflow-hidden rounded-md border border-line bg-subtle transition-shadow hover:shadow-sm focus-visible:shadow-focus",
          className,
        )}
        style={style}
      >
        {broken ? (
          <span className="flex size-full items-center justify-center text-ink-4">
            <ImageOff className="size-2/5 max-h-6 max-w-6" strokeWidth={1.6} />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            aria-hidden
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        )}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={name ?? t("images.preview")}
        size="xl"
      >
        {open && (
          // `object-contain`: here the whole picture matters. Capped so a tall
          // image does not push the dialog past the window.
          <div className="flex items-center justify-center rounded-lg bg-[repeating-conic-gradient(var(--color-hover)_0%_25%,var(--color-surface)_0%_50%)] bg-[length:16px_16px] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              aria-hidden
              className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
            />
          </div>
        )}
      </Dialog>
    </>
  );
}

/**
 * The space a picture would take, for a row that has none — so rows with and
 * without a picture line up.
 */
export function ImagePlaceholder({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-md border border-line bg-subtle text-ink-4",
        className,
      )}
    >
      {children ?? (
        <ImageOff className="size-2/5 max-h-5 max-w-5" strokeWidth={1.6} />
      )}
    </div>
  );
}
