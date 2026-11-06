import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cx } from "./cx";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "danger-soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-xs hover:bg-accent-hover disabled:bg-accent/50",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-xs hover:bg-hover disabled:text-ink-4",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink disabled:text-ink-4",
  danger:
    "bg-danger text-white shadow-xs hover:bg-danger-hover disabled:bg-danger/50",
  "danger-soft":
    "border border-line-strong bg-surface text-danger-ink shadow-xs hover:bg-danger-soft disabled:text-ink-4",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-9 gap-2 px-3.5 text-[14px]",
  lg: "h-11 gap-2 px-5 text-[15px]",
  icon: "size-9 justify-center",
  "icon-sm": "size-8 justify-center",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cx(
    "inline-flex shrink-0 select-none items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks while an action is in flight. */
  pending?: boolean;
  /** Render the child (a `Link`, usually) with button styling. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant,
      size,
      pending,
      asChild,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classes = buttonClass({ variant, size, className });
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={classes} {...rest}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <button
        ref={ref}
        type={type}
        className={cx(classes, pending && "cursor-wait")}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        {...rest}
      >
        {pending && <Spinner className="size-4" />}
        {children}
      </button>
    );
  },
);
