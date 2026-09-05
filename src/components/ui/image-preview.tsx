"use client";

import { useId, useState, type CSSProperties } from "react";

import { t } from "@/i18n/translations";

import { cx } from "./index";
import { Modal } from "./modal";

/**
 * A picture that opens full size when it is clicked.
 *
 * ## Why every thumbnail needs this
 *
 * Every picture in this dashboard is drawn at somewhere between 44 and 128
 * points, because the lists are lists. That size is enough to recognise a dish
 * already known and not nearly enough to *judge* one — whether the photograph
 * is the right dish, whether it is sideways, whether the promotion's artwork
 * reads at all. Those are exactly the questions an operator opens the catalogue
 * to answer, and until now the only way to answer them was to open the app.
 *
 * ## A button, not an image with a click handler
 *
 * The thumbnails were `aria-hidden` decorations, which was right while they did
 * nothing: the name is beside them in text, and announcing the picture too read
 * the row twice. A thing that *does* something cannot be decoration — so it
 * becomes a real button with a real label, reachable from the keyboard, and the
 * label names the row so a list of them does not announce "View the picture"
 * forty times.
 *
 * That is a tab stop per row, and it is the honest price of the feature. The
 * alternative — a click handler on a `div` — is the same tab stop's worth of
 * functionality with none of it available to anybody not using a mouse.
 *
 * ## The large image is mounted only while it is open
 *
 * `Modal` keeps its `<dialog>` in the tree so the open and close transitions
 * have something to run on. An `<img>` inside it would be fetched on mount by
 * every row on the screen — the same URLs the thumbnails use, so it costs
 * nothing on a warm cache and a full-size fetch per row on a cold one. The
 * picture is therefore rendered on open and dropped on close.
 */
export function PreviewImage({
  src,
  name,
  className,
  style,
}: {
  src: string;
  /**
   * What the picture is of — the dish, the shop, the promotion.
   *
   * Optional because a couple of call sites genuinely have no name to hand (the
   * uploader is editing a row that may not be saved yet). Without one the
   * button falls back to a generic label, which is worse but still a label.
   */
  name?: string;
  /** The box: size, rounding, and any dimming the row applies. */
  className?: string;
  /** For the call sites whose size is a number rather than a utility. */
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // Rows put a stretched link or an edit button around their contents.
          // Opening the picture should not also open the row.
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={name ? t("images.viewOf", { name }) : t("images.view")}
        // `overflow-hidden` is what makes the rounding on the button clip the
        // image inside it — the corners used to be the image's own.
        className={cx("block shrink-0 overflow-hidden", className)}
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden className="size-full object-cover" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        // Wider than the dialog's default, which is sized for a question. The
        // point of this one is the picture, so it takes what the viewport has.
        className="w-[min(880px,calc(100vw-2rem))] p-lg"
      >
        {/* `pe-[40px]` keeps the heading clear of the close button the dialog
            puts in that corner. */}
        <h2
          className="truncate pe-[40px] text-[15px] font-semibold"
          id={titleId}
        >
          {name ?? t("images.preview")}
        </h2>

        {open && (
          // `object-contain`, unlike the thumbnail: this is the view where the
          // whole picture matters, and cropping it here would hide the thing
          // somebody opened it to see. Capped at 70vh so a tall image does not
          // push the dialog past the window.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            aria-hidden
            className="mt-md max-h-[70vh] w-full rounded-md object-contain"
          />
        )}
      </Modal>
    </>
  );
}

/**
 * The space a picture would take, for a row that has none.
 *
 * Beside `PreviewImage` rather than repeated at each call site: six lists draw
 * this square, and a list that forgot it lined its rows up differently from
 * every other list in the app — which is how the placeholder came to be written
 * out six times in the first place.
 */
export function ImagePlaceholder({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cx("shrink-0 bg-neutral-fill", className)}
    >
      {children}
    </div>
  );
}
