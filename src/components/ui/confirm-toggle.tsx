"use client";

import { useState } from "react";

import { t, type Params, type TranslationKey } from "@/i18n/translations";

import { cx } from "./cx";
import { Switch } from "./form";
import { ConfirmDialog } from "./overlay";

/**
 * A switch that asks first.
 *
 * Most switches should not ask — flipping them *is* the action. The exception
 * is a switch that changes what customers can see: hiding a dish takes it off
 * the menu of a shop that is taking orders, and nothing on the operator's
 * screen says anything went wrong. Nobody undoes a mistake they did not notice,
 * so the moment to catch it is before it happens — and in a column of
 * identical switches, one row off is the easiest slip on the screen.
 *
 * Both directions ask, and ask different things: turning on publishes,
 * turning off withdraws. The confirm button is `primary`, not `danger` —
 * hiding is reversible in one click, and red belongs to Archive.
 *
 * The label beside the switch carries the state in words (`labelOn` /
 * `labelOff`, e.g. Live / Hidden) so it never depends on colour alone.
 */

type Question = {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  confirmKey: TranslationKey;
};

export function ConfirmToggle({
  on,
  onChange,
  labelOn,
  labelOff,
  whenTurningOn,
  whenTurningOff,
  params,
  disabled = false,
  className,
}: {
  on: boolean;
  onChange: () => void | Promise<void>;
  labelOn: string;
  labelOff?: string;
  /** Asked when it is off and about to go on. */
  whenTurningOn: Question;
  /** Asked when it is on and about to go off. */
  whenTurningOff: Question;
  /** Filled into both — the name of what is being switched. */
  params?: Params;
  disabled?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  // Fixed when the dialog opens, so the question does not flip to the other
  // direction while it is still on screen (the value changes as it settles).
  const [question, setQuestion] = useState<Question>(whenTurningOn);
  const label = on ? labelOn : (labelOff ?? labelOn);

  return (
    <>
      <span
        className={cx(
          "inline-flex shrink-0 items-center gap-2 text-[13px] font-medium",
          on ? "text-ink" : "text-ink-3",
          className,
        )}
      >
        <Switch
          checked={on}
          disabled={disabled}
          aria-label={label}
          onCheckedChange={() => {
            setQuestion(on ? whenTurningOff : whenTurningOn);
            setAsking(true);
          }}
        />
        <span aria-hidden className="whitespace-nowrap">
          {label}
        </span>
      </span>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(question.titleKey, params)}
        description={t(question.bodyKey, params)}
        confirmLabel={t(question.confirmKey, params)}
        tone="primary"
        onConfirm={onChange}
      />
    </>
  );
}
