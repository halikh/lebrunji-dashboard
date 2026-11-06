"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui";
import { t } from "@/i18n/translations";

/**
 * The bar a form's Save lives in, pinned to the bottom of the page while it
 * scrolls — so a long answer or a policy section never pushes the button out
 * of reach. Cancel only appears once there is something to cancel.
 */
export function SaveBar({
  dirty,
  pending,
  disabled,
  saveLabel,
  onSave,
  onCancel,
  note,
}: {
  dirty: boolean;
  pending: boolean;
  disabled?: boolean;
  saveLabel: ReactNode;
  onSave: () => void;
  onCancel?: () => void;
  /** Said beside the buttons: why Save is off, or what saving will do. */
  note?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mb-2 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-line bg-surface/95 px-4 py-3 shadow-md backdrop-blur">
      {note && (
        <p className="me-auto min-w-0 text-[12.5px] text-ink-3">{note}</p>
      )}
      {onCancel && (
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
      <Button
        variant="primary"
        disabled={!dirty || disabled}
        pending={pending}
        onClick={onSave}
      >
        {saveLabel}
      </Button>
    </div>
  );
}

/**
 * The row an editor came back from (`?focus=<id>`), scrolled into view once
 * the list holds it. Returns the id so the row can draw itself as selected.
 */
export function useReturnFocus(ready: boolean): string | null {
  const focus = useSearchParams().get("focus");
  useEffect(() => {
    if (!ready || !focus) return;
    const node = document.querySelector<HTMLElement>(
      `[data-reorder-id="${CSS.escape(focus)}"]`,
    );
    node?.scrollIntoView({ block: "center" });
  }, [focus, ready]);
  return focus;
}
