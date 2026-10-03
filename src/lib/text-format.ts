/**
 * What a catalogue name may contain — and, deliberately, nothing about case.
 *
 * ## Case is the operator's
 *
 * This file used to hold a house style: shops, sections and dishes shouted,
 * categories, tags and descriptions in sentence case, applied as the operator
 * typed and again on save. It is gone. A name is stored exactly as it was
 * written — "McDonald's", "USD", "iPhone" — because a rule that rewrites letters
 * cannot tell an acronym from a typo, and the person typing can.
 *
 * What is left is about *which characters* a name may hold, never about how
 * its letters are cased.
 */

/**
 * The characters a catalogue name may not contain.
 *
 * ## Why a blocklist and not an allowlist
 *
 * An allowlist would have to enumerate every letter a name can be written in,
 * and the answer to that is "every script the `languages` table ever grows a
 * row for". A rule written that way is one that breaks the day somebody adds
 * Armenian — silently, by rejecting every character of it.
 *
 * ## What is on it, and what deliberately is not
 *
 * On it: the characters that are punctuation *for machines*. Slashes and
 * backslashes look like paths, angle brackets and braces like markup, and
 * `+ = ^ ~ | * _ # @ $ %` are operators of one syntax or another. None of them
 * is how anybody writes the name of a shop, and each one is a small ambiguity
 * downstream — in a slug, a URL, a search term, a CSV export.
 *
 * Not on it, and each for a real name that needs it:
 *
 * - `,` — asked for by name. "Fries, large".
 * - `&` — "Fish & Chips". Half the high street.
 * - `'` and `’` — "Joe's".
 * - `-` and the dashes — "Wood-fired".
 * - `.` — "St. George".
 * - `( )` — "Kibbeh (4 pcs)".
 * - `! ? :` — a title is allowed to be a sentence.
 *
 * The list is about shape rather than about danger: nothing downstream trusts
 * these strings, and this is not what stops an injection. It is what stops a
 * menu that reads like a config file.
 */
const REJECTED = /[+/\<>{}[\]|^~`*_=#@$%"]/g;

/**
 * What a value would lose, as the characters themselves.
 *
 * Returned rather than counted, because the message the field shows names them
 * — "+ and / cannot be used here" tells somebody which key to stop pressing,
 * and "invalid character" does not. De-duplicated and in the order they were
 * typed.
 */
export function rejectedIn(value: string): string[] {
  return [...new Set(value.match(REJECTED) ?? [])];
}

/** The value without them. */
export function withoutRejected(value: string): string {
  return value.replace(REJECTED, "");
}

/**
 * The rejected characters over a whole translated column.
 *
 * The second layer under the field's live filter — bulk paste and any screen
 * written next arrive at the api without passing through `LocalizedField`. It
 * removes characters only; case is left exactly as typed. A null or absent
 * column comes back untouched: an absent description is a legitimate value and
 * cleaning it into `{}` would turn it into a constraint violation.
 */
export function cleanLocalized<T extends Record<string, string> | null>(
  value: T,
): T {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).map(([code, text]) => [code, withoutRejected(text)]),
  ) as T;
}

/**
 * One word of a tag name: letters only, Latin (with its accented ranges) or
 * Arabic. **Must match `menu_item_tags_name_letters`** character for
 * character — the dashboard and the database have to agree on what a letter
 * is, or a name passes here and is refused there.
 */
const TAG_WORD = "[A-Za-zÀ-ÖØ-öø-ɏء-غف-يً-ْٰٱ-ۓ]+";

/** A whole tag name: words of letters, one space between each. */
const TAG_NAME = new RegExp(`^${TAG_WORD}( ${TAG_WORD})*$`, "u");

/** One character a tag name may hold, other than the space between words. */
const TAG_LETTER = new RegExp(`^${TAG_WORD}$`, "u");

/**
 * Whether a tag name is letters and single spaces and nothing else.
 *
 * Tested on the value trimmed and with runs of whitespace collapsed — the same
 * shape `tagName` below writes — so stray spaces at the edges are not what
 * refuses a name. An empty value is not this function's business: whether a
 * language may be blank is `validateLocalizedText`'s.
 */
export function isTagName(value: string): boolean {
  return TAG_NAME.test(tagName(value));
}

/** A tag name as it is stored: trimmed, with single spaces between words. */
export function tagName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * A tag name as it is being typed: everything that is not a letter or a space
 * removed, and runs of spaces kept to one.
 *
 * A trailing space survives — it is somebody about to type the next word — and
 * a leading one does not, since no word can start before it. Returns what was
 * dropped as well, de-duplicated and in order, so the field can name the keys
 * that did nothing rather than eat them silently.
 */
export function lettersOnly(value: string): {
  kept: string;
  dropped: string[];
} {
  const dropped: string[] = [];
  let kept = "";
  for (const char of value) {
    if (/\s/u.test(char)) {
      if (kept !== "" && !kept.endsWith(" ")) kept += " ";
    } else if (TAG_LETTER.test(char)) {
      kept += char;
    } else if (!/[\p{Mn}\p{Cf}]/u.test(char) && !dropped.includes(char)) {
      // Invisible joiners and variation selectors are dropped without being
      // named — a message listing a character nobody can see would
      // point at nothing.
      dropped.push(char);
    }
  }
  return { kept, dropped };
}
