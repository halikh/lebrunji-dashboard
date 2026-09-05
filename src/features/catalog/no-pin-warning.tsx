import { t } from "@/i18n/translations";

/**
 * The line that says an address has no pin, and what that costs.
 *
 * ## Why it is a component and not two copies of a span
 *
 * It appears on the shops list and on a shop's branch rows, and those two are
 * the *same warning about the same money*. `delivery_quote_for_branch` cannot
 * work out a distance without a pin, and `delivery_fee_for_km` charges an
 * unknown distance at the **top band** — so an unpinned place silently
 * overcharges every customer it serves, on every order, until somebody notices.
 *
 * Two copies of that would be two chances for one of them to be softened later
 * into something that reads as cosmetic.
 *
 * ## The wording is the consequence, not the fact
 *
 * "No location" would read as a field somebody has not filled in yet. The
 * string says what happens instead, which is the only version that makes an
 * operator scanning a list stop on it.
 *
 * The glyph is drawn inline rather than taken from `components/shell/icons` —
 * that set is the nav rail's, with its own stroke weight and its hover
 * animations, and one warning mark does not belong to it.
 */
export function NoPinWarning() {
  return (
    <span className="flex items-center gap-xs text-[12px] font-semibold text-danger">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M12 8v5M12 16.5v.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      {t("catalogue.noPin")}
    </span>
  );
}
