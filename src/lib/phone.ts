/**
 * A phone number, as somebody would write it.
 *
 * ## Why the `+` is added rather than stored
 *
 * `users.phone` holds the international form without it — `96170000001` — and
 * that is the right thing to store: it is what the number *is*, and a stored
 * prefix is one more character every writer has to agree about.
 *
 * But it is not what a number looks like, and it is not what a dialler wants: a
 * `tel:` link without the `+` is ambiguous about the country, which is the one
 * thing an international number exists to settle. So the prefix is presentation
 * and lives here, in one function, rather than being typed at each of the four
 * places a number is drawn.
 *
 * Idempotent: a number that already carries a `+` is returned unchanged, so
 * this can be applied without first knowing which form arrived.
 */
export function formatPhone(phone: string | null | undefined): string {
  const trimmed = (phone ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/**
 * Lebanon's calling code, which is the only one this product has.
 *
 * Every number the dashboard stores — a driver's, a shop's — is a Lebanese
 * number, and the country code was being *typed* at each of them. That is a
 * prefix an operator has to know, retype for every driver they add, and can get
 * wrong in a way nothing catches until an order fails to send: `+961` and
 * `00961` and a leading `0` on the national part are all things people write,
 * and only one of them rings.
 *
 * So it stops being an input and becomes a fact. `PhoneInput` draws it, this
 * constant is it, and the pair of functions below are the only places a number
 * is split into it or joined back onto it.
 */
export const CALLING_CODE = "961";

/**
 * A typed phone number as digits.
 *
 * A leading `00` is the other way of writing `+`, and people type both. Dropping
 * it rather than keeping it is the difference between `009611234567` — which
 * WhatsApp reads as an unknown country — and a number that rings.
 *
 * Lives here rather than in the drivers API, where it was: it is a fact about
 * phone numbers, and a shop's WhatsApp number was already reaching across into
 * a courier module to borrow it.
 */
export function digitsOf(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

/**
 * The part of a stored number that the operator actually types.
 *
 * Storage is the full international form without a `+` — `96170123456` — and
 * the field shows only `70123456`, because the rest is drawn beside it and
 * cannot be edited.
 *
 * ## Why a number that is not Lebanese is left whole
 *
 * The column's CHECK is any country's number, not this one's, so a row written
 * before the code was fixed may hold something that does not start with `961`.
 * Stripping the first three digits off it regardless would turn a French number
 * into a shorter French number and then save it as a Lebanese one — a
 * corruption that looks exactly like a successful edit.
 *
 * Returning it whole is visibly wrong instead: the operator sees a number too
 * long to be a local one, in a field labelled `+961`, and clears it. That is
 * the failure worth having.
 */
export function nationalPart(stored: string | null | undefined): string {
  const digits = digitsOf(stored ?? "");
  return digits.startsWith(CALLING_CODE)
    ? digits.slice(CALLING_CODE.length)
    : digits;
}

/**
 * The national part as the form that is stored and dialled.
 *
 * The leading `0` goes: Lebanese numbers are written `03 123 456` locally and
 * the trunk prefix is not part of the international number, so somebody typing
 * the number off a shopfront gets `9613123456` rather than `96103123456` —
 * which is a different number, and not one that exists.
 *
 * Empty stays empty rather than becoming a bare `961`, which would be a country
 * code pretending to be a phone number and would pass a length check.
 */
export function internationalFrom(national: string): string {
  const digits = digitsOf(national).replace(/^0+/, "");
  return digits === "" ? "" : `${CALLING_CODE}${digits}`;
}
