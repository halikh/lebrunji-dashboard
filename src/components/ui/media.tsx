"use client";

import { Check, Copy, ExternalLink, ImageOff, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { t, type TranslationKey } from "@/i18n/translations";

import { cx } from "./cx";

/**
 * A pin on an OpenStreetMap embed. A shield covers it until clicked, so a
 * wheel over the map scrolls the page instead of zooming the map.
 */
export function MapView({
  latitude,
  longitude,
  label,
  emptyKey = "map.noPin",
  zoom = 16,
  className,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  label: string;
  emptyKey?: TranslationKey;
  zoom?: number;
  className?: string;
}) {
  const [engaged, setEngaged] = useState(false);
  const [view, setView] = useState(0);

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-md border border-dashed border-line-strong bg-subtle px-4 py-8 text-center text-[13px] text-ink-3",
          className,
        )}
      >
        {t(emptyKey)}
      </div>
    );
  }

  const span = 0.32 / 2 ** (zoom - 12);
  const source = new URL("https://www.openstreetmap.org/export/embed.html");
  source.searchParams.set(
    "bbox",
    [
      longitude - span,
      latitude - span / 2,
      longitude + span,
      latitude + span / 2,
    ].join(","),
  );
  source.searchParams.set("layer", "mapnik");
  source.searchParams.set("marker", `${latitude},${longitude}`);

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div
        className="relative h-[200px] overflow-hidden rounded-md border border-line"
        onMouseLeave={() => setEngaged(false)}
      >
        <iframe
          key={view}
          title={label}
          src={source.toString()}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="origin"
          className="size-full bg-subtle"
        />
        {!engaged && (
          <button
            type="button"
            onClick={() => setEngaged(true)}
            aria-label={t("map.engage")}
            className="group absolute inset-0 flex items-end justify-center p-2"
          >
            <span className="rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-ink-2 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {t("map.engage")}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setView((v) => v + 1);
            setEngaged(false);
          }}
          aria-label={t("map.recenter")}
          title={t("map.recenter")}
          className="absolute end-2 top-2 z-10 flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-2 shadow-sm hover:bg-hover"
        >
          <LocateFixed className="size-4" />
        </button>
      </div>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-hover"
      >
        {t("map.openLarger")}
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

/** Text with a copy button beside it — order codes and phone numbers. */
export function Copyable({
  value,
  label,
  href,
  children,
  className,
}: {
  value: string;
  label: string;
  /** Makes the text itself a link (`tel:` for a phone). */
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (insecure context or denied) — the text is still selectable.
    }
  }

  const text = children ?? value;
  return (
    <span className={cx("group inline-flex items-center gap-1.5", className)}>
      {href ? (
        <a href={href} className="hover:underline">
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? t("common.copied") : label}
        title={copied ? t("common.copied") : label}
        className="flex size-6 items-center justify-center rounded text-ink-4 transition-colors hover:bg-hover hover:text-ink"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </span>
  );
}

/** A square picture, or a quiet placeholder when there is none. */
export function Thumb({
  src,
  size = 40,
  alt = "",
  rounded = "md",
  className,
}: {
  src: string | null | undefined;
  size?: number;
  alt?: string;
  rounded?: "md" | "full";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const shape = rounded === "full" ? "rounded-full" : "rounded-md";
  if (!src || broken) {
    return (
      <span
        aria-hidden
        className={cx(
          "flex shrink-0 items-center justify-center border border-line bg-subtle text-ink-4",
          shape,
          className,
        )}
        style={{ width: size, height: size }}
      >
        <ImageOff
          style={{ width: size * 0.4, height: size * 0.4 }}
          strokeWidth={1.6}
        />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cx(
        "shrink-0 border border-line bg-subtle object-cover",
        shape,
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
