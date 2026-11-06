"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Toaster, toast as sonner } from "sonner";

import { t } from "@/i18n/translations";

/*
 * Toasts, on sonner, behind the interface the data hooks already call:
 * `useToasts().success(message, undo?)`.
 *
 * A toast that carries an undo is the record of what can be undone, so ⌘Z
 * reverses the newest one still showing and nothing older — see `useUndoLast`.
 */

export type ToastKind = "info" | "success" | "danger";
type Undo = () => void | Promise<void>;

type Show = (toast: { message: string; kind: ToastKind; undo?: Undo }) => void;

const ToastContext = createContext<Show | null>(null);
const UndoContext = createContext<(() => boolean) | null>(null);

const LIFETIME_MS = 7000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const latest = useRef<{ id: string | number; undo: Undo } | null>(null);

  const show = useCallback<Show>(({ message, kind, undo }) => {
    const options = {
      duration: kind === "danger" ? 10_000 : LIFETIME_MS,
      action: undo
        ? {
            label: t("common.undo"),
            onClick: () => {
              if (latest.current?.undo === undo) latest.current = null;
              void undo();
            },
          }
        : undefined,
      onAutoClose: () => {
        if (latest.current?.undo === undo) latest.current = null;
      },
      onDismiss: () => {
        if (latest.current?.undo === undo) latest.current = null;
      },
    };
    const id =
      kind === "success"
        ? sonner.success(message, options)
        : kind === "danger"
          ? sonner.error(message, options)
          : sonner(message, options);
    if (undo) latest.current = { id, undo };
  }, []);

  const undoLast = useCallback(() => {
    const entry = latest.current;
    if (!entry) return false;
    latest.current = null;
    sonner.dismiss(entry.id);
    void entry.undo();
    return true;
  }, []);

  return (
    <ToastContext.Provider value={show}>
      <UndoContext.Provider value={undoLast}>
        {children}
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!rounded-lg !border !border-line !bg-surface !text-ink !shadow-lg !font-sans !text-[13.5px]",
              actionButton: "!bg-ink !text-white !font-medium !rounded-md",
              success: "[&_[data-icon]]:!text-success",
              error: "[&_[data-icon]]:!text-danger",
            },
          }}
        />
      </UndoContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

/** Runs the newest toast's undo. Returns whether there was one. */
export function useUndoLast() {
  const undoLast = useContext(UndoContext);
  if (!undoLast)
    throw new Error("useUndoLast must be used inside <ToastProvider>");
  return undoLast;
}

export function useToasts() {
  const show = useToast();
  return useMemo(
    () => ({
      info: (message: string, undo?: Undo) =>
        show({ message, kind: "info", undo }),
      success: (message: string, undo?: Undo) =>
        show({ message, kind: "success", undo }),
      danger: (message: string) => show({ message, kind: "danger" }),
    }),
    [show],
  );
}
