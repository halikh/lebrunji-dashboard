"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Moon,
  Music,
  Play,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Segmented,
  Skeleton,
} from "@/components/ui";
import { Select } from "@/components/ui/select";
import { SettingRow, SettingsGroup } from "@/components/ui/setting-row";
import { useToasts } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";
import { chime } from "@/lib/chime";
import { uploadSound } from "@/lib/images";
import { SOUND } from "@/lib/limits";
import { businessTimezone } from "@/lib/time";

import {
  fetchTimezones,
  updateAppSettings,
  type AppSettings,
} from "./api/app-settings";
import { PauseOrders } from "./pause-orders";
import { appSettingsKey, useAppSettings, useClock } from "./use-clock";

/**
 * Which "saved" a save was — keyed off what the patch touched, so two saves a
 * second apart do not stack two identical "Saved" toasts.
 */
function savedKey(patch: Partial<AppSettings>) {
  if (patch.clock24h !== undefined) return "general.savedClock" as const;
  if (patch.timezone !== undefined) return "general.savedZone" as const;
  if (patch.notificationSoundUrl !== undefined) {
    return "general.savedSound" as const;
  }
  if (patch.openHour !== undefined || patch.closeHour !== undefined) {
    return "general.savedHours" as const;
  }
  return "general.saved" as const;
}

/**
 * The settings that belong to the business rather than to a row.
 *
 * ## Each one saves on its own
 *
 * Laid out as Linear and Stripe lay out settings: one row per setting, the
 * consequence written beside the control.
 *
 * No Save over the lot. They are unrelated settings that share a screen, and
 * one Save would mean flipping the clock format and accidentally writing back
 * an ordering window somebody was mid-way through in another tab. The clock
 * commits on the spot; the zone asks first (it moves every time in the app and
 * every report day); the window has its own Save because two hours are one
 * decision.
 */
