"use client";

import {
  Checkbox as CheckboxPrimitive,
  Switch as SwitchPrimitive,
} from "radix-ui";
import { Check, ChevronDown, Minus } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { t } from "@/i18n/translations";

import { cx } from "./cx";

const control =
  "w-full rounded-md border border-line-strong bg-surface text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:shadow-focus focus:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_rgb(220_38_38/0.15)]";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Something inside the field's left edge: an icon or a currency code. */
  leading?: ReactNode;
  /** Something inside the right edge: a unit, a clear button. */
  trailing?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, ...rest },
  ref,
) {
  if (!leading && !trailing) {
    return (
      <input
        ref={ref}
        className={cx(control, "h-9 px-3 text-[14px]", className)}
        {...rest}
      />
    );
  }
  return (
    <div className={cx("relative flex items-center", className)}>
      {leading && (
        <span className="pointer-events-none absolute start-3 flex items-center text-ink-3 [&_svg]:size-4">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        className={cx(
          control,
          "h-9 px-3 text-[14px]",
          leading ? "ps-9" : undefined,
          trailing ? "pe-10" : undefined,
        )}
        {...rest}
      />
      {trailing && (
        <span className="absolute end-2 flex items-center text-[13px] text-ink-3 [&_svg]:size-4">
          {trailing}
        </span>
      )}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(
        control,
        "min-h-20 px-3 py-2 text-[14px] leading-relaxed",
        className,
      )}
      {...rest}
    />
  );
});

/**
 * A native select, styled. Native on purpose: it is keyboard-complete, works
 * with type-ahead, and opens as the OS picker on a phone.
 */
export const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...rest }, ref) {
  return (
    <div className={cx("relative", className)}>
      <select
        ref={ref}
        className={cx(control, "h-9 appearance-none pe-9 ps-3 text-[14px]")}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
});

/**
 * Label, control, and the line under it — hint or error, never both.
 *
 * The control is passed as a render function so the label and message can be
 * wired to it by id without the caller doing it by hand.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: ReactNode;
  /** Marks the label with a red asterisk. The form says once what it means. */
  required?: boolean;
  className?: string;
  children:
    | ReactNode
    | ((props: {
        id: string;
        "aria-describedby"?: string;
        "aria-invalid"?: true;
      }) => ReactNode);
}) {
  const id = useId();
  const messageId = `${id}-msg`;
  const message = error || hint;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink"
      >
        <span>
          {label}
          {required && (
            <span aria-hidden className="ms-0.5 text-danger">
              *
            </span>
          )}
          {required && <span className="sr-only"> {t("form.requiredSr")}</span>}
        </span>
        {optional && (
          <span className="text-[12px] font-normal text-ink-4">{optional}</span>
        )}
      </label>
      {typeof children === "function"
        ? children({
            id,
            "aria-describedby": message ? messageId : undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {message && (
        <p
          id={messageId}
          className={cx(
            "text-[12.5px] leading-snug",
            error ? "text-danger-ink" : "text-ink-3",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const box = (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className="mt-px flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-surface shadow-xs transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50"
    >
      <CheckboxPrimitive.Indicator className="text-white">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <div className={cx("flex items-start gap-2.5", className)}>
      {box}
      <label
        htmlFor={id}
        className="flex flex-col gap-0.5 text-[14px] leading-tight"
      >
        <span className="font-medium text-ink">{label}</span>
        {description && (
          <span className="text-[13px] text-ink-3">{description}</span>
        )}
      </label>
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const toggle = (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px] rtl:data-[state=checked]:-translate-x-[18px] rtl:-translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
  if (!label) return toggle;
  return (
    <div className={cx("flex items-start justify-between gap-4", className)}>
      <label
        htmlFor={id}
        className="flex flex-col gap-0.5 text-[14px] leading-tight"
      >
        <span className="font-medium text-ink">{label}</span>
        {description && (
          <span className="text-[13px] text-ink-3">{description}</span>
        )}
      </label>
      {toggle}
    </div>
  );
}

/** An error above a form, for what no single field owns. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger-ink"
    >
      {children}
    </div>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-success/20 bg-success-soft px-3 py-2.5 text-[13.5px] text-success-ink"
    >
      {children}
    </div>
  );
}
