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
 * ## And the glyph is a pin, not a warning triangle
 *
 * The mark names the *thing that is missing* rather than the fact that
 * something is. A generic alert on a list of shops could be about anything —
 * the hours, the menu, the phone — so the eye has to read the words to find out
 * what is wrong; a pin says it before they are read, and the words are then the
 * consequence rather than the identification. It keeps `text-danger`, which is
 * what makes it a warning at all.
 *
 * Drawn inline rather than taken from `components/shell/icons` — that set is
 * the nav rail's, with its own stroke weight and its hover animations, and one
 * warning mark does not belong to it.
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
        <path d="M20 10c0 4.4-5.5 10.5-7.3 12.3a1 1 0 0 1-1.4 0C9.5 20.5 4 14.4 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      {t("catalogue.noPin")}
    </span>
  );
}
