"use client";

import type { ReactNode } from "react";

import { Field, Input, MapView, cx } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { t, type TranslationKey } from "@/i18n/translations";
import type { Located } from "@/lib/location";

/**
 * Pieces the shop and branch forms share, so the same question is asked the
 * same way on the new-shop page, the Details tab and a branch's page.
 */

/** The message for a pin that could not be read — three causes, three fixes. */
export function pinProblem(
  located: Located,
  { required }: { required: boolean },
): string | undefined {
  if (located.ok) return undefined;
  if (located.reason === "empty") {
    return required ? t("branches.pinRequired") : undefined;
  }
  // A shortened link has an obvious next step, and saying so beats "that is
  // not a coordinate pair" about something that plainly is a map link.
  return located.reason === "shortened"
    ? t("store.pinShortened")
    : t("store.pinInvalid");
}

/**
 * The pin: a box to paste a map link or coordinates into, and the marker it
 * makes beside it. A pair of numbers is not something anybody can check by
 * reading; a marker on a map is.
 */
export function PinField({
  value,
  onChange,
  located,
  error,
  label,
  hint,
  mapLabel,
  emptyKey = "store.noPinYet",
}: {
  value: string;
  onChange: (value: string) => void;
  located: Located;
  error?: string;
  label: string;
  hint: string;
  mapLabel: string;
  emptyKey?: TranslationKey;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
      <Field label={label} hint={hint} error={error}>
        {(wiring) => (
          <Input
            {...wiring}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t("store.pinPlaceholder")}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <MapView
        latitude={located.ok ? located.latitude : null}
        longitude={located.ok ? located.longitude : null}
        label={mapLabel}
        emptyKey={emptyKey}
      />
    </div>
  );
}

/** Fastest to slowest, in minutes — the range the app quotes a customer. */
export function PrepWindowField({
  min,
  max,
  onMin,
  onMax,
  error,
  label = t("store.prep"),
  hint = t("store.prepHint"),
}: {
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  error?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(wiring) => (
        <div className="flex flex-wrap items-center gap-2">
          <NumberInput
            id={wiring.id}
            aria-describedby={wiring["aria-describedby"]}
            aria-invalid={wiring["aria-invalid"]}
            aria-label={t("store.prepMin")}
            value={min}
            onChange={(event) => onMin(event.target.value)}
            min={0}
            step={1}
            inputMode="numeric"
            className="w-24"
          />
          <span className="text-[13px] text-ink-3">{t("store.prepTo")}</span>
          <NumberInput
            aria-describedby={wiring["aria-describedby"]}
            aria-invalid={wiring["aria-invalid"]}
            aria-label={t("store.prepMax")}
            value={max}
            onChange={(event) => onMax(event.target.value)}
            min={0}
            step={1}
            inputMode="numeric"
            className="w-24"
          />
          <span className="text-[13px] text-ink-3">{t("store.minutes")}</span>
        </div>
      )}
    </Field>
  );
}

/**
 * The bar at the foot of a form: what is pending on the left, the actions on
 * the right. Sticky to the bottom of the page's scroll area, so Save is never
 * below the fold on a long form.
 */
export function SaveBar({
  status,
  children,
  className,
}: {
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      {status && (
        <p role="status" className="me-auto min-w-0 text-[13px] text-ink-3">
          {status}
        </p>
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/** A coloured note inside a form — a consequence the operator should read. */
export function Notice({
  tone = "warning",
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "warning" | "info" | "danger";
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const tones = {
    warning: "border-warning/25 bg-warning-soft text-warning-ink",
    info: "border-info/20 bg-info-soft text-info-ink",
    danger: "border-danger/20 bg-danger-soft text-danger-ink",
  } as const;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-[13.5px]",
        tones[tone],
        className,
      )}
    >
      {icon && (
        <span className="mt-0.5 shrink-0 [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-snug">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Scrolls the first invalid control into view and focuses it. */
export function revealFirstError() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>(
      "[aria-invalid='true'], [data-invalid='true']",
    );
    if (!field) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  });
}
