"use client";

import { useId, useState, type ReactNode } from "react";

import { t, type Params, type TranslationKey } from "@/i18n/translations";

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
  params,
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
  /**
   * Filled into the title and the body.
   *
   * Almost always the name of the thing. "Archive this item?" is a question
   * about a category; "Archive Kibbeh Plate?" is a question about the thing the
   * operator clicked, and it is the only version that catches the case where
   * they clicked the wrong row — which is the case a confirmation exists for.
   */
  params?: Params;
  /**
   * The *confirm* button's variant. The trigger keeps its own look.
   *
   * `accent` is mint, the theme's "going well", for a question whose answer
   * *restores* something — bringing a shop back, lifting a withdrawal. Coral
   * would read as the ordinary go-on and red as a warning, and neither is what
   * "put this back" is.
   */
  variant?: "danger" | "primary" | "accent";
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
   * The default is `quiet` — the dialog is where the weight belongs. The two
   * reasons to override it:
   *
   * - **`danger`** (filled) where the action sits beside another filled button
   *   and is a real, expected choice. A text link there reads as a footnote,
   *   which is the wrong weight for the one thing that cannot be undone.
   * - **`danger-quiet`** where it repeats down a list: red type says
   *   destructive without a column of filled red buttons, which stops meaning
   *   anything by the fourth row.
   * - **`primary`** (coral) where the confirmed action is the *only* thing to
   *   do on the panel. A quiet trigger there is the quietest control on a
   *   screen whose whole purpose is that one button.
   */
  triggerVariant?:
    | "quiet"
    | "secondary"
    | "primary"
    | "danger"
    | "danger-quiet"
    | "accent";
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
      // Closed on success.
      //
      // This used to stay open, on the reasoning that a confirmed action
      // usually navigates away or unmounts the thing it was about — true of
      // archiving a row, and false of everything else. A switch confirmed here
      // leaves its row exactly where it was, so the dialog sat there with a
      // spinner that would never stop, and the operator had to dismiss a
      // question they had already answered.
      //
      // Where the action really does unmount this, closing first costs
      // nothing: the state update lands on a component that is going away, and
      // React treats that as the no-op it is.
      setOpen(false);
      setPending(false);
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
            {t(titleKey, params)}
          </h2>
          <p id={`${id}-body`} className="text-[14px] text-text-soft">
            {t(bodyKey, params)}
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
