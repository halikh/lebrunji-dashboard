"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { uploadImage, deleteImage } from "@/lib/images";
import { t } from "@/i18n/translations";

import { Button, cx } from "./index";
import { useFieldWiring } from "./field";

/**
 * Choosing a picture, and getting it into Storage.
 *
 * ## Three ways in, because people arrive with the file in three states
 *
 * A merchant photographing a plate has it in a folder. One sent a logo over
 * WhatsApp has it on the clipboard. One tidying a folder full of them wants to
 * drag. Supporting only the file picker makes the other two save a file first
 * for no reason.
 *
 * Paste is listened for on the whole drop zone rather than the document, so a
 * screen with two of these does not put the image in whichever one happened to
 * mount first.
 *
 * ## It uploads on choosing, not on saving
 *
 * The point is seeing the picture in place before committing to it — a photo
 * that turns out to be sideways or of the wrong dish should be discovered here
 * rather than in the app. So the file goes up immediately and the form is
 * handed a URL, which it saves along with everything else.
 *
 * The cost is orphans: choose three images and save the third, and the first
 * two are objects nothing points at. So this deletes its own supersedings —
 * a file it uploaded during this editing session and then replaced has never
 * been referenced by any row, and is safe to remove. What it does **not**
 * touch is an image that arrived as `value` from a saved row: that one is
 * still in the database until the form saves, and deleting it early would take
 * the picture out of the app for a save that might never happen.
 *
 * ## Why the progress bar is real
 *
 * Five megabytes over a shop's tethered phone is slow enough that a spinner
 * saying nothing is indistinguishable from a hang — which is the state in which
 * people press the button again. See `api/images.ts` for why that means not
 * using supabase-js here.
 */
export function ImageUploader({
  value,
  onChange,
  folder,
  disabled = false,
}: {
  /** The URL currently saved on the row, or chosen in this session. */
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "menu-items" | "stores" | "categories";
  disabled?: boolean;
}) {
  const field = useFieldWiring();

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const input = useRef<HTMLInputElement>(null);
  /** Paths this component uploaded, newest last. Never anything it was given. */
  const ours = useRef<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  // A drag abandoned by navigating away should not go on uploading, and a
  // component that unmounts mid-upload would otherwise set state afterwards.
  useEffect(() => {
    const controller = abort;
    return () => controller.current?.abort();
  }, []);

  const accept = useCallback(
    async (file: File | null | undefined) => {
      if (!file || disabled) return;

      setError(null);
      setProgress(0);
      abort.current = new AbortController();

      const superseded = ours.current.at(-1);

      try {
        const uploaded = await uploadImage(file, folder, {
          onProgress: setProgress,
          signal: abort.current.signal,
        });

        ours.current.push(uploaded.path);
        onChange(uploaded.url);

        // The one it replaces, if we are the ones who put it there. Nothing has
        // ever pointed at it, so this cannot take a picture out of the app.
        // Failing to tidy up is not worth telling anybody about.
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
    [disabled, folder, onChange],
  );

  const busy = progress !== null;

  if (value) {
    return (
      <div className="flex items-center gap-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt=""
          aria-hidden
          className="size-[96px] shrink-0 rounded-md border border-border object-cover"
        />

        <div className="flex flex-col items-start gap-sm">
          <div className="flex items-center gap-sm">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
            >
              {t("images.replace")}
            </Button>
            {/* Danger, like every other removal in the product. It is the
                colour that says "this takes something away", and an operator
                should not have to learn that it means one thing on a row and
                another inside a form. */}
            <Button
              variant="danger"
              size="sm"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
            >
              {t("images.remove")}
            </Button>
          </div>

          {busy && <Progress fraction={progress} />}
          {error && <Problem>{error}</Problem>}
        </div>

        <Picker input={input} onFile={accept} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      {/*
        A div, not a button. It contains two buttons of its own, and a button
        inside a button is invalid and behaves unpredictably. The clickable
        surface says so with a cursor of its own — the global rule deliberately
        does not reach `div`s, because a rule broad enough to catch them would
        put a pointer on half the page.
      */}
      <div
        id={field?.id}
        aria-describedby={field?.describedBy}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files)[0];
          if (file) void accept(file);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void accept(event.dataTransfer.files[0]);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center gap-xs rounded-md border border-dashed px-lg py-xl text-center",
          over ? "border-primary bg-primary-wash" : "border-border",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <p className="text-[14px] text-text-soft">
          {t("images.drop")}{" "}
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
            className="font-semibold text-primary underline"
          >
            {t("images.browse")}
          </button>
        </p>
        <p className="text-[12px] text-text-faint">{t("images.paste")}</p>

        {busy && <Progress fraction={progress} />}
      </div>

      {error && <Problem>{error}</Problem>}

      <Picker input={input} onFile={accept} disabled={disabled} />
    </div>
  );
}

/**
 * The file input itself, kept out of the layout.
 *
 * `sr-only` rather than `display: none`, so it stays focusable and reachable —
 * a hidden input is not in the accessibility tree, and the buttons above only
 * work because this one is really there.
 */
function Picker({
  input,
  onFile,
  disabled,
}: {
  input: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  disabled: boolean;
}) {
  return (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={disabled}
      aria-label={t("images.choose")}
      className="sr-only"
      onChange={(event) => {
        onFile(event.target.files?.[0]);
        // Cleared, so choosing the same file twice in a row fires again —
        // which happens after a failed upload, and is exactly when the retry
        // matters.
        event.target.value = "";
      }}
    />
  );
}

function Progress({ fraction }: { fraction: number }) {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={t("images.uploading")}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-[6px] w-[140px] overflow-hidden rounded-full bg-neutral-fill"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {children}
    </p>
  );
}
