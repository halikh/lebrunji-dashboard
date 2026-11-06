import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * One setting: what it is and what changing it does on the start side, the
 * control on the end — the row Linear and Stripe build their settings from.
 *
 * The explanation sits beside the control rather than under a field, because
 * on a settings page the consequence is the thing to read first ("moves every
 * report day"), and the control is small. Below `md` the two stack, control
 * underneath, so a select is never squeezed to a sliver on a phone.
 *
 * Rows go inside a card (`SettingsGroup`), separated by hairlines.
 */
export function SettingRow({
  label,
  description,
  children,
  footer,
  id,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  /** The control, or the current value and a Change button. */
  children?: ReactNode;
  /** Spans the full width under the row — a note, an inline form. */
  footer?: ReactNode;
  /** Labels the control: pass it to the control's `aria-labelledby`. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4 px-5 py-4", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-col gap-0.5 md:max-w-md">
          <p id={id} className="text-[14px] font-medium text-ink">
            {label}
          </p>
          {description && (
            <div className="text-[13px] text-ink-3">{description}</div>
          )}
        </div>
        {children && (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 md:justify-end">
            {children}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}

/**
 * A titled card of `SettingRow`s. The title names the group ("Time",
 * "Sign-in"); each row inside says what it does itself.
 */
export function SettingsGroup({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-lg border border-line bg-surface shadow-xs",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}
