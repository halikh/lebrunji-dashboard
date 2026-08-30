"use client";

import { t } from "@/i18n/translations";

import { cx } from "./index";

/**
 * A map showing one point.
 *
 * ## Why an OpenStreetMap embed rather than a map library
 *
 * The dashboard needs to answer one question — *where is this?* — for a single
 * pin, on one screen. Leaflet or Google Maps would answer it and bring a
 * dependency, a stylesheet, a tile budget, and in Google's case an API key that
 * has to live somewhere and be restricted by referrer.
 *
 * OpenStreetMap's embed needs none of that: no key, no bundle, no build step.
 * The cost is that the pin cannot be styled and the map cannot be driven from
 * code, which for a read-only "where is this" is not a cost.
 *
 * **The seam is the props, not the implementation.** When a screen genuinely
 * needs a draggable pin — the store wizard, in Phase 4 — this component grows a
 * library behind the same interface, and nothing that renders a map moves.
 *
 * ## Why it takes coordinates rather than an address
 *
 * Geocoding a string is a network call with a licence attached, an accuracy
 * question, and a bill. The database already holds the pin a customer dropped;
 * this renders that. Where there is no pin the component says so rather than
 * guessing a location from text — a map showing the wrong building is worse
 * than no map, because it looks authoritative.
 */
export function Map({
  latitude,
  longitude,
  label,
  zoom = 16,
  className,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  /** What the pin is, for the frame's accessible name. */
  label: string;
  zoom?: number;
  className?: string;
}) {
  const hasPin = typeof latitude === "number" && typeof longitude === "number";

  if (!hasPin) {
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-md border border-border bg-neutral-fill px-lg py-xl text-center",
          className,
        )}
      >
        <span className="text-[13px] text-text-faint">{t("map.noPin")}</span>
      </div>
    );
  }

  // The bounding box is the pin plus a margin. OpenStreetMap's embed takes a
  // box rather than a centre and a zoom, so the zoom is expressed as how much
  // ground the box covers — smaller span, closer in.
  const span = 0.32 / 2 ** (zoom - 12);
  const bbox = [
    longitude - span,
    latitude - span / 2,
    longitude + span,
    latitude + span / 2,
  ];

  const source = new URL("https://www.openstreetmap.org/export/embed.html");
  source.searchParams.set("bbox", bbox.join(","));
  source.searchParams.set("layer", "mapnik");
  source.searchParams.set("marker", `${latitude},${longitude}`);

  return (
    <div className={cx("flex flex-col gap-xs", className)}>
      <iframe
        // Named, because an unlabelled frame is announced as "frame" and
        // nothing else.
        title={label}
        src={source.toString()}
        loading="lazy"
        // Nothing in an embedded map needs scripts from us, storage, or the
        // ability to navigate the page it sits in. Stated rather than assumed.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-[200px] w-full rounded-md border border-border bg-neutral-fill"
      />
      <a
        // Opens the real map, where the operator can zoom, get directions, or
        // hand the coordinates to a courier. The embed deliberately does none
        // of that.
        href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`}
        target="_blank"
        rel="noreferrer noopener"
        className="self-start text-[13px] font-semibold text-primary hover:underline"
      >
        {t("map.openLarger")}
      </a>
    </div>
  );
}
