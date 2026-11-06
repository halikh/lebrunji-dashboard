"use client";

import {
  Dialog as DialogPrimitive,
  DropdownMenu,
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
} from "radix-ui";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { t } from "@/i18n/translations";

import { Button, type ButtonVariant } from "./button";
import { cx } from "./cx";

/* ───────────────────────────── Dialog ───────────────────────────── */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 animate-fade-in" />
        <DialogPrimitive.Content
          className={cx(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,860px)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-lg animate-pop-in focus:outline-none",
            width,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[17px] font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-[13.5px] text-ink-3">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.close")}
                className="-me-2 -mt-1"
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children && (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 scrollbar-thin">
              {children}
            </div>
          )}
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-line bg-subtle px-6 py-3.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Asks before doing something. The action runs inside, so the button can show
 * that it is working and the dialog stays until it is done — or says why not.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  onConfirm: () => void | Promise<unknown>;
  children?: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tone}
            pending={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                // Stay open so the person can retry or cancel. Whoever threw
                // has said why — the data hooks toast their own failures.
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/* ───────────────────────────── Sheet ────────────────────────────── */

/** A panel from the right edge — for editing one thing without leaving the list. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-fade-in" />
        <DialogPrimitive.Content
          className={cx(
            "fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-line bg-surface shadow-lg animate-slide-in focus:outline-none",
            width === "md" ? "max-w-md" : "max-w-2xl",
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[16px] font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-3">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.close")}
                className="-me-2"
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
            {children}
          </div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ───────────────────────────── Menu ─────────────────────────────── */

export type MenuItem =
  | {
      label: ReactNode;
      icon?: ReactNode;
      onSelect: () => void;
      tone?: "danger";
      disabled?: boolean;
      shortcut?: ReactNode;
    }
  | "separator";

export function Menu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  label?: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-lg animate-pop-in"
        >
          {label && (
            <DropdownMenu.Label className="px-2.5 py-1.5 text-[12px] font-medium text-ink-3">
              {label}
            </DropdownMenu.Label>
          )}
          {items.map((item, i) =>
            item === "separator" ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <DropdownMenu.Item
                key={i}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cx(
                  "flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] leading-5 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-hover [&_svg]:size-4",
                  item.tone === "danger" ? "text-danger-ink" : "text-ink",
                )}
              >
                {item.icon && (
                  <span
                    className={
                      item.tone === "danger" ? "text-danger" : "text-ink-3"
                    }
                  >
                    {item.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[12px] text-ink-4">
                    {item.shortcut}
                  </span>
                )}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ──────────────────────── Tooltip / Popover ─────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-[12.5px] text-white shadow-md animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = "start",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cx(
            "z-50 rounded-lg border border-line bg-surface p-3 shadow-lg animate-pop-in focus:outline-none",
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
