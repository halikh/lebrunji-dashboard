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

import type { Params, TranslationKey } from "@/i18n/translations";

import {
  DAY_OF_WEEK,
  DELIVERY,
  DISCOUNT,
  IMAGE,
  MONEY,
  PASSWORD,
  PREP_MINUTES,
  SLUG_PATTERN,
  SOUND,
  TEXT,
} from "./limits";

/**
 * `ok` on its own, or `ok: false` with the sentence to show.
 *
 * A discriminated union rather than `string | null`, so a caller that forgets to
 * check is a type error rather than a form that silently accepts anything.
 */
/**
 * `ok`, or a **translation key** and its parameters — never a sentence.
 *
 * The first version returned English strings, which quietly put a whole class of
 * user-facing text outside `t()`. Every other string in the dashboard goes
 * through the bundle; validation messages are the ones an operator reads most
 * often, and they were the ones that would have stayed English when a second
 * language arrived.
 *
 * Returning a key also keeps this module pure: it decides *what is wrong*, and
 * the screen decides how to say it. The two are different jobs and only one of
 * them is testable without a locale.
 */
export type Valid =
  { ok: true } | { ok: false; key: TranslationKey; params?: Params };

const OK: Valid = { ok: true };
const fail = (key: TranslationKey, params?: Params): Valid => ({
  ok: false,
  key,
  params,
});

/** A translated value: one string per language code. */
export type Localized = Record<string, string>;

/**
 * A localised value as the database wants it: the object, or **null** when
 * every language is blank.
 *
 * The `_locales` CHECK constraints (migration 0051) allow an optional column to
 * be null outright, and otherwise require *every* locale to be present and
 * non-empty. An empty form field therefore has two possible encodings and only
 * one of them is legal — `{}` and `{ en: "", ar: "" }` are both rejected, with
 * a message naming a constraint.
 *
 * That is exactly what happened: a dish saved with no description sent `{}`,
 * Postgres refused it, and the operator was told "every language needs a value"
 * about a field they had deliberately left blank.
 *
 * So an all-blank value becomes null here, once, rather than in each form.
 * Blank *entries* are dropped too — a partly-filled value has already been
 * refused by `validateLocalizedText`, and sending `{ en: "x", ar: "" }` would
 * hit the constraint rather than the form's own message.
 */
export function localizedOrNull(
  value: Localized | null | undefined,
): Localized | null {
  if (!value) return null;

  const filled = Object.entries(value)
    .map(([code, text]) => [code, text.trim()] as const)
    .filter(([, text]) => text.length > 0);

  return filled.length > 0 ? Object.fromEntries(filled) : null;
}