export function GeneralTab() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  // The same query every screen that shows a time reads, so the invalidation
  // below is what re-formats all of them.
  const settings = useAppSettings();
  const clock = useClock();
  const zones = useQuery({
    queryKey: ["timezones"],
    queryFn: fetchTimezones,
    staleTime: 10 * 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateAppSettings(patch),
    onSuccess: (_result, patch) => {
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      toast.success(t(savedKey(patch)));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });

  const current = settings.data;

  /** The ordering window, held locally so both ends are saved together. */
  const [open, setOpen] = useState<string | null>(null);
  const [close, setClose] = useState<string | null>(null);
  const openHour = open ?? String(current?.openHour ?? 8);
  const closeHour = close ?? String(current?.closeHour ?? 2);
  const windowDirty =
    current != null &&
    (Number(openHour) !== current.openHour ||
      Number(closeHour) !== current.closeHour);

  /** A zone picked and waiting for the operator to confirm it. */
  const [pendingZone, setPendingZone] = useState<string | null>(null);

  // Before the early returns: a hook cannot be conditional.
  useUnsavedChanges(windowDirty);

  if (settings.isError) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("content.failed")}
        action={
          <Button onClick={() => void settings.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        {[0, 1, 2].map((one) => (
          <Skeleton key={one} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  const zoneLabel = (name: string) => {
    const zone = zones.data?.find((one) => one.name === name);
    return zone ? zone.label : name;
  };
  const hours = hourOptions(clock.hour);
  const overnight = Number(closeHour) < Number(openHour);
  const allDay = Number(closeHour) === Number(openHour);

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup
        title={t("general.clockTitle")}
        description={t("general.clockBlurb")}
      >
        <SettingRow
          id="setting-clock"
          label={t("general.clockLabel")}
          description={t("general.clockHint")}
        >
          {/* Saves on the spot, like a Linear preference: it is one click
              to put back and changes nothing but how times are written. */}
          <div role="group" aria-labelledby="setting-clock">
            <Segmented
              className="w-fit"
              value={current.clock24h ? "24" : "12"}
              onChange={(next) => {
                const clock24h = next === "24";
                if (clock24h !== current.clock24h) save.mutate({ clock24h });
              }}
              items={[
                { key: "24", label: t("general.clock24") },
                { key: "12", label: t("general.clock12") },
              ]}
            />
          </div>
        </SettingRow>

        {/* Hidden until 0183 is applied: no list, nothing to choose. */}
        {(zones.data?.length ?? 0) > 0 && (
          <SettingRow
            id="setting-zone"
            label={t("general.zoneLabel")}
            description={t("general.zoneHint")}
          >
            <Select
              aria-label={t("general.zoneLabel")}
              className="w-full md:w-72"
              value={current.timezone ?? businessTimezone()}
              disabled={save.isPending}
              onChange={(next) => {
                // Not saved yet: a zone moves every time and every report
                // day, so it asks first (the dialog below).
                if (next && next !== current.timezone) setPendingZone(next);
              }}
              // A person's name for it, with the IANA id it stores — both
              // searchable, so "Beirut" and "Asia/Beirut" each find it.
              options={(zones.data ?? []).map((zone) => ({
                value: zone.name,
                label: zone.label,
                note: zone.name,
              }))}
            />
          </SettingRow>
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t("general.shiftTitle")}
        // The consequence, before the control: the closing hour is also where
        // "today" ends on the queue and in every report (0275).
        description={t("general.shiftBlurb")}
      >
        <SettingRow
          label={t("general.hoursLabel")}
          description={t("general.shiftZone", {
            zone: zoneLabel(current.timezone ?? businessTimezone()),
          })}
          footer={
            (overnight || allDay || windowDirty) && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Closing before opening is not a mistake: a shop open past
                    midnight is the ordinary case, and the database
                    deliberately has no constraint that would "correct" it.
                    Said out loud because it looks wrong at a glance. */}
                {overnight || allDay ? (
                  <p className="flex items-center gap-2 text-[13px] font-medium text-info-ink">
                    <Moon className="size-4 shrink-0" aria-hidden />
                    {allDay
                      ? t("general.shiftSameHour")
                      : t("general.overnight", {
                          open: clock.hour(Number(openHour)),
                          close: clock.hour(Number(closeHour)),
                        })}
                  </p>
                ) : (
                  <span />
                )}
                {/* Two hours are one decision, so they have one Save — shown
                    only once there is something to save, the way Stripe's
                    inline settings do. */}
                {windowDirty && (
                  <div className="ms-auto flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={save.isPending}
                      onClick={() => {
                        setOpen(null);
                        setClose(null);
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      pending={save.isPending}
                      onClick={() =>
                        save.mutate(
                          {
                            openHour: Number(openHour),
                            closeHour: Number(closeHour),
                          },
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
                )}
              </div>
            )
          }
        >
          <div className="grid w-full grid-cols-2 gap-3 md:w-auto">
            <Field label={t("general.opensAt")} className="md:w-36">
              {(props) => (
                <Select
                  {...props}
                  value={openHour}
                  onChange={(next) => next && setOpen(next)}
                  options={hours}
                />
              )}
            </Field>
            <Field label={t("general.closesAt")} className="md:w-36">
              {(props) => (
                <Select
                  {...props}
                  value={closeHour}
                  onChange={(next) => next && setClose(next)}
                  options={hours}
                />
              )}
            </Field>
          </div>
        </SettingRow>
      </SettingsGroup>

      <PauseOrders settings={current} />

      <SettingsGroup title={t("general.alertsTitle")}>
        <SoundPicker
          url={current.notificationSoundUrl}
          onChange={(next) => save.mutate({ notificationSoundUrl: next })}
          pending={save.isPending}
        />
      </SettingsGroup>

      <ConfirmDialog
        open={pendingZone !== null}
        onOpenChange={(next) => !next && setPendingZone(null)}
        title={t("general.zoneConfirmTitle", {
          zone: zoneLabel(pendingZone ?? ""),
        })}
        description={t("general.zoneConfirmBody", {
          zone: zoneLabel(pendingZone ?? ""),
        })}
        confirmLabel={t("general.zoneConfirm")}
        onConfirm={async () => {
          if (!pendingZone) return;
          // The mutation toasts its own failure; the dialog just closes.
          await save
            .mutateAsync({ timezone: pendingZone })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}

/**
 * Choosing, hearing and clearing the new-order sound.
 *
 * Playing it is not optional: a sound is the one setting you cannot check by
 * looking, and finding out it is three minutes of music when an order lands
 * during service is the worst time to. Clearing goes back to the built-in
 * chime, never to silence — orders arriving unannounced is the failure the
 * chime exists to prevent.
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
  const percent = Math.round((progress ?? 0) * 100);

  return (
    <SettingRow
      label={t("general.soundTitle")}
      description={
        <div className="flex flex-col gap-1.5">
          <p>{t("general.soundBlurb")}</p>
          <p className="flex items-center gap-2 text-ink-2">
            <Music className="size-3.5 shrink-0 text-ink-4" aria-hidden />
            <span className="font-medium">
              {url ? t("general.soundCustom") : t("general.soundBuiltIn")}
            </span>
          </p>
          <p className="text-[12.5px] text-ink-4">
            {t("general.soundLimits", {
              size: Math.round(SOUND.maxBytes / 1024),
              seconds: SOUND.maxSeconds,
            })}
          </p>
        </div>
      }
      footer={
        busy && (
          <div
            role="progressbar"
            aria-label={t("images.uploading")}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-hover"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        )
      }
    >
      <Button
        variant="secondary"
        disabled={busy}
        // The real thing: the same function the queue calls, so what is
        // heard here is what will be heard then.
        onClick={() => void chime(url)}
      >
        <Play />
        {t("general.soundPlay")}
      </Button>
      <Button
        variant="secondary"
        disabled={busy || pending}
        pending={busy}
        onClick={() => input.current?.click()}
      >
        <Upload />
        {url ? t("general.soundReplace") : t("general.soundChoose")}
      </Button>
      {url && (
        <Button
          variant="ghost"
          disabled={busy || pending}
          onClick={() => onChange(null)}
        >
          <RotateCcw />
          {t("general.soundClear")}
        </Button>
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
    </SettingRow>
  );
}

/**
 * `00` to `23`, labelled in the shop's own format. The *value* is the hour and
 * never moves; only the label follows the clock setting above it.
 */
function hourOptions(label: (hour: number) => string) {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: label(hour),
  }));
}
