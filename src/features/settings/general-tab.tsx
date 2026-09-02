"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button, Field, cx } from "@/components/ui";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";
import { chime } from "@/lib/chime";
import { uploadSound } from "@/lib/images";
import { SOUND } from "@/lib/limits";
import { BUSINESS_TIMEZONE } from "@/lib/time";

import {
  fetchAppSettings,
  updateAppSettings,
  type AppSettings,
} from "./api/app-settings";

/**
 * The three settings that belong to the business rather than to a row.
 *
 * Each was a constant in a file before migration 0093 — the trading day
 * returned a literal `8`, the chime was synthesised in JavaScript, times were
 * always 24-hour — which is fine right up until somebody wants one changed and
 * the answer is "a release".
 *
 * ## Each one saves on its own
 *
 * No Save button over the three. They are unrelated settings that happen to
 * share a screen, and a single Save would mean changing the clock format and
 * accidentally writing back an ordering window somebody was mid-way through
 * adjusting in another tab. The switch commits; the window has its own Save
 * because two selects are one decision.
 */
export function GeneralTab() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    // Read by every screen that formats a time. It changes when somebody
    // decides it does, and this screen invalidates it when they do.
    staleTime: 10 * 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateAppSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(t("general.saved"));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });

  const current = settings.data;

  /** The ordering window, held locally so the two ends are saved together. */
  const [open, setOpen] = useState<string | null>(null);
  const [close, setClose] = useState<string | null>(null);

  const openHour = open ?? String(current?.openHour ?? 8);
  const closeHour = close ?? String(current?.closeHour ?? 2);
  const windowDirty =
    current != null &&
    (Number(openHour) !== current.openHour ||
      Number(closeHour) !== current.closeHour);

  if (settings.isError) {
    return (
      <p role="alert" className="p-xxl text-[13px] font-medium text-danger">
        {t("content.failed")}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
      {/* ---- clock ------------------------------------------------------ */}
      <section className="flex flex-col gap-sm">
        <h2 className="text-[17px]">{t("general.clockTitle")}</h2>
        <Field label={t("general.clockLabel")} hint={t("general.clockHint")}>
          <Toggle
            on={current?.clock24h ?? true}
            onChange={() => save.mutate({ clock24h: !current?.clock24h })}
            disabled={!current || save.isPending}
            labelOn={t("general.clock24")}
            labelOff={t("general.clock12")}
            className="w-[132px]"
          />
        </Field>
      </section>

      {/* ---- the shift --------------------------------------------------- */}
      <section className="flex flex-col gap-sm border-t border-border pt-xxl">
        <h2 className="text-[17px]">{t("general.shiftTitle")}</h2>

        {/* The consequence, said before the control rather than discovered
            afterwards. Moving the opening hour moves what "today" means on the
            queue and in every report — `business_day_starts_at()` reads this
            column — which is a much larger change than the two dropdowns look
            like. */}
        <p className="text-[13px] text-text-soft">{t("general.shiftBlurb")}</p>

        <div className="flex flex-wrap items-end gap-lg">
          <div className="w-[140px]">
            <Field label={t("general.opensAt")}>
              <Select
                value={openHour}
                onChange={setOpen}
                options={HOURS}
                disabled={!current}
              />
            </Field>
          </div>

          <div className="w-[140px]">
            <Field label={t("general.closesAt")}>
              <Select
                value={closeHour}
                onChange={setClose}
                options={HOURS}
                disabled={!current}
              />
            </Field>
          </div>

          <Button
            disabled={!windowDirty}
            pending={save.isPending}
            onClick={() =>
              save.mutate(
                { openHour: Number(openHour), closeHour: Number(closeHour) },
                {
                  onSuccess: () => {
                    setOpen(null);
                    setClose(null);
                  },
                },
              )
            }
          >
            {t("general.saveShift")}
          </Button>
        </div>

        {/* Closing before opening is not a mistake here — it is a shop open
            past midnight, which is the ordinary case in this business. Said out
            loud because it looks wrong at a glance, and the database
            deliberately has no constraint that would "correct" it. */}
        {Number(closeHour) <= Number(openHour) && (
          <p className="text-[12px] font-semibold text-active-ink">
            {t("general.overnight", {
              open: label(Number(openHour)),
              close: label(Number(closeHour)),
            })}
          </p>
        )}

        <p className="text-[11px] text-text-faint">
          {t("promotions.inZone", { zone: BUSINESS_TIMEZONE })}
        </p>
      </section>

      {/* ---- the sound --------------------------------------------------- */}
      <section className="flex flex-col gap-sm border-t border-border pt-xxl">
        <h2 className="text-[17px]">{t("general.soundTitle")}</h2>
        <p className="text-[13px] text-text-soft">{t("general.soundBlurb")}</p>

        <SoundPicker
          url={current?.notificationSoundUrl ?? null}
          onChange={(next) => save.mutate({ notificationSoundUrl: next })}
          pending={save.isPending}
        />
      </section>
    </div>
  );
}

