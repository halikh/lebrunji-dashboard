"use client";

import { useId, type ReactNode } from "react";

import { cx } from "./cx";

export type Choice<K extends string> = {
  value: K;
  label: ReactNode;
  description?: ReactNode;
  /**
   * Shown under the choice only while it is picked — the amount field under
   * "Minimum spend", the shop picker under "Certain shops". What Shopify's
   * discount form does: every option is visible without a click, and only the
   * picked one asks for more.
   */
  children?: ReactNode;
};

/**
 * A stacked radio list, for a decision with a few named answers that should
 * all be readable at once rather than hidden behind a dropdown.
 */
export function ChoiceList<K extends string>({
  label,
  choices,
  value,
  onChange,
  disabled,
  className,
}: {
  /** The question, for screen readers; the card's title usually says it. */
  label: string;
  choices: Choice<K>[];
  value: K;
  onChange: (value: K) => void;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("flex flex-col gap-3", className)}
    >
      {choices.map((choice) => {
        const id = `${name}-${choice.value}`;
        const picked = choice.value === value;
        return (
          <div key={choice.value} className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <input
                id={id}
                type="radio"
                name={name}
                checked={picked}
                disabled={disabled}
                onChange={() => onChange(choice.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)] disabled:opacity-50"
              />
              <label
                htmlFor={id}
                className="flex min-w-0 flex-col gap-0.5 text-[14px] leading-tight"
              >
                <span className="font-medium text-ink">{choice.label}</span>
                {choice.description && (
                  <span className="text-[13px] text-ink-3">
                    {choice.description}
                  </span>
                )}
              </label>
            </div>
            {picked && choice.children && (
              <div className="ms-[26px]">{choice.children}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
