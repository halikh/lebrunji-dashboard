"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui";
import { t } from "@/i18n/translations";
import { soundLocked, subscribeSoundLock, unlock } from "@/lib/chime";

/**
 * A bar across the top while the browser is keeping the new-order chime
 * silent — see `soundLocked`. One click on it is the interaction the browser
 * is waiting for, so pressing it is the fix as well as the message. It goes
 * away by itself on any other click too.
 */
export function SoundLock() {
  const locked = useSyncExternalStore(
    subscribeSoundLock,
    soundLocked,
    () => false,
  );
  if (!locked) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-[13.5px] text-warning-ink"
    >
      <VolumeX aria-hidden className="size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{t("shell.soundLocked")}</span>
        <span className="text-[12.5px] opacity-80">
          {t("shell.soundForGood")}
        </span>
      </span>
      <Button size="sm" variant="secondary" onClick={() => unlock()}>
        <Volume2 />
        {t("shell.soundTurnOn")}
      </Button>
    </div>
  );
}
