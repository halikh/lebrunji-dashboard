"use client";

import type { Params, TranslationKey } from "@/i18n/translations";

import { ConfirmButton } from "./confirm-button";
import { Toggle } from "./toggle";

/**
 * A switch that asks first.
 *
 * ## Why a switch, of all things, gets a dialog
 *
 * `ConfirmButton` argues at length that a confirmation is worth having only
 * when the question is worth reading, and that an action performed constantly
 * should get undo instead. A switch is the archetype of the thing that should
 * *not* ask: flipping it is the action, and a dialog in the way makes a
 * one-click change into three.
 *
 * The exception, and it is the one that matters in this product: **a switch
 * that changes what customers can see.** Hiding an item takes it off the menu
 * of a shop that is open and taking orders, and the failure is silent from the
 * operator's side — nothing is wrong on their screen, and what they find out
 * later is that a dish stopped selling. Nobody undoes a mistake they did not
 * notice, so undo is not the tool; the moment to catch it is before it happens.
 *
 * That it sits in a row of identical switches makes it worse rather than
 * better: one row off is the easiest slip on the screen.
 *
 * ## Both directions ask, and they ask different things
 *
 * Turning something on publishes it; turning it off withdraws it. They are not
 * the same event and a single "are you sure" for both would be the empty
 * question `ConfirmButton` warns about. Each direction names what it does and
 * says who sees the result.
 *
 * A switch that changes nothing a customer sees does not belong here — it stays
 * an ordinary `Toggle`.
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
  const question = on ? whenTurningOff : whenTurningOn;

  return (
    <ConfirmButton
      onConfirm={onChange}
      titleKey={question.titleKey}
      bodyKey={question.bodyKey}
      confirmKey={question.confirmKey}
      params={params}
      // `primary`, not `danger`. Hiding something is reversible in one click
      // and takes nothing away permanently — a red button here would borrow
      // the weight that belongs to Archive, and spending it twice is how it
      // stops meaning anything.
      variant="primary"
      renderTrigger={({ onClick }) => (
        <Toggle
          on={on}
          onChange={onClick}
          labelOn={labelOn}
          labelOff={labelOff}
          disabled={disabled}
          className={className}
        />
      )}
    >
      {/* Never rendered: `renderTrigger` replaces it. The switch is the
          trigger, and it carries its own label. */}
      {labelOn}
    </ConfirmButton>
  );
}
