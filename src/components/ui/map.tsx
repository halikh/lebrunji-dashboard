"use client";

import { useState } from "react";

import { t, type TranslationKey } from "@/i18n/translations";

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
 * needs a draggable pin — the store wizard — this component grows a library
 * behind the same interface, and nothing that renders a map moves.
 *
 * ## Why the picture is OSM and the link is Google
 *
 * Two different jobs. The embed answers *where is this* at a glance, and OSM
 * does that without a key. The link is pressed when somebody is about to
 * **drive there** — and that is Google Maps, because it is what the courier
 * already has open, what knows the traffic, and what a phone will hand to
 * turn-by-turn navigation. Sending them to a map they would then have to copy
 * an address out of is the wrong end of a delivery.
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
  emptyKey = "map.noPin",
  zoom = 16,
  className,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  /** What the pin is, for the frame's accessible name. */
  label: string;
  /**
   * What to say when there is no pin.
   *
   * The default is written for an order's delivery address, where "no location
   * saved for this address" is exactly right. On a shop's settings page there
   * is no address and nothing has been saved yet, so the same sentence is
   * quietly wrong — it describes a failure where the truth is simply "not
   * filled in".
   */
  emptyKey?: TranslationKey;
  zoom?: number;
  className?: string;
}) {
  const hasPin = typeof latitude === "number" && typeof longitude === "number";
  const [engaged, setEngaged] = useState(false);
  // Bumped to send the map back to the pin — see the button below.
  const [view, setView] = useState(0);

  if (!hasPin) {
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-md border border-border bg-neutral-fill px-lg py-xl text-center",
          className,
        )}
      >
        <span className="text-[13px] text-text-faint">{t(emptyKey)}</span>
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
      {/* `flex-1` with a floor, so the frame fills whatever height the caller
          gives the map — a 300px box used to hold a 200px map and a gap — and
          is still 200 tall where nobody says. */}
      <div
        className="relative flex min-h-[200px] flex-1"
        onMouseLeave={() => setEngaged(false)}
      >
        <iframe
          // Keyed on `view`: a new key is a new frame, loaded fresh at the pin.
          key={view}
          // Named, because an unlabelled frame is announced as "frame" and
          // nothing else.
          title={label}
          src={source.toString()}
          loading="lazy"
          // The embed needs scripts to draw itself and its own origin to fetch
          // tiles as itself; navigating the page it sits in, forms and plugins
          // stay denied. `allow-same-origin` hands the frame *its* origin, not
          // ours — which is safe precisely because the frame is cross-origin —
          // and the popup permissions are what make OpenStreetMap's attribution
          // links clickable, which the tile licence asks for.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          // OpenStreetMap's volunteer tile servers refuse traffic they cannot
          // attribute to an app, and answer with an "Access blocked" tile rather
          // than a map. Traffic from an opaque sandbox origin, or with its
          // referrer stripped, is exactly that unattributable traffic. So the
          // frame sends our origin — scheme and host, never the path a customer
          // is looking at and never a query string with an order id in it.
          referrerPolicy="origin"
          className="h-full min-h-[200px] w-full rounded-md border border-border bg-neutral-fill"
        />
        {/* A shield over the frame until it is clicked.

          The map sits inside things that scroll — the order panel above all —
          and a wheel over a live map zooms it instead of scrolling the page, so
          reading down a receipt kept zooming the map out from under the pin.
          The embed is cross-origin, so its wheel handling cannot be switched
          off from here; covering it is the only lever. A click hands the map
          the pointer (pan, zoom, the attribution links), and leaving it puts
          the shield back. */}
        {!engaged && (
          <button
            type="button"
            onClick={() => setEngaged(true)}
            aria-label={t("map.engage")}
            className="group absolute inset-0 flex items-end justify-center rounded-md p-sm"
          >
            <span className="rounded-full bg-surface px-md py-xxs text-[12px] font-semibold text-text-soft opacity-0 shadow-card transition-opacity group-hover:opacity-100">
              {t("map.engage")}
            </span>
          </button>
        )}

        {/* Back to the pin, after panning off it or zooming far in or out.

          The embed is cross-origin, so its view cannot be set from here —
          reloading it is the lever, and a reload starts exactly where the map
          first opened: centred on the pin at the original zoom. Above the
          shield, so it works whether or not the map has been clicked into,
          and it hands the pointer back to the page as it resets. */}
        <button
          type="button"
          onClick={() => {
            setView((current) => current + 1);
            setEngaged(false);
          }}
          aria-label={t("map.recenter")}
          title={t("map.recenter")}
          className="absolute end-sm top-sm z-10 flex size-[36px] items-center justify-center rounded-full bg-surface text-text shadow-[0_2px_8px_rgba(31,25,21,0.19)] hover:bg-neutral-fill"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {/* A crosshair — the conventional "my location / centre" mark. */}
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
        </button>
      </div>
      <a
        // Google Maps, by coordinates rather than by address text: the pin
        // lands exactly where the customer put it, with no geocoder in between
        // guessing at a street name. On a phone this opens the Maps app, which
        // is one tap from directions.
        href={`https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`}
        target="_blank"
        rel="noreferrer noopener"
        className="self-start text-[13px] font-semibold text-primary hover:underline"
      >
        {t("map.openLarger")}
      </a>
    </div>
  );
}
