"use client";

import { useId, useState, type ReactNode } from "react";

import { t, type TranslationKey } from "@/i18n/translations";

import { Button, cx } from "./index";
import { Modal } from "./modal";

/**
 * A button that asks first.
 *
 * ## What deserves one, and what does not
 *
 * A confirmation is not a safety feature by default — it is one only when the
 * question is genuinely worth reading. An action confirmed hundreds of times a
 * day gets clicked through without being read, and then it protects nothing
 * while having cost everybody a second every time. The order queue is exactly
 * that shape, which is why advancing a status is **undo**, not confirm.
 *
 * So this is for the actions where the opposite is true:
 *
 * - **Destructive and hard to reverse** — deleting a row for good, as opposed
 *   to archiving it.
 * - **Terminal** — cancelling an order, which refunds a customer's expectation
 *   and cannot be walked back.
 * - **Consequential and out of the blue** — signing out mid-shift, changing the
 *   rate every price in the app is derived from.
 *
 * The test: could this be clicked by accident, and would that be expensive?
 * If undo would do the job, use undo.
 *
 * ## The details that make it work rather than annoy
 *
 * - The dialog **says what will happen**, not "Are you sure?". A question with
 *   no information in it is the kind people learn to dismiss.
 * - The confirm button carries the **verb**, not "OK" — so the last thing read
 *   before clicking is what it does.
 * - For a destructive action, **Cancel takes focus**. Enter on a freshly opened
 *   dialog should not be the dangerous answer.
 * - Failure is reported **in the dialog**, which stays open. Closing it and
 *   showing an error somewhere else loses the connection between the two.
 */
export function ConfirmButton({
  onConfirm,
  titleKey,
  bodyKey,
  confirmKey,
  variant = "danger",
  children,
  size,
  fullWidth,
  className,
  renderTrigger,
  triggerVariant,
}: {
  onConfirm: () => Promise<void> | void;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  confirmKey: TranslationKey;
  /** The *confirm* button's variant. The trigger keeps its own look. */
  variant?: "danger" | "primary";
  children: ReactNode;
  size?: "md" | "sm";
  fullWidth?: boolean;
  className?: string;
  /**
   * For a trigger that is not a button-shaped button.
   *
   * The rail's sign-out has to look like the nav items beside it — same box,
   * same stack, same type — and a `Button` cannot be bent into that without
   * class overrides, which is the conflict `size` was added to remove. So the
   * caller supplies the trigger and this keeps the dialog.
   *
   * The `onClick` it is handed is the whole contract: whatever is rendered must
   * be a real focusable control, or the dialog becomes unreachable by keyboard.
   */
  renderTrigger?: (props: { onClick: () => void }) => ReactNode;
  /**
   * The trigger's own look, when the default is the wrong weight.
   *
   * By default a destructive action gets a *quiet* trigger — the dialog is
   * where the weight belongs, and a page of red buttons is a page nobody reads.
   * But a filled one is right where the action is a real, expected choice
   * sitting beside another filled button: a text link there reads as a
   * footnote, which is the wrong weight for the one thing that cannot be
   * undone.
   */
  triggerVariant?: "quiet" | "secondary" | "danger";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      // Deliberately not closed here. A successful action usually navigates or
      // unmounts this; closing first would flash the page underneath.
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  function close() {
    // Ignored while the action is in flight — closing then would leave a
    // mutation running with nothing on screen to say so.
    if (pending) return;
    setOpen(false);
    setFailed(false);
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: () => setOpen(true) })
      ) : (
        <Button
          variant={
            triggerVariant ?? (variant === "danger" ? "quiet" : "primary")
          }
          size={size}
          fullWidth={fullWidth}
          onClick={() => setOpen(true)}
          className={className}
        >
          {children}
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        labelledBy={`${id}-title`}
        describedBy={`${id}-body`}
      >
        <div className="flex flex-col gap-lg">
          <h2 id={`${id}-title`} className="text-[18px]">
            {t(titleKey)}
          </h2>
          <p id={`${id}-body`} className="text-[14px] text-text-soft">
            {t(bodyKey)}
          </p>

          {failed && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {t("common.somethingWentWrong")}
            </p>
          )}

          <div className={cx("flex justify-end gap-sm")}>
            <Button
              variant="secondary"
              onClick={close}
              disabled={pending}
              // Focused on open for a destructive action, so Enter is the safe
              // answer rather than the expensive one.
              autoFocus={variant === "danger"}
            >
              {t("common.cancel")}
            </Button>
            <Button variant={variant} pending={pending} onClick={confirm}>
              {t(confirmKey)}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
