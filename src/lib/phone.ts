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