/**
 * Choosing, hearing and clearing the new-order sound.
 *
 * ## Playing it is not optional
 *
 * A sound is the one setting you cannot check by looking. Without a preview the
 * operator uploads a file, sees a filename, and finds out whether it was the
 * right one at the moment an order arrives during service — which is the worst
 * possible time to discover it is three minutes of music.
 *
 * ## Clearing goes back to the built-in chime, not to silence
 *
 * The whole point of the sound is that it fires when nobody is looking at the
 * screen. "None" would be a setting whose effect is that orders arrive
 * unannounced, which is the failure the chime exists to prevent — so the
 * absence of a file means the synthesised one, and the button says so.
 */
function SoundPicker({
  url,
  onChange,
  pending,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
  pending: boolean;
}) {
  const toast = useToasts();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function accept(file: File | undefined) {
    if (!file) return;
    setProgress(0);
    try {
      const uploaded = await uploadSound(file, { onProgress: setProgress });
      onChange(uploaded.url);
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <Button
          variant="secondary"
          disabled={busy || pending}
          onClick={() => input.current?.click()}
        >
          {url ? t("general.soundReplace") : t("general.soundChoose")}
        </Button>

        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            // The real thing: the same function the queue calls, so what is
            // heard here is what will be heard then.
            void chime(url);
          }}
        >
          {t("general.soundPlay")}
        </Button>

        {url && (
          <Button
            variant="danger"
            disabled={busy || pending}
            onClick={() => onChange(null)}
          >
            {t("general.soundClear")}
          </Button>
        )}
      </div>

      <p className="text-[12px] text-text-faint">
        {url ? t("general.soundCustom") : t("general.soundBuiltIn")}
        {" · "}
        {t("general.soundLimits", {
          size: Math.round(SOUND.maxBytes / 1024),
          seconds: SOUND.maxSeconds,
        })}
      </p>

      {busy && (
        <div
          role="progressbar"
          aria-label={t("images.uploading")}
          aria-valuenow={Math.round((progress ?? 0) * 100)}
          className="h-[6px] w-[140px] overflow-hidden rounded-full bg-neutral-fill"
        >
          <div
            className={cx("h-full rounded-full bg-primary transition-[width]")}
            style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
          />
        </div>
      )}

      {/* `sr-only`, not hidden: a `display: none` input is out of the
          accessibility tree, and the button above only works because this one
          is really there. */}
      <input
        ref={input}
        type="file"
        accept="audio/mpeg,.mp3"
        aria-label={t("general.soundChoose")}
        className="sr-only"
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          // Cleared, so choosing the same file twice in a row fires again —
          // which is exactly what happens after a failed upload.
          event.target.value = "";
        }}
      />
    </div>
  );
}

/** `00` to `23`, as the select wants them. */
const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: label(hour),
}));

/**
 * An hour on a 24-hour clock, always.
 *
 * Not the shop's own `clock24h` setting: this control *sets* that kind of
 * thing, and a picker whose labels changed as you changed the format would be
 * a mirror looking at itself. `08:00` is unambiguous either way.
 */
function label(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
