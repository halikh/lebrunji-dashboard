import { t } from "@/i18n/translations";

/**
 * What the order functions say when they refuse, in the operator's words.
 *
 * ## Read off the SQLSTATE, not the sentence
 *
 * `api_v1_advance_order`, `api_v1_amend_order` and `api_v1_dispatch_order`
 * raise their refusals with five-letter codes of their own — `MOVED`, `CANCL`
 * and the rest, migrations `0171` and `0173`. PostgREST hands that back as
 * `error.code`, and the code is the contract: the English sentence beside it is
 * the database's, may change wording, and is not something to show a person
 * whose screen is in another language.
 *
 * A code this does not know keeps the database's own message. Inventing a
 * friendlier sentence for a failure nobody predicted would sound confident
 * about something not understood — the rule `reason()` in `use-couriers.ts`
 * follows too.
 */

/** The shape supabase-js returns an error in — only what is read here. */
type PostgrestLike = { code?: string | null; message: string };

/**
 * An Error that remembers which refusal it was.
 *
 * The message is already translated; `code` is kept so a caller can act on the
 * *kind* of refusal — close a form that is now stale, offer to reassign a
 * driver — without matching on words.
 */
export class OrderRefusal extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "OrderRefusal";
    this.code = code;
  }
}

/**
 * Which part of the screen asked. A `check_violation` from the amend function
 * means "too late to change it"; from anywhere else it means nothing this file
 * can name.
 */
export type RefusalContext = "advance" | "amend" | "dispatch";

export function orderRefusal(
  error: PostgrestLike,
  context: RefusalContext,
): OrderRefusal {
  const code = error.code ?? null;
  return new OrderRefusal(messageFor(code, error.message, context), code);
}

function messageFor(
  code: string | null,
  message: string,
  context: RefusalContext,
): string {
  switch (code) {
    // Another operator — or the customer — got there first. Only raised when
    // the caller said what it expected to find (`p_expected_from`,
    // `p_expected_total`), which every caller here now does.
    case "MOVED":
      return context === "amend"
        ? t("amend.changedElsewhere")
        : t("orders.movedElsewhere");
    case "CANCL":
      return t("orders.wasCancelled");
    case "DONE":
      return t("dispatch.alreadyDelivered");
    case "TAKEN":
      return t("dispatch.alreadyTaken");
    case "NOCOU":
      return t("dispatch.driverGone");
    case "LINEX":
      return t("amend.lineAlreadyChanged");
    // A substitute past the basket's own caps (0184): 50 of one dish, or
    // 20 kg / 20 L of one sold by weight. The server names the weight.
    case "QTMAX":
      return t("amend.tooMany");
    case "WTMAX": {
      const amount = /up to ([\d.]+ \w+)/.exec(message)?.[1] ?? "20 kg";
      return t("amend.tooHeavy", { amount });
    }
    // An exchange rate the order needs is missing or zero (0184): the server
    // refuses rather than writing dollars as lira. Set the rate, then retry.
    case "NORAT":
      return t("amend.noRate");
    // `check_violation`. From the amend function it is the order having left
    // the kitchen — or finished — while the form was open. A table CHECK says
    // "violates check constraint", and that is a different failure with a
    // different cause, so it keeps its own text.
    case "23514":
      if (context === "amend" && !message.includes("violates check constraint"))
        return t("amend.tooLate");
      return message;
    default:
      return message || t("common.somethingWentWrong");
  }
}
