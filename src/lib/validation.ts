/**
 * The rules the forms apply, as pure functions.
 *
 * Two properties matter more than the contents:
 *
 * 1. **They are pure.** No network, no React, no Supabase client — so they are
 *    testable without any of those, which is the same reason `src/lib/` in the
 *    app repo is deliberately free of the network client.
 * 2. **The importer uses this exact module.** A value pasted into a spreadsheet
 *    column is judged by the rule a typed one is. If the two ever diverge, the
 *    bulk path becomes the way bad data gets in — and it would be the path
 *    nobody was watching.
 *
 * Every rule here has a CHECK constraint behind it (migration 0066). This layer
 * exists to produce a sentence a person can act on, not to be the gate.
 */

import {
  DAY_OF_WEEK,
  DELIVERY,
  DISCOUNT,
  IMAGE,
  MONEY,
  PREP_MINUTES,
  SLUG_PATTERN,
  TEXT,
} from './limits';

/**
 * `ok` on its own, or `ok: false` with the sentence to show.
 *
 * A discriminated union rather than `string | null`, so a caller that forgets to
 * check is a type error rather than a form that silently accepts anything.
 */
export type Valid = { ok: true } | { ok: false; message: string };

const OK: Valid = { ok: true };
const fail = (message: string): Valid => ({ ok: false, message });

/** A translated value: one string per language code. */
export type Localized = Record<string, string>;

export function validateSlug(value: string): Valid {
  const slug = value.trim();
  if (slug.length === 0) return fail('A slug is required.');
  if (slug.length > TEXT.slug) return fail(`A slug can be at most ${TEXT.slug} characters.`);
  if (!SLUG_PATTERN.test(slug)) {
    return fail('Use lower-case letters, numbers and single hyphens, like kibbeh-plate.');
  }
  return OK;
}

/**
 * A translated field.
 *
 * `languages` is passed in rather than imported, because the set of languages is
 * a database table and not a constant — that is what makes adding one a row
 * rather than a release.
 *
 * **Every language is required.** Not a house style: the `<table>_<col>_locales`
 * CHECK constraints from migration 0051 reject an object missing one, so a form
 * that allowed a partial value would fail at Save with a constraint name instead
 * of a sentence. Naming the missing languages here is the whole difference.
 */
export function validateLocalizedText(
  value: Localized | null | undefined,
  languages: readonly string[],
  maxLength: number,
  options: { optional?: boolean } = {},
): Valid {
  const isFilled = (code: string) => (value?.[code] ?? '').trim().length > 0;
  const filled = languages.filter(isFilled);

  if (filled.length === 0) {
    return options.optional ? OK : fail('This is required.');
  }

  // Partly filled is the case worth a good message: the operator has done most
  // of the work and is about to lose it to a constraint violation.
  const missing = languages.filter((code) => !isFilled(code));
  if (missing.length > 0) {
    return fail(`Still needed in: ${missing.join(', ')}.`);
  }

  const tooLong = languages.filter((code) => (value?.[code] ?? '').trim().length > maxLength);
  if (tooLong.length > 0) {
    return fail(`Too long in ${tooLong.join(', ')} — at most ${maxLength} characters.`);
  }

  return OK;
}

/**
 * A price, in **minor units**.
 *
 * Rejects a fractional value outright rather than rounding it. Rounding would be
 * a silent correction to an amount somebody is about to charge a customer, and
 * the caller has most likely forgotten to convert from major units — a bug worth
 * surfacing rather than absorbing.
 */
export function validatePrice(minorUnits: number, options: { max?: number } = {}): Valid {
  if (!Number.isFinite(minorUnits)) return fail('Enter a price.');
  if (!Number.isInteger(minorUnits)) {
    return fail('A price must be a whole number of minor units.');
  }
  if (minorUnits < MONEY.min) return fail('A price cannot be negative.');
  const max = options.max ?? MONEY.maxUnitPrice;
  if (minorUnits > max) return fail('That price looks wrong — check the number of zeros.');
  return OK;
}

/**
 * A store's opening window for one day.
 *
 * **A window that closes at or before it opens runs past midnight**, and that is
 * supported rather than tolerated — 22:00 to 02:00 is an ordinary row for a late
 * shop. `src/lib/store-hours.ts` in the app reads it exactly that way, and the
 * database deliberately carries no constraint demanding otherwise. So the only
 * thing invalid here is a time that is not a time, and the one genuinely
 * ambiguous case below.
 */
