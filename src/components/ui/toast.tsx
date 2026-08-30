"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { t } from "@/i18n/translations";

import { Button, cx } from "./index";

/**
 * Toasts, and the undo that makes them more than a notification.
 *
 * ## Undo is the reason this exists
 *
 * Advancing an order happens hundreds of times a day. A confirmation on an
 * action at that frequency gets clicked through without being read — it costs a
 * second every time and protects nothing. So the move is instant and this
 * offers to put it back.
 *
 * That is only honest if undo genuinely reverses it, which is why it is a
 * callback the caller supplies rather than a flag: the queue undoes a status
 * move by calling the same RPC in reverse, and a caller with no way to reverse
 * an action must not offer one.
 *
 * ## Why the timer pauses on hover and focus
 *
 * Reaching for Undo takes longer than reading the toast, and a countdown that
 * expires under the cursor on its way to the button is the single most annoying
 * thing this pattern does. Pointer over it or keyboard focus inside it holds
 * the clock.
 */

export type ToastKind = "info" | "success" | "danger";

type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
  undo?: () => void | Promise<void>;
};

type Show = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<Show | null>(null);

/** How long a toast stays. Long enough to reach Undo without hurrying. */
const LIFETIME_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<Show>((toast) => {
    setToasts((current) => {
      const next = [...current, { ...toast, id: nextId.current++ }];
      // Three is enough to see a burst of orders arriving without the stack
      // covering the queue it is telling you about.
      return next.slice(-3);
    });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        // `polite`, not `assertive`: these report something that already
        // happened. Assertive interrupts whatever a screen reader is saying,
        // which for a toast every few minutes is hostile.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-sm p-lg"
      >
        {toasts.map((toast) => (
          <ToastRow
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, string> = {
  info: "bg-surface border-border text-text",
  success: "bg-surface border-accent text-text",
  danger: "bg-surface border-danger text-text",
};

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (paused || undoing) return;
    const timer = setTimeout(onDismiss, LIFETIME_MS);
    return () => clearTimeout(timer);
    // `paused` restarts the clock rather than resuming it. Simpler, and it
    // errs toward giving the operator more time rather than less.
  }, [paused, undoing, onDismiss]);

  async function undo() {
    if (!toast.undo) return;
    setUndoing(true);
    try {
      await toast.undo();
      onDismiss();
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cx(
        "pointer-events-auto flex items-center gap-lg rounded-xl border px-lg py-md shadow-overlay",
        KIND_STYLES[toast.kind],
      )}
    >
      <span className="text-[14px] font-medium">{toast.message}</span>
      {toast.undo && (
        <Button variant="quiet" size="sm" pending={undoing} onClick={undo}>
          {t("common.undo")}
        </Button>
      )}
    </div>
  );
}

/**
 * Shows a toast.
 *
 * Throws outside the provider rather than returning a no-op: a mutation that
 * silently reports nothing is worse than one that fails loudly in development,
 * because the missing feedback is exactly what nobody notices.
 */
export function useToast(): Show {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

/** Stable helpers, so callers do not rebuild the object shape each time. */
export function useToasts() {
  const show = useToast();
  return useMemo(
    () => ({
      info: (message: string, undo?: Toast["undo"]) =>
        show({ message, kind: "info", undo }),
      success: (message: string, undo?: Toast["undo"]) =>
        show({ message, kind: "success", undo }),
      danger: (message: string) => show({ message, kind: "danger" }),
    }),
    [show],
  );
}
