/**
 * An amount as stored — integer minor units — and as a person types it.
 *
 * `MoneyInput` is the only place a typed price becomes a stored one, and these
 * are the two halves of that conversion, kept apart from the component so they
 * can be tested: every wrong answer here is wrong by a factor of a hundred and
 * looks exactly like a right one (QA-058). `decimalDigits` comes from the
 * `currencies` row — 2 for USD, 0 for LBP.
 */

/**
 * What was typed, in minor units. `null` for an empty field, `undefined` for
 * one that does not read as a number.
 *
 * Rounded to the nearest minor unit, so binary float error in the product —
 * `4.35 × 100` is `434.99…` — never costs a cent.
 *
 * A figure below `min` (in major units, as the field's own `min` is) reads as
 * no number too. The input's `min` attribute only marks it invalid; it never
 * stopped the value being emitted, so `-5` was written as `-500` (QA-058).
 */
export function toMinor(
  raw: string,
  decimalDigits: number,
  min = 0,
): number | null | undefined {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  const factor = 10 ** decimalDigits;
  const minor = Math.round(parsed * factor);
  return minor < Math.round(min * factor) ? undefined : minor;
}

/**
 * Minor units as the number a person would say: `150` at two digits is
 * `1.50`. Empty for no amount, or for a currency whose scale is not known yet
 * — there is no safe number to divide by.
 */
export function toMajor(
  value: number | null,
  decimalDigits: number | null,
): string {
  if (value === null || decimalDigits === null) return "";
  if (decimalDigits === 0) return String(value);
  return (value / 10 ** decimalDigits).toFixed(decimalDigits);
}