export function validateHours(day: number, opensAt: string, closesAt: string): Valid {
  if (!Number.isInteger(day) || day < DAY_OF_WEEK.min || day > DAY_OF_WEEK.max) {
    return fail('Pick a day of the week.');
  }
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(opensAt) || !time.test(closesAt)) return fail('Times are HH:MM, 24-hour.');
  if (opensAt === closesAt) {
    return fail('Opening and closing at the same time reads as open all day — change one.');
  }
  return OK;
}

export function validatePrepWindow(min: number, max: number): Valid {
  if (!Number.isInteger(min) || !Number.isInteger(max)) return fail('Enter whole minutes.');
  if (min < PREP_MINUTES.min) return fail(`At least ${PREP_MINUTES.min} minute.`);
  if (max > PREP_MINUTES.max) return fail(`At most ${PREP_MINUTES.max} minutes.`);
  if (max < min) return fail('The longest time cannot be shorter than the shortest.');
  return OK;
}

/**
 * One rung of the delivery ladder.
 *
 * `existing` is every other band's ceiling, because a band is meaningless alone:
 * two rows with the same `up_to_km` are a contradiction about what a distance
 * costs. `up_to_km` is the table's primary key, so the database refuses it too.
 */
export function validateDeliveryBand(
  upToKm: number,
  amountMinorUnits: number,
  existing: readonly number[] = [],
): Valid {
  if (!Number.isFinite(upToKm)) return fail('Enter a distance.');
  if (upToKm < DELIVERY.minKm) return fail('A band must cover some distance.');
  if (upToKm > DELIVERY.maxKm) return fail(`At most ${DELIVERY.maxKm} km.`);
  // `numeric(5,2)` — a third decimal place would be rounded away on write, and
  // a band that silently becomes a different band is worse than a refusal.
  if (Math.abs(upToKm * 100 - Math.round(upToKm * 100)) > 1e-9) {
    return fail('At most two decimal places.');
  }
  if (existing.includes(upToKm)) return fail('There is already a band ending at that distance.');

  return validatePrice(amountMinorUnits);
}

export function validateDiscountValue(kind: string, value: number): Valid {
  if (!Number.isFinite(value)) return fail('Enter a value.');
  if (value < DISCOUNT.minValue) return fail('A discount cannot be negative.');
  if (kind === 'percentage' && value > DISCOUNT.maxPercentage) {
    return fail('A percentage cannot be over 100.');
  }
  return OK;
}

export function validateDiscountWindow(startsAt: string | null, endsAt: string | null): Valid {
  if (!startsAt || !endsAt) return OK;
  if (new Date(startsAt) >= new Date(endsAt)) {
    return fail('The promotion would end before it started.');
  }
  return OK;
}

/**
 * An image, before it is uploaded rather than after.
 *
 * `type` must come from the file's **magic bytes** — see `sniffImageType`. The
 * browser reports whatever the operating system guessed from the extension,
 * which a renamed file makes a lie.
 */
export function validateImage(input: {
  bytes: number;
  type: string | null;
  width?: number;
  height?: number;
}): Valid {
  if (input.type === null || !(IMAGE.types as readonly string[]).includes(input.type)) {
    return fail('Images must be JPEG, PNG or WebP.');
  }
  if (input.bytes > IMAGE.maxBytes) {
    return fail(`Images must be under ${Math.round(IMAGE.maxBytes / 1024 / 1024)} MB.`);
  }
  const { width, height } = input;
  if (width !== undefined && height !== undefined) {
    if (width < IMAGE.minPixels || height < IMAGE.minPixels) {
      return fail(`At least ${IMAGE.minPixels}px on each side.`);
    }
    if (width > IMAGE.maxPixels || height > IMAGE.maxPixels) {
      return fail(`At most ${IMAGE.maxPixels}px on each side.`);
    }
  }
  return OK;
}

/**
 * The image's real type, from its first bytes.
 *
 * `File.type` is derived from the file extension by the operating system, so it
 * says whatever the name says. This reads the signature instead.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (i: number) => bytes[i];

  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return 'image/png';
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** Collapses a set of results into the first failure, for a whole form. */
export function firstFailure(results: readonly Valid[]): Valid {
  return results.find((r): r is { ok: false; message: string } => !r.ok) ?? OK;
}
