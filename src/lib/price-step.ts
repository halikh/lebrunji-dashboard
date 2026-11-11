import { t } from "@/i18n/translations";

/**
 * The database's refusal of a price off its currency's step, said plainly.
 *
 * Since the app's `0286` a lira price is entered as a step of 250 — 62,000,
 * 62,250, 62,500, 62,750 — and anything else is refused with `PSTEP` when it
 * is saved: a dish, a choice, a branch's price, a bundle, a restored dish.
 * A dish that is switched off may still hold a placeholder (1 ل.ل, "price not
 * known yet"); switching it on with one is refused the same way.
 *
 * The refusal's `detail` is `currency,step,price`, so the message can offer
 * the two prices either side instead of making the operator do the sum. Read
 * off the code, never the words, like `NOCHO`. Null for any other error, so a
 * caller falls through to its own wording.
 */
export function priceStepRefusal(
  error?: { code?: string | null; details?: string | null } | null,
): string | null {
  if (error?.code !== "PSTEP") return null;
  const [currency, stepText, priceText] = (error.details ?? "").split(",");
  const step = Number(stepText);
  const price = Number(priceText);
  if (!currency || !(step > 1) || !Number.isFinite(price)) {
    return t("dbError.priceOffStepPlain");
  }
  const low = Math.floor(price / step) * step;
  return t("dbError.priceOffStep", {
    currency,
    step: group(step),
    low: group(low),
    high: group(low + step),
  });
}

/** Minor units as a lira figure is written: 62,250. */
function group(minorUnits: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    minorUnits,
  );
}