export function validateSlug(value: string): Valid {
  const slug = value.trim();
  if (slug.length === 0) return fail("validation.slugRequired");
  if (slug.length > TEXT.slug)
    return fail("validation.slugTooLong", { max: TEXT.slug });
  if (!SLUG_PATTERN.test(slug)) {
    return fail("validation.slugShape");
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
  const isFilled = (code: string) => (value?.[code] ?? "").trim().length > 0;
  const filled = languages.filter(isFilled);

  if (filled.length === 0) {
    return options.optional ? OK : fail("validation.required");
  }

  // Partly filled is the case worth a good message: the operator has done most
  // of the work and is about to lose it to a constraint violation.
  const missing = languages.filter((code) => !isFilled(code));
  if (missing.length > 0) {
    return fail("form.stillNeeded", { languages: missing.join(", ") });
  }

  const tooLong = languages.filter(
    (code) => (value?.[code] ?? "").trim().length > maxLength,
  );
  if (tooLong.length > 0) {
    return fail("validation.tooLongIn", {
      languages: tooLong.join(", "),
      max: maxLength,
    });
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
export function validatePrice(
  minorUnits: number,
  options: { max?: number } = {},
): Valid {
  if (!Number.isFinite(minorUnits)) return fail("validation.priceRequired");
  if (!Number.isInteger(minorUnits)) {
    return fail("validation.priceWhole");
  }
  if (minorUnits < MONEY.min) return fail("validation.priceNegative");
  const max = options.max ?? MONEY.maxUnitPrice;
  if (minorUnits > max) return fail("validation.priceHuge");
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
export function validateHours(
  day: number,
  opensAt: string,
  closesAt: string,
): Valid {
  if (
    !Number.isInteger(day) ||
    day < DAY_OF_WEEK.min ||
    day > DAY_OF_WEEK.max
  ) {
    return fail("validation.dayOfWeek");
  }
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(opensAt) || !time.test(closesAt))
    return fail("validation.timeShape");
  if (opensAt === closesAt) {
    return fail("validation.hoursSame");
  }
  return OK;
}

export function validatePrepWindow(min: number, max: number): Valid {
  if (!Number.isInteger(min) || !Number.isInteger(max))
    return fail("validation.wholeMinutes");
  if (min < PREP_MINUTES.min)
    return fail("validation.prepMin", { min: PREP_MINUTES.min });
  if (max > PREP_MINUTES.max)
    return fail("validation.prepMax", { max: PREP_MINUTES.max });
  if (max < min) return fail("validation.prepOrder");
  return OK;
}

/**
 * A phone number, as the column will have it.
 *
 * The rule is the CHECK constraint's, applied here so the operator is told
 * before saving rather than by a constraint name afterwards: digits, no leading
 * zero, seven to fifteen of them — which is E.164, and is deliberately *any*
 * country's number rather than Lebanon's.
 *
 * ## Why it validates the joined number and not the typed one
 *
 * `PhoneInput` draws `+961` and takes the rest, so what the operator types is
 * never a whole number and checking it alone would be checking a fragment. What
 * arrives here is the joined form the field emits and the column stores, which
 * is the thing that has to be right.
 *
 * Empty is the caller's business, not this function's: a driver must have a
 * number and a shop need not, and both call this.
 */
export function validatePhone(digits: string): Valid {
  return /^[1-9][0-9]{6,14}$/.test(digits) ? OK : fail("validation.phone");
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
  if (!Number.isFinite(upToKm)) return fail("validation.distanceRequired");
  if (upToKm < DELIVERY.minKm) return fail("validation.bandTooSmall");
  if (upToKm > DELIVERY.maxKm)
    return fail("validation.bandTooBig", { max: DELIVERY.maxKm });
  // `numeric(5,2)` — a third decimal place would be rounded away on write, and
  // a band that silently becomes a different band is worse than a refusal.
  if (Math.abs(upToKm * 100 - Math.round(upToKm * 100)) > 1e-9) {
    return fail("validation.twoDecimals");
  }
  if (existing.includes(upToKm)) return fail("validation.bandDuplicate");

  return validatePrice(amountMinorUnits);
}

export function validateDiscountValue(kind: string, value: number): Valid {
  if (!Number.isFinite(value)) return fail("validation.valueRequired");
  if (value < DISCOUNT.minValue) return fail("validation.discountNegative");
  if (kind === "percentage" && value > DISCOUNT.maxPercentage) {
    return fail("validation.percentageOver");
  }
  return OK;
}

export function validateDiscountWindow(
  startsAt: string | null,
  endsAt: string | null,
): Valid {
  if (!startsAt || !endsAt) return OK;
  if (new Date(startsAt) >= new Date(endsAt)) {
    return fail("validation.windowReversed");
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
  if (
    input.type === null ||
    !(IMAGE.types as readonly string[]).includes(input.type)
  ) {
    return fail("validation.imageType");
  }
  if (input.bytes > IMAGE.maxBytes) {
    return fail("validation.imageTooBig", {
      max: Math.round(IMAGE.maxBytes / 1024 / 1024),
    });
  }
  const { width, height } = input;
  if (width !== undefined && height !== undefined) {
    if (width < IMAGE.minPixels || height < IMAGE.minPixels) {
      return fail("validation.imageTooSmall", { min: IMAGE.minPixels });
    }
    if (width > IMAGE.maxPixels || height > IMAGE.maxPixels) {
      return fail("validation.imageTooLarge", { max: IMAGE.maxPixels });
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
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47
  ) {
    return "image/png";
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
    return "image/webp";
  }
  return null;
}

/**
 * The operator's password.
 *
 * One implementation, used by the reset screen and by `create-admin`. It was
 * two `length < 12` checks in two files, which is exactly how a rule ends up
 * enforced in one place and not the other.
 *
 * **This is not the enforcing layer.** The Supabase project's password policy
 * is, because the auth endpoint is reachable without going through this app.
 * What this does is explain, before a round trip, in a sentence rather than as
 * a 422.
 *
 * ## Why the rejected list is so short
 *
 * It is not a breach corpus, and pretending otherwise would be worse than not
 * having one — a five-entry denylist that says "not a common password" implies
 * a check it is not making. These are the specific strings a person types when
 * they intend to change the password later and then does not. Real breach
 * checking is Supabase's `HaveIBeenPwned` integration, a project setting, and
 * the right place for it.
 */
export function validatePassword(
  password: string,
  options: { email?: string } = {},
): Valid {
  if (password.length < PASSWORD.min) {
    return fail("validation.passwordShort", { min: PASSWORD.min });
  }
  // bcrypt ignores everything past 72 bytes, so a longer one is not stronger —
  // it just has a tail that does nothing, which is worth saying rather than
  // silently accepting. Counted in bytes: a passphrase with an accent or an
  // emoji reaches the limit sooner than its character count suggests.
  if (new TextEncoder().encode(password).length > PASSWORD.max) {
    return fail("validation.passwordLong", { max: PASSWORD.max });
  }
  if (/^\s|\s$/.test(password)) {
    return fail("validation.passwordSpace");
  }

  const lower = password.toLowerCase();

  const local = options.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && lower.includes(local)) {
    return fail("validation.passwordEmail");
  }

  if (["lebrunji", "password", "qwerty"].some((word) => lower.includes(word))) {
    return fail("validation.passwordCommon");
  }

  return OK;
}

/** Collapses a set of results into the first failure, for a whole form. */
export function firstFailure(results: readonly Valid[]): Valid {
  return results.find((result) => !result.ok) ?? OK;
}

/**
 * Is this an MP3, and is it a chime rather than a song?
 *
 * The same three-part shape `validateImage` has, and for the same reasons: the
 * type comes from the file's **first bytes** rather than from `File.type`,
 * which the operating system derives from the extension — so a `.mp3` that is
 * really a video claims `audio/mpeg` there, the store accepts it, and the
 * dashboard plays nothing with no explanation.
 *
 * Duration is checked as well as size because they are not the same question:
 * bitrate decides how many bytes a second costs, so a long quiet recording can
 * be smaller than a short loud one. A three-minute file inside the byte limit
 * would play over the next four orders.
 *
 * `seconds` is optional for the same reason `validateImage`'s dimensions are:
 * decoding can fail on a file that is perfectly playable, and refusing a good
 * chime because the browser would not measure it is the wrong trade.
 */
export function validateSound(input: {
  bytes: number;
  type: string | null;
  seconds?: number;
}): Valid {
  if (
    input.type === null ||
    !(SOUND.types as readonly string[]).includes(input.type)
  ) {
    return fail("validation.soundType");
  }
  if (input.bytes > SOUND.maxBytes) {
    return fail("validation.soundTooBig", {
      max: Math.round(SOUND.maxBytes / 1024),
    });
  }
  if (input.seconds !== undefined && input.seconds > SOUND.maxSeconds) {
    return fail("validation.soundTooLong", { max: SOUND.maxSeconds });
  }
  return OK;
}

/**
 * An MP3, from its first bytes.
 *
 * Two legal openings and both have to be accepted, because which one a file has
 * depends on the encoder rather than on anything a person chose:
 *
 * - `ID3` — a tag block at the front, which is what most encoders write.
 * - A frame sync: eleven set bits, so `FF` then a byte whose top three bits are
 *   set. `FB`, `F3` and `F2` are the ones seen in practice.
 *
 * Anything else is not an MP3, whatever the extension says.
 */
export function sniffAudioType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0x49 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x33
  ) {
    return "audio/mpeg";
  }
  if (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    ((bytes[1] as number) & 0xe0) === 0xe0
  ) {
    return "audio/mpeg";
  }
  return null;
}
