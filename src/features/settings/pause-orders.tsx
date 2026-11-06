"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  Notice,
  Segmented,
} from "@/components/ui";
import { SettingRow, SettingsGroup } from "@/components/ui/setting-row";
import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";
import { fromWallClock, toWallClock } from "@/lib/time";

import {
  fetchOrderingPause,
  pauseHolds,
  updateOrderingPause,
  type AppSettings,
} from "./api/app-settings";
import { appSettingsKey, useClock } from "./use-clock";

const pauseKey = ["ordering-pause"] as const;

type Length = "30" | "60" | "120" | "rest" | "manual";

/** The database's own limit on each message (0256). */
const NOTE_MAX = 160;

/** The next time the business clock reads `hour`:00 — after `now`, never at it. */
function nextHour(hour: number, now: Date): Date {
  const wall = toWallClock(now);
  const today = fromWallClock({
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour,
  });
  if (today.getTime() > now.getTime()) return today;
  // `Date.UTC` rolls day 32 into the next month, so this is tomorrow's.
  return fromWallClock({
    year: wall.year,
    month: wall.month,
    day: wall.day + 1,
    hour,
  });
}

/** Whether the business clock at `now` is inside the window — the app's and `0256`'s rule. */
function inHours(settings: AppSettings, now: Date): boolean {
  const { openHour: open, closeHour: close } = settings;
  const hour = toWallClock(now).hour;
  if (open === close) return true;
  if (open < close) return hour >= open && hour < close;
  return hour >= open || hour < close;
}

/** Re-renders every 30 s, so a pause with an end shows as lifted when it does. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Stop new orders now, and start them again (`0256`).
 *
 * The window above is the ordinary week; this is for the night that is not
 * ordinary. Modelled on a status-page "pause" rather than a setting: what is
 * happening now is the first thing in the row, in a badge, and the action
 * beside it is the one that changes it.
 *
 * ## A pause with an end is the default
 *
 * "Rest of tonight" lifts at the opening hour by itself. A pause that waits
 * for somebody to remember it is the failure that costs a whole morning, so
 * "Until I resume" is offered, not suggested.
 */
export function PauseOrders({ settings }: { settings: AppSettings }) {
  const queryClient = useQueryClient();
  const toast = useToasts();
  const clock = useClock();
  const now = useNow();

  const pause = useQuery({ queryKey: pauseKey, queryFn: fetchOrderingPause });

  const [asking, setAsking] = useState(false);
  const [length, setLength] = useState<Length>("rest");
  const [noteEn, setNoteEn] = useState("");
  const [noteAr, setNoteAr] = useState("");

  const save = useMutation({
    mutationFn: updateOrderingPause,
    onSuccess: (_result, next) => {
      void queryClient.invalidateQueries({ queryKey: pauseKey });
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      toast.success(
        t(next.paused ? "general.savedPause" : "general.savedResume"),
      );
      setAsking(false);
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });

  if (pause.isPending) return null;
  if (pause.isError) return null;

  if (pause.data === null) {
    return (
      <SettingsGroup title={t("general.pauseTitle")}>
        <div className="px-5 py-4">
          <Notice tone="info">{t("general.pauseMissing")}</Notice>
        </div>
      </SettingsGroup>
    );
  }

  const current = pause.data;
  const holding = pauseHolds(current, now.getTime());
  const open = inHours(settings, now);

  const untilFor = (choice: Length): Date | null => {
    if (choice === "manual") return null;
    if (choice === "rest") return nextHour(settings.openHour, now);
    return new Date(now.getTime() + Number(choice) * 60_000);
  };
  const until = untilFor(length);

  const status = holding ? (
    <Badge tone="danger" dot>
      {current.until
        ? t("general.pausedUntil", { time: clock.dayAndTime(current.until) })
        : t("general.pausedOpen")}
    </Badge>
  ) : open ? (
    <Badge tone="success" dot>
      {t("general.pauseTaking")}
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      {t("general.pauseClosed")}
    </Badge>
  );

  return (
    <SettingsGroup
      title={t("general.pauseTitle")}
      description={t("general.pauseBlurb")}
    >
      <SettingRow label={t("general.pauseLabel")} description={status}>
        {holding ? (
          <Button
            variant="primary"
            pending={save.isPending}
            onClick={() =>
              save.mutate({
                paused: false,
                until: null,
                note: { en: "", ar: "" },
              })
            }
          >
            <PlayCircle />
            {t("general.resumeButton")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              // Last pause's words as a start — a rainy night is often the
              // second rainy night.
              setNoteEn(current.note.en);
              setNoteAr(current.note.ar);
              setLength("rest");
              setAsking(true);
            }}
          >
            <PauseCircle />
            {t("general.pauseButton")}
          </Button>
        )}
      </SettingRow>

      <Dialog
        open={asking}
        onOpenChange={(next) => !next && setAsking(false)}
        title={t("general.pauseDialogTitle")}
        description={t("general.pauseDialogBody")}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setAsking(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              pending={save.isPending}
              onClick={() =>
                save.mutate({
                  paused: true,
                  // Re-read at the press: the dialog may have stood open a while.
                  until: untilFor(length)?.toISOString() ?? null,
                  note: { en: noteEn, ar: noteAr },
                })
              }
            >
              {t("general.pauseConfirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink-2">
              {t("general.pauseFor")}
            </span>
            <Segmented
              value={length}
              onChange={setLength}
              size="sm"
              items={[
                { key: "30", label: t("general.pause30") },
                { key: "60", label: t("general.pause60") },
                { key: "120", label: t("general.pause120") },
                { key: "rest", label: t("general.pauseRest") },
                { key: "manual", label: t("general.pauseManual") },
              ]}
            />
            <p className="text-[12.5px] text-ink-4">
              {length === "manual"
                ? t("general.pauseManualHint")
                : length === "rest"
                  ? t("general.pauseRestHint", {
                      time: clock.hour(settings.openHour),
                    })
                  : t("general.pauseLiftsAt", {
                      time: clock.time(until as Date),
                    })}
            </p>
          </div>

          <Field
            label={t("general.pauseNoteEn")}
            hint={t("general.pauseNoteHint")}
            optional={t("form.optional")}
          >
            {(props) => (
              <Input
                {...props}
                value={noteEn}
                maxLength={NOTE_MAX}
                onChange={(event) => setNoteEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("general.pauseNoteAr")} optional={t("form.optional")}>
            {(props) => (
              <Input
                {...props}
                dir="rtl"
                lang="ar"
                value={noteAr}
                maxLength={NOTE_MAX}
                onChange={(event) => setNoteAr(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>
    </SettingsGroup>
  );
}
